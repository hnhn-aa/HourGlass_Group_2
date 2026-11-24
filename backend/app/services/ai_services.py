"""Trợ lý AI HourGlass (HourGlass AI Assistant).

Luồng xử lý một câu hỏi:
  1. Xác định vai trò thực tế (ưu tiên vai trò trong JWT nếu có).
  2. Lấy "ảnh chụp" dữ liệu hệ thống (số tin đang tuyển, ngành nghề, tin chờ duyệt...)
     để câu trả lời bám sát dữ liệu HourGlass.
  3. Nếu đã cấu hình AI_API_KEY → gọi LLM (Gemini hoặc API tương thích OpenAI).
  4. Nếu chưa cấu hình / hết quota / lỗi mạng / phản hồi rỗng → trả lời bằng kịch bản
     dự phòng theo vai trò. Hàm public `generate_ai_reply` KHÔNG BAO GIỜ ném ngoại lệ.

Biến môi trường (khai báo trong backend/.env, xem .env.example):
  AI_API_KEY            Khóa API. Để trống = chỉ dùng chế độ kịch bản.
  AI_PROVIDER           auto | gemini | openai   (auto: khóa bắt đầu bằng "AIza" → gemini)
  AI_MODEL              Mặc định: gemini-2.5-flash (gemini) / gpt-4o-mini (openai)
  AI_BASE_URL           Tùy chọn. Endpoint tương thích OpenAI (Groq, OpenRouter, Ollama...)
  AI_TIMEOUT            Số giây chờ LLM (mặc định 20)
  AI_TEMPERATURE        Mặc định 0.6
  AI_MAX_OUTPUT_TOKENS  Mặc định 800
"""
from __future__ import annotations

import json
import logging
import os
import re
import socket
import threading
import time
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Callable

from app.schemas.ai_chat import AIChatRequest, AIChatResponse, AIStatusResponse

if TYPE_CHECKING:  # chỉ dùng cho gợi ý kiểu, tránh phụ thuộc vòng khi import
    from sqlalchemy.orm import Session

    from app.models.user import User

logger = logging.getLogger("hourglass.ai")

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"

# Số tin lịch sử gửi cho LLM (≈ 5 lượt hỏi–đáp) và độ dài tối đa mỗi tin
LLM_HISTORY_LIMIT = 10
LLM_HISTORY_CHARS = 1500

ROLE_LABELS = {"student": "Sinh viên", "employer": "Nhà tuyển dụng", "admin": "Quản trị viên"}

NOTICE_NO_KEY = "Trợ lý đang chạy chế độ trả lời theo kịch bản HourGlass (chưa cấu hình AI_API_KEY)."
NOTICE_QUOTA = "Dịch vụ AI tạm hết hạn mức sử dụng, trợ lý đang trả lời bằng chế độ dự phòng."
NOTICE_ERROR = "Không kết nối được dịch vụ AI, trợ lý đang trả lời bằng chế độ dự phòng."


# ═══════════════════════ 1. CẤU HÌNH ═══════════════════════
@dataclass(frozen=True)
class AIConfig:
    api_key: str
    provider: str  # gemini | openai | "" (khi chưa có khóa)
    model: str
    base_url: str
    timeout: float
    temperature: float
    max_output_tokens: int

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, "") or default)
    except ValueError:
        return default


def get_ai_config() -> AIConfig:
    """Đọc cấu hình mỗi lần gọi để đổi .env / biến môi trường không cần sửa code."""
    api_key = (os.environ.get("AI_API_KEY") or "").strip()
    provider = (os.environ.get("AI_PROVIDER") or "auto").strip().lower()
    if provider not in ("gemini", "openai"):
        provider = "gemini" if api_key.startswith("AIza") else "openai"
    if not api_key:
        provider = ""

    default_model = DEFAULT_GEMINI_MODEL if provider == "gemini" else DEFAULT_OPENAI_MODEL
    default_base = DEFAULT_GEMINI_BASE_URL if provider == "gemini" else DEFAULT_OPENAI_BASE_URL
    return AIConfig(
        api_key=api_key,
        provider=provider,
        model=(os.environ.get("AI_MODEL") or "").strip() or default_model,
        base_url=((os.environ.get("AI_BASE_URL") or "").strip() or default_base).rstrip("/"),
        timeout=max(3.0, _env_float("AI_TIMEOUT", 20)),
        temperature=min(max(_env_float("AI_TEMPERATURE", 0.6), 0.0), 1.5),
        max_output_tokens=int(max(128, _env_float("AI_MAX_OUTPUT_TOKENS", 800))),
    )


# ── Tạm ngưng gọi LLM sau khi hết quota / sai khóa, tránh mỗi câu hỏi phải chờ lỗi ──
_cooldown_lock = threading.Lock()
_cooldown_until = 0.0
_cooldown_kind = ""


def _set_cooldown(kind: str, seconds: float) -> None:
    global _cooldown_until, _cooldown_kind
    with _cooldown_lock:
        _cooldown_until = time.monotonic() + seconds
        _cooldown_kind = kind


def _active_cooldown() -> str:
    with _cooldown_lock:
        return _cooldown_kind if time.monotonic() < _cooldown_until else ""


def reset_ai_cooldown() -> None:
    """Dùng trong kiểm thử hoặc khi vừa cập nhật khóa API mới."""
    _set_cooldown("", 0)


# ═══════════════════════ 2. DỮ LIỆU HỆ THỐNG ═══════════════════════
@dataclass
class SystemSnapshot:
    open_jobs: int = 0
    categories: list[tuple[str, int]] = field(default_factory=list)  # (tên ngành, số tin đang tuyển)
    latest_jobs: list[dict[str, str]] = field(default_factory=list)
    pending_jobs: int = 0
    pending_reports: int = 0
    my_jobs: int | None = None  # số tin của nhà tuyển dụng đang đăng nhập
    available: bool = False


def _fmt_money(value: Any) -> str:
    try:
        return f"{int(value):,}".replace(",", ".") + "đ"
    except (TypeError, ValueError):
        return ""


def _fmt_salary(salary_min: Any, salary_max: Any) -> str:
    lo, hi = _fmt_money(salary_min), _fmt_money(salary_max)
    if lo and hi and lo != hi and salary_max:
        return f"{lo} – {hi}"
    return lo or hi or "Thỏa thuận"


def collect_system_snapshot(db: "Session | None", user: "User | None" = None) -> SystemSnapshot:
    """Thống kê nhanh, chỉ dữ liệu công khai/tổng hợp (không lộ thông tin cá nhân)."""
    snap = SystemSnapshot()
    if db is None:
        return snap
    try:
        from sqlalchemy import func

        from app.models.job import Job, JobCategory, JobStatusEnum
        from app.models.report import Report, ReportStatusEnum

        approved = Job.status == JobStatusEnum.APPROVED
        snap.open_jobs = db.query(func.count(Job.id)).filter(approved).scalar() or 0
        snap.pending_jobs = (
            db.query(func.count(Job.id)).filter(Job.status == JobStatusEnum.PENDING).scalar() or 0
        )
        snap.pending_reports = (
            db.query(func.count(Report.id)).filter(Report.status == ReportStatusEnum.PENDING).scalar() or 0
        )
        rows = (
            db.query(JobCategory.name, func.count(Job.id))
            .outerjoin(Job, (Job.category_id == JobCategory.id) & approved)
            .group_by(JobCategory.id, JobCategory.name)
            .order_by(func.count(Job.id).desc(), JobCategory.name.asc())
            .limit(8)
            .all()
        )
        snap.categories = [(name, int(count or 0)) for name, count in rows]
        for job in db.query(Job).filter(approved).order_by(Job.created_at.desc(), Job.id.desc()).limit(5).all():
            snap.latest_jobs.append(
                {
                    "title": job.title,
                    "category": job.category.name if job.category else "",
                    "location": job.location.name if job.location else "",
                    "salary": _fmt_salary(job.salary_min, job.salary_max),
                    "work_time": job.work_time or "",
                }
            )
        if user is not None and _user_role(user) == "employer":
            snap.my_jobs = db.query(func.count(Job.id)).filter(Job.employer_id == user.id).scalar() or 0
        snap.available = True
    except Exception as exc:  # DB lỗi không được làm hỏng trợ lý
        logger.warning("AI snapshot unavailable: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass
    return snap


def _snapshot_text(snap: SystemSnapshot, role: str) -> str:
    if not snap.available:
        return "Hiện chưa lấy được số liệu hệ thống."
    lines = [f"- Số tin tuyển dụng đang mở: {snap.open_jobs}"]
    if snap.categories:
        lines.append("- Ngành nghề (số tin đang mở): " + ", ".join(f"{n} ({c})" for n, c in snap.categories))
    if snap.latest_jobs:
        lines.append("- Một số tin mới nhất:")
        for j in snap.latest_jobs:
            extra = " · ".join(x for x in (j["category"], j["location"], j["salary"], j["work_time"]) if x)
            lines.append(f"  • {j['title']}" + (f" ({extra})" if extra else ""))
    if role == "admin":
        lines.append(f"- Tin đang chờ kiểm duyệt: {snap.pending_jobs}")
        lines.append(f"- Báo cáo/khiếu nại chưa xử lý: {snap.pending_reports}")
    if role == "employer" and snap.my_jobs is not None:
        lines.append(f"- Số tin tuyển dụng của nhà tuyển dụng này: {snap.my_jobs}")
    return "\n".join(lines)


# ═══════════════════════ 3. PROMPT THEO VAI TRÒ ═══════════════════════
_ROLE_BRIEF = {
    "student": (
        "Người dùng là SINH VIÊN. Nhiệm vụ: tư vấn tìm việc làm thêm (part-time) phù hợp lịch học, "
        "hướng dẫn viết CV/thư giới thiệu, chuẩn bị phỏng vấn, sắp xếp lịch rảnh – lịch làm, "
        "nhận diện tin tuyển dụng lừa đảo, và cách dùng HourGlass (tìm việc, lưu việc, ứng tuyển kèm CV "
        "PDF/DOC/DOCX ≤ 5MB, theo dõi trạng thái hồ sơ, khai báo lịch rảnh, đánh giá nhà tuyển dụng)."
    ),
    "employer": (
        "Người dùng là NHÀ TUYỂN DỤNG. Nhiệm vụ: gợi ý viết tin tuyển dụng hấp dẫn và rõ ràng (tiêu đề, "
        "mô tả, yêu cầu, quyền lợi, mức lương, ca làm), tiêu chí lọc và đánh giá ứng viên sinh viên, "
        "quy trình phỏng vấn, và cách dùng HourGlass (hồ sơ công ty, đăng tin – tin cần Admin duyệt trước "
        "khi hiển thị, quản lý ứng viên dạng Kanban: Mới nộp → Đã tiếp nhận → Phỏng vấn → Trúng tuyển / Từ chối, "
        "kéo thả thẻ để đổi trạng thái, nhập lý do khi từ chối)."
    ),
    "admin": (
        "Người dùng là QUẢN TRỊ VIÊN. Nhiệm vụ: hướng dẫn kiểm duyệt tin đăng (duyệt / từ chối kèm lý do), "
        "xử lý báo cáo – khiếu nại, quản lý tài khoản sinh viên và nhà tuyển dụng (khóa/mở khóa), "
        "quản lý danh mục ngành nghề, đọc thống kê – báo cáo, và phân quyền quản trị (chỉ Admin gốc được "
        "cấp/thu hồi quyền quản trị viên)."
    ),
}

_ROLE_BRIEF_EN = {
    "student": (
        "The user is a STUDENT. Your task: advise on finding part-time jobs that fit class schedules, "
        "writing CVs/cover notes, interview preparation, balancing free shifts and work schedules, "
        "spotting job scams, and how to use HourGlass (browsing jobs, saving jobs, applying with a CV "
        "PDF/DOC/DOCX ≤ 5MB, tracking application status, registering weekly availability, rating employers)."
    ),
    "employer": (
        "The user is an EMPLOYER. Your task: advise on writing clear and attractive job postings (title, "
        "description, requirements, perks, salary, shifts), screening and evaluating student candidates, "
        "interview workflows, and how to use HourGlass (company profile, posting jobs – posts require Admin approval "
        "before going live, managing candidates via the Kanban board: New → Received → Interview → Hired / Rejected, "
        "drag-and-drop cards to change status, providing a reason when rejecting)."
    ),
    "admin": (
        "The user is an ADMINISTRATOR. Your task: guide on job post moderation (approving / rejecting with a reason), "
        "handling violation reports and disputes, managing student and employer accounts (locking/unlocking), "
        "managing job categories, reading system analytics, and admin permissions (only the Root Admin can "
        "grant/revoke administrator privileges)."
    ),
}


def build_system_prompt(role: str, snap: SystemSnapshot, lang: str = "vi") -> str:
    if lang == "en":
        return (
            "You are HourGlass AI Assistant – the intelligent assistant for HourGlass, a part-time job platform for university students in Vietnam.\n"
            f"{_ROLE_BRIEF_EN.get(role, _ROLE_BRIEF_EN['student'])}\n\n"
            "Rules:\n"
            "- ALWAYS reply in English, in a friendly and concise tone (around 200 words max), preferring bullet points and actionable steps.\n"
            "- Only use HourGlass metrics provided in the SYSTEM DATA section below; never fabricate job listings, companies, or numbers.\n"
            "- Never disclose personal data of other users; never ask for passwords or OTP codes.\n"
            "- Do not instruct actions outside the current user role's permissions.\n"
            "- For off-topic questions unrelated to jobs/career/HourGlass: politely state that you only assist with career topics and the HourGlass platform.\n\n"
            f"SYSTEM DATA (live snapshot):\n{_snapshot_text(snap, role)}"
        )
    return (
        "Bạn là HourGlass AI Assistant – trợ lý của HourGlass, nền tảng việc làm thêm dành cho sinh viên Việt Nam.\n"
        f"{_ROLE_BRIEF.get(role, _ROLE_BRIEF['student'])}\n\n"
        "Quy tắc:\n"
        "- Luôn trả lời bằng tiếng Việt, thân thiện, ngắn gọn (tối đa khoảng 200 từ), ưu tiên gạch đầu dòng và bước cụ thể.\n"
        "- Chỉ dùng số liệu HourGlass có trong phần DỮ LIỆU HỆ THỐNG bên dưới; không bịa tin tuyển dụng, công ty hay con số.\n"
        "- Không tiết lộ thông tin cá nhân của người dùng khác; không bao giờ hỏi mật khẩu hay mã OTP.\n"
        "- Không hướng dẫn thao tác vượt quyền của vai trò hiện tại.\n"
        "- Câu hỏi ngoài phạm vi việc làm/HourGlass: trả lời lịch sự rằng bạn chỉ hỗ trợ chủ đề việc làm và nền tảng HourGlass.\n\n"
        f"DỮ LIỆU HỆ THỐNG (cập nhật lúc trả lời):\n{_snapshot_text(snap, role)}"
    )


# ═══════════════════════ 4. GỌI LLM ═══════════════════════
class AIProviderError(Exception):
    """kind: quota | auth | timeout | network | bad_response"""

    def __init__(self, kind: str, message: str = ""):
        super().__init__(message or kind)
        self.kind = kind


def _post_json(url: str, payload: dict, headers: dict, timeout: float) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8", "ignore")[:300]
        except Exception:
            pass
        quota_hint = "quota" in body.lower() or "resource_exhausted" in body.lower() or "insufficient" in body.lower()
        if exc.code == 429 or (exc.code in (400, 403) and quota_hint):
            raise AIProviderError("quota", f"HTTP {exc.code}: {body}") from exc
        if exc.code in (401, 403) or (exc.code == 400 and "api key" in body.lower()):
            raise AIProviderError("auth", f"HTTP {exc.code}: {body}") from exc
        raise AIProviderError("network", f"HTTP {exc.code}: {body}") from exc
    except (socket.timeout, TimeoutError) as exc:
        raise AIProviderError("timeout", str(exc)) from exc
    except urllib.error.URLError as exc:
        kind = "timeout" if isinstance(exc.reason, (socket.timeout, TimeoutError)) else "network"
        raise AIProviderError(kind, str(exc.reason)) from exc
    except (ValueError, OSError) as exc:
        raise AIProviderError("bad_response", str(exc)) from exc


def _llm_history(history: list) -> list[tuple[str, str]]:
    """Chuẩn hóa lịch sử: chỉ giữ các tin gần nhất, gộp tin liền nhau cùng người nói."""
    turns: list[tuple[str, str]] = []
    for item in history[-LLM_HISTORY_LIMIT:]:
        text = item.content[:LLM_HISTORY_CHARS]
        if turns and turns[-1][0] == item.role:
            turns[-1] = (item.role, turns[-1][1] + "\n" + text)
        else:
            turns.append((item.role, text))
    while turns and turns[0][0] != "user":  # Gemini yêu cầu lượt đầu là của người dùng
        turns.pop(0)
    return turns


def _call_gemini(cfg: AIConfig, system_prompt: str, turns: list[tuple[str, str]], message: str) -> str:
    contents = [{"role": "model" if r == "assistant" else "user", "parts": [{"text": t}]} for r, t in turns]
    contents.append({"role": "user", "parts": [{"text": message}]})
    data = _post_json(
        f"{cfg.base_url}/models/{cfg.model}:generateContent",
        {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {"temperature": cfg.temperature, "maxOutputTokens": cfg.max_output_tokens},
        },
        {"x-goog-api-key": cfg.api_key},
        cfg.timeout,
    )
    try:
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts).strip()
    except (KeyError, IndexError, TypeError):
        raise AIProviderError("bad_response", json.dumps(data, ensure_ascii=False)[:300])


def _call_openai(cfg: AIConfig, system_prompt: str, turns: list[tuple[str, str]], message: str) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": r, "content": t} for r, t in turns]
    messages.append({"role": "user", "content": message})
    data = _post_json(
        f"{cfg.base_url}/chat/completions",
        {
            "model": cfg.model,
            "messages": messages,
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_output_tokens,
        },
        {"Authorization": f"Bearer {cfg.api_key}"},
        cfg.timeout,
    )
    try:
        return (data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, TypeError):
        raise AIProviderError("bad_response", json.dumps(data, ensure_ascii=False)[:300])


def call_llm(cfg: AIConfig, system_prompt: str, history: list, message: str) -> str:
    turns = _llm_history(history)
    # Tin cuối của lịch sử là của người dùng (VD: lần gửi trước bị lỗi) → gộp vào câu hỏi hiện tại
    # để giữ đúng thứ tự xen kẽ user/assistant; bỏ qua nếu trùng chính câu hỏi này.
    if turns and turns[-1][0] == "user":
        pending = turns.pop()[1]
        if pending.strip() != message.strip():
            message = f"{pending}\n{message}"
    caller = _call_gemini if cfg.provider == "gemini" else _call_openai
    reply = caller(cfg, system_prompt, turns, message)
    if not reply:
        raise AIProviderError("bad_response", "Phản hồi rỗng (có thể bị bộ lọc an toàn chặn)")
    return reply


# ═══════════════════════ 5. KỊCH BẢN DỰ PHÒNG ═══════════════════════
def normalize_text(text: str) -> str:
    """Bỏ dấu tiếng Việt + chữ thường để so khớp từ khóa ("Viết CV" ~ "viet cv")."""
    text = (text or "").lower().replace("đ", "d")
    text = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


@dataclass(frozen=True)
class Intent:
    key: str
    keywords: tuple[str, ...]  # viết không dấu
    answer: Callable[[SystemSnapshot], str]
    suggestions: tuple[str, ...] = ()
    more: str = ""  # gợi ý bổ sung khi người dùng hỏi "chi tiết hơn"


def _jobs_brief(snap: SystemSnapshot) -> str:
    if not snap.available:
        return ""
    if not snap.open_jobs:
        return "\n\nHiện HourGlass chưa có tin nào đang mở – bạn hãy bật thông báo và quay lại sau nhé."
    out = f"\n\n📌 HourGlass đang có **{snap.open_jobs} tin** đang tuyển"
    hot = [f"{n} ({c})" for n, c in snap.categories if c][:4]
    out += (": " + ", ".join(hot) + "." if hot else ".")
    if snap.latest_jobs:
        out += "\nTin mới: " + "; ".join(
            f"{j['title']} – {j['salary']}" + (f" – {j['location']}" if j["location"] else "") for j in snap.latest_jobs[:3]
        ) + "."
    return out


def _txt(body: str) -> Callable[[SystemSnapshot], str]:
    return lambda _snap: body


_COMMON_INTENTS: tuple[Intent, ...] = (
    Intent(
        "account",
        ("mat khau", "doi mat khau", "quen mat khau", "dang nhap", "tai khoan bi khoa", "dang xuat", "password"),
        _txt(
            "🔐 **Tài khoản & mật khẩu**\n"
            "- Đổi mật khẩu: vào tab **Cài đặt tài khoản** → nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự) → Lưu.\n"
            "- Tài khoản bị khóa: liên hệ HourGlass qua trang **Giới thiệu → Liên hệ** để được Quản trị viên hỗ trợ.\n"
            "- HourGlass **không bao giờ** hỏi mật khẩu hay mã OTP qua tin nhắn – đừng chia sẻ cho bất kỳ ai."
        ),
        ("Làm sao cập nhật hồ sơ cá nhân?",),
    ),
    Intent(
        "about",
        ("hourglass la gi", "gioi thieu", "ban la ai", "ban lam duoc gi", "huong dan su dung", "tro giup", "help"),
        _txt(
            "👋 Mình là **HourGlass AI Assistant**. HourGlass kết nối sinh viên với việc làm thêm linh hoạt:\n"
            "- **Sinh viên**: tìm – lưu – ứng tuyển việc part-time, quản lý CV, lịch rảnh và lịch làm.\n"
            "- **Nhà tuyển dụng**: đăng tin (Admin duyệt trước khi hiển thị), quản lý ứng viên bằng Kanban.\n"
            "- **Quản trị viên**: kiểm duyệt tin, xử lý khiếu nại, quản lý người dùng và danh mục."
        ),
    ),
)

_STUDENT_INTENTS: tuple[Intent, ...] = (
    Intent(
        "find_job",
        ("tim viec", "viec lam", "part time", "parttime", "lam them", "viec nao", "goi y viec", "ca toi",
         "buoi toi", "cuoi tuan", "gan truong", "luong cao", "phu hop"),
        lambda s: (
            "🔎 **Tìm việc part-time phù hợp trên HourGlass**\n"
            "1. Vào **Tìm việc**, lọc theo *ngành nghề*, *khu vực* và *mức lương*; ưu tiên tin ghi rõ ca làm.\n"
            "2. Khai báo **Lịch rảnh** trong Dashboard để đối chiếu ca làm với lịch học trước khi ứng tuyển.\n"
            "3. Bấm ♡ **Lưu việc** để so sánh nhiều tin, rồi ứng tuyển 3–5 tin phù hợp nhất thay vì nộp đại trà.\n"
            "4. Xem **đánh giá uy tín** của nhà tuyển dụng trước khi nhận việc."
            + _jobs_brief(s)
        ),
        ("Cách viết CV khi chưa có kinh nghiệm?", "Làm sao sắp xếp lịch làm với lịch học?"),
        "Mẹo: tin đăng mới thường nhận ít hồ sơ hơn – ứng tuyển trong 24–48 giờ đầu sẽ có lợi thế.",
    ),
    Intent(
        "cv",
        ("cv", "so yeu ly lich", "ho so xin viec", "thu gioi thieu", "cover letter", "resume", "kinh nghiem"),
        _txt(
            "📝 **Viết CV part-time cho sinh viên** (1 trang là đủ)\n"
            "- **Thông tin**: họ tên, SĐT, email, khu vực sinh sống, trường – ngành – năm học.\n"
            "- **Mục tiêu**: 1–2 câu, nêu rõ vị trí và khung giờ có thể làm.\n"
            "- **Kinh nghiệm**: chưa đi làm thì ghi CLB, tình nguyện, dự án môn học – viết theo kết quả cụ thể "
            "(VD: *tư vấn 50+ khách/ngày tại hội chợ*).\n"
            "- **Kỹ năng**: giao tiếp, tin học văn phòng, ngoại ngữ… chọn kỹ năng khớp với tin tuyển dụng.\n"
            "- Lưu file **PDF** (HourGlass nhận PDF/DOC/DOCX ≤ 5MB), đặt tên `HoTen_ViTri.pdf`.\n"
            "- Khi ứng tuyển, thêm vài câu **thư giới thiệu** nói vì sao bạn hợp với vị trí đó."
        ),
        ("Gợi ý câu trả lời phỏng vấn phục vụ", "Tải CV lên HourGlass ở đâu?"),
        "Mỗi tin nên chỉnh 2–3 dòng CV cho khớp từ khóa trong phần *Yêu cầu ứng viên* của tin đó.",
    ),
    Intent(
        "schedule",
        ("lich", "xep lich", "sap xep", "thoi gian bieu", "ca lam", "lich hoc", "lich ranh", "trung lich", "quan ly thoi gian"),
        _txt(
            "🗓️ **Sắp xếp lịch học – lịch làm**\n"
            "1. Nhập **Lịch rảnh** (theo thứ và khung giờ) trong Dashboard – nhà tuyển dụng sẽ dễ xếp ca hơn.\n"
            "2. Khi trúng tuyển, ca làm hiện ở **Lịch làm việc**; kiểm tra trùng lịch trước khi xác nhận.\n"
            "3. Gợi ý: tối đa **15–20 giờ/tuần** trong mùa học, chừa thời gian trước kỳ thi.\n"
            "4. Ưu tiên ca cố định (tối các ngày trong tuần hoặc cuối tuần) để giữ nhịp học ổn định."
        ),
        ("Việc nào làm buổi tối?", "Cách xin đổi ca với nhà tuyển dụng?"),
    ),
    Intent(
        "apply",
        ("ung tuyen", "nop ho so", "trang thai", "da tiep nhan", "trung tuyen", "bi tu choi", "rut don", "huy ung tuyen"),
        _txt(
            "📨 **Ứng tuyển & theo dõi hồ sơ**\n"
            "- Mở tin → **Ứng tuyển** → chọn CV + viết thư giới thiệu ngắn.\n"
            "- Trạng thái: **Mới nộp → Đã tiếp nhận → Phỏng vấn → Trúng tuyển / Từ chối**, xem ở mục *Việc đã ứng tuyển*.\n"
            "- Khi bị từ chối, nhà tuyển dụng ghi **lý do** – dùng nó để cải thiện CV cho lần sau.\n"
            "- Bạn có thể **hủy ứng tuyển** nếu hồ sơ chưa được xử lý xong."
        ),
        ("Chuẩn bị phỏng vấn thế nào?",),
    ),
    Intent(
        "interview",
        ("phong van", "interview", "cau hoi phong van", "chuan bi"),
        _txt(
            "🎤 **Chuẩn bị phỏng vấn part-time**\n"
            "- Đọc kỹ tin tuyển dụng, chuẩn bị câu giới thiệu bản thân 30 giây.\n"
            "- Câu hỏi hay gặp: *Bạn làm được những ca nào? Đã có kinh nghiệm chưa? Xử lý khách khó tính thế nào?*\n"
            "- Hỏi lại về **lương, cách tính giờ, ngày trả lương, đào tạo** – đừng ngại.\n"
            "- Đến sớm 10 phút, trang phục gọn gàng; lịch phỏng vấn hiện trên thẻ hồ sơ của bạn."
        ),
    ),
    Intent(
        "safety",
        ("lua dao", "dat coc", "phi", "an toan", "uy tin", "scam", "nop tien", "bao cao", "khieu nai"),
        _txt(
            "⚠️ **Nhận diện tin tuyển dụng đáng ngờ**\n"
            "- Yêu cầu **đặt cọc, mua đồng phục, nộp phí** trước khi làm → dấu hiệu lừa đảo.\n"
            "- Lương cao bất thường cho việc đơn giản, chỉ liên hệ qua mạng xã hội, không có địa chỉ rõ ràng.\n"
            "- Xem **đánh giá uy tín** nhà tuyển dụng; gặp tin đáng ngờ hãy bấm **Báo cáo** để Quản trị viên kiểm tra."
        ),
    ),
)

_EMPLOYER_INTENTS: tuple[Intent, ...] = (
    Intent(
        "post_job",
        ("dang tin", "tin tuyen dung", "viet tin", "mo ta cong viec", "jd", "tieu de", "quyen loi", "muc luong",
         "tuyen nhan vien", "tuyen dung"),
        lambda s: (
            "📢 **Viết tin tuyển dụng thu hút sinh viên**\n"
            "- **Tiêu đề** = vị trí + điểm nổi bật: *Phục vụ ca tối – 28.000đ/giờ – gần ĐH Quốc gia*.\n"
            "- **Mô tả**: 3–5 gạch đầu dòng công việc thực tế mỗi ca.\n"
            "- **Ca làm & lương**: ghi rõ khung giờ, số buổi tối thiểu/tuần, cách tính lương và ngày trả.\n"
            "- **Yêu cầu**: chỉ giữ điều kiện thật sự cần; ghi *“không yêu cầu kinh nghiệm, có đào tạo”* nếu đúng.\n"
            "- **Quyền lợi**: phụ cấp, thưởng, giờ linh hoạt mùa thi – đây là điểm sinh viên quan tâm nhất.\n"
            "- Tin sẽ ở trạng thái **Chờ duyệt** cho đến khi Admin phê duyệt; có thể **Lưu nháp** để chỉnh tiếp."
            + (f"\n\n📌 Bạn đang có {s.my_jobs} tin trên HourGlass." if s.my_jobs is not None else "")
        ),
        ("Làm sao lọc ứng viên nhanh?", "Vì sao tin của tôi bị từ chối?"),
        "Thêm ảnh thực tế nơi làm việc và mức lương cụ thể giúp tin nhận nhiều hồ sơ chất lượng hơn.",
    ),
    Intent(
        "filter",
        ("loc ung vien", "ung vien", "sang loc", "chon ung vien", "danh gia ung vien", "kanban", "ho so ung vien",
         "xem cv", "tu choi ung vien", "keo tha"),
        _txt(
            "👥 **Lọc & quản lý ứng viên**\n"
            "1. Tab **Quản lý ứng viên** → chế độ **Kanban**, lọc theo từng vị trí.\n"
            "2. Sàng lọc nhanh: lịch rảnh khớp ca làm → khoảng cách tới nơi làm → kinh nghiệm/kỹ năng liên quan.\n"
            "3. Kéo thẻ sang **Đã tiếp nhận / Phỏng vấn / Trúng tuyển**; khi **Từ chối** hãy chọn lý do để ứng viên biết.\n"
            "4. Phản hồi trong **48 giờ** – sinh viên thường nhận việc nơi trả lời sớm nhất."
        ),
        ("Gợi ý câu hỏi phỏng vấn ứng viên", "Cách viết tin tuyển dụng hấp dẫn?"),
    ),
    Intent(
        "interview",
        ("phong van", "cau hoi", "hen lich", "lich phong van"),
        _txt(
            "🎤 **Phỏng vấn ứng viên sinh viên**\n"
            "- Chuyển thẻ sang **Phỏng vấn** và nhập thời gian – ứng viên sẽ thấy lịch hẹn.\n"
            "- Câu hỏi gợi ý: ca nào bạn cam kết được? Kế hoạch mùa thi? Tình huống khách phàn nàn bạn xử lý ra sao?\n"
            "- Nói rõ lương, thời gian thử việc và đào tạo ngay buổi đầu để tránh nghỉ ngang."
        ),
    ),
    Intent(
        "rejected_post",
        ("bi tu choi", "khong duoc duyet", "cho duyet", "duyet tin", "tin bi an", "het han"),
        _txt(
            "🛡️ **Tin chờ duyệt / bị từ chối**\n"
            "- Mọi tin mới cần Quản trị viên duyệt; lý do từ chối hiển thị ngay trong **Quản lý tin tuyển dụng**.\n"
            "- Lý do thường gặp: thiếu mức lương/ca làm, mô tả mơ hồ, yêu cầu phí từ ứng viên, thông tin công ty chưa đầy đủ.\n"
            "- Sửa theo lý do rồi gửi lại; hoàn thiện **Hồ sơ công ty** giúp tin được duyệt nhanh hơn."
        ),
    ),
)

_ADMIN_INTENTS: tuple[Intent, ...] = (
    Intent(
        "moderate",
        ("kiem duyet", "duyet tin", "tin dang", "tu choi tin", "cho duyet", "phe duyet", "tin vi pham"),
        lambda s: (
            "🛡️ **Quy trình kiểm duyệt tin đăng**\n"
            "1. Vào tab **Kiểm duyệt tin đăng**, xử lý theo thứ tự tin gửi sớm nhất.\n"
            "2. Kiểm tra: mức lương & ca làm rõ ràng, mô tả đúng thực tế, **không thu phí ứng viên**, hồ sơ công ty đầy đủ.\n"
            "3. **Duyệt** nếu đạt; **Từ chối** kèm lý do cụ thể để nhà tuyển dụng sửa và gửi lại.\n"
            "4. Tin có dấu hiệu lừa đảo: từ chối và xem xét khóa tài khoản nhà tuyển dụng."
            + (f"\n\n📌 Hiện có **{s.pending_jobs} tin** đang chờ duyệt." if s.available else "")
        ),
        ("Xử lý báo cáo khiếu nại thế nào?", "Khi nào nên khóa tài khoản?"),
    ),
    Intent(
        "reports",
        ("bao cao", "khieu nai", "to cao", "report", "vi pham"),
        lambda s: (
            "📮 **Xử lý báo cáo – khiếu nại**\n"
            "- Đọc lý do báo cáo, mở tin/tài khoản bị báo cáo để đối chiếu.\n"
            "- **Đã xử lý**: khi xác nhận vi phạm (ẩn tin, khóa tài khoản…) – ghi chú hướng xử lý.\n"
            "- **Từ chối**: khi báo cáo không có căn cứ – vẫn ghi chú để người báo cáo hiểu.\n"
            "- Ưu tiên báo cáo liên quan **thu phí/lừa đảo** và an toàn của sinh viên."
            + (f"\n\n📌 Hiện có **{s.pending_reports} báo cáo** chưa xử lý." if s.available else "")
        ),
    ),
    Intent(
        "users",
        ("khoa tai khoan", "mo khoa", "nguoi dung", "sinh vien", "nha tuyen dung", "quan ly tai khoan", "xac minh"),
        _txt(
            "👤 **Quản lý người dùng**\n"
            "- Tab **Quản lý sinh viên / Quản lý nhà tuyển dụng**: tìm theo tên hoặc email, xem hồ sơ chi tiết.\n"
            "- **Khóa** tài khoản khi có vi phạm đã xác minh (lừa đảo, spam, nội dung không phù hợp); có thể mở khóa sau.\n"
            "- Ưu tiên xác minh nhà tuyển dụng có hồ sơ công ty đầy đủ trước khi duyệt tin số lượng lớn."
        ),
    ),
    Intent(
        "categories",
        ("danh muc", "nganh nghe", "category", "them nganh"),
        lambda s: (
            "🗂️ **Danh mục ngành nghề**\n"
            "- Tab **Danh mục ngành nghề**: thêm, sửa tên/mô tả hoặc xóa danh mục.\n"
            "- Đặt tên ngắn, dễ hiểu với sinh viên; tránh tạo danh mục trùng ý.\n"
            "- Chỉ xóa danh mục không còn tin tuyển dụng đang dùng."
            + ("\n\n📌 Hiện tại: " + ", ".join(f"{n} ({c} tin)" for n, c in s.categories) + "." if s.categories else "")
        ),
    ),
    Intent(
        "roles",
        ("phan quyen", "cap quyen", "thu hoi quyen", "quan tri vien", "admin goc", "qtv"),
        _txt(
            "🔑 **Phân quyền quản trị**\n"
            "- Chỉ **Admin gốc** được cấp hoặc thu hồi quyền quản trị viên (tab **Phân quyền quản trị**).\n"
            "- Quản trị viên được cấp quyền có thể kiểm duyệt tin, quản lý người dùng và danh mục, nhưng không thể phân quyền.\n"
            "- Không cấp quyền cho tài khoản đang bị khóa; thu hồi quyền ngay khi thành viên rời nhóm vận hành."
        ),
    ),
    Intent(
        "stats",
        ("thong ke", "bao cao so lieu", "so lieu", "tong quan", "dashboard", "bieu do"),
        lambda s: (
            "📊 **Thống kê hệ thống**\n"
            "- Tab **Thống kê & báo cáo**: số người dùng, tin đăng theo trạng thái, hồ sơ ứng tuyển theo ngành.\n"
            "- Theo dõi tỉ lệ tin bị từ chối và số báo cáo tồn đọng để điều chỉnh tiêu chí duyệt."
            + (
                f"\n\n📌 Số liệu nhanh: {s.open_jobs} tin đang mở · {s.pending_jobs} tin chờ duyệt · "
                f"{s.pending_reports} báo cáo chưa xử lý."
                if s.available else ""
            )
        ),
    ),
)

ROLE_INTENTS = {"student": _STUDENT_INTENTS, "employer": _EMPLOYER_INTENTS, "admin": _ADMIN_INTENTS}

_DEFAULT_SUGGESTIONS = {
    "student": ["Gợi ý việc part-time buổi tối", "Cách viết CV khi chưa có kinh nghiệm?", "Sắp xếp lịch làm với lịch học"],
    "employer": ["Cách viết tin tuyển dụng hấp dẫn?", "Làm sao lọc ứng viên nhanh?", "Vì sao tin của tôi bị từ chối?"],
    "admin": ["Quy trình kiểm duyệt tin đăng", "Xử lý báo cáo khiếu nại thế nào?", "Xem thống kê hệ thống"],
}

_DEFAULT_SUGGESTIONS_EN = {
    "student": ["Find suitable part-time jobs", "Write a CV with no experience", "Balance work and class schedule"],
    "employer": ["How to write a great job post", "Screen candidates quickly", "Why was my job post rejected?"],
    "admin": ["Job moderation workflow", "How to handle violation reports", "Admin permission rules"],
}

_FALLBACK_ANSWERS_EN: dict[str, Callable[[SystemSnapshot], str]] = {
    "account": _txt(
        "🔐 **Account & Password**\n"
        "- Change password: go to **Account Settings** → enter your current password and new password (min 6 characters) → Save.\n"
        "- Locked account: contact HourGlass via **About → Contact** for Administrator support.\n"
        "- HourGlass will **never** ask for your password or OTP via chat."
    ),
    "about": _txt(
        "👋 I am **HourGlass AI Assistant**. HourGlass connects university students with flexible part-time jobs:\n"
        "- **Students**: browse, save, and apply for part-time jobs, manage CVs, availability, and work shifts.\n"
        "- **Employers**: post jobs (moderated by Admin before publishing), manage candidates via Kanban.\n"
        "- **Administrators**: moderate job postings, resolve violation reports, manage users and categories."
    ),
    "find_job": lambda s: (
        "🔎 **Finding Suitable Part-time Jobs on HourGlass**\n"
        "1. Go to **Find Jobs**, filter by *category*, *area*, and *salary*; prioritize listings with clear shift times.\n"
        "2. Register your **Available Shifts** in the Dashboard to match jobs with your class timetable.\n"
        "3. Click ♡ **Save Job** to compare listings, then apply to the 3–5 best matches.\n"
        "4. Check the employer's **reputation reviews** before accepting an offer."
        + (f"\n\n📌 HourGlass currently has **{s.open_jobs} open job postings**." if s.available and s.open_jobs else "")
    ),
    "cv": _txt(
        "📝 **Writing a Student Part-time CV** (1 page is ideal)\n"
        "- **Contact Info**: full name, phone, email, living area, university, major, and study year.\n"
        "- **Objective**: 1–2 sentences stating the target role and shifts you can work.\n"
        "- **Experience**: if you have no prior jobs, highlight student clubs, volunteering, or class projects with concrete results.\n"
        "- **Skills**: communication, office tools, languages… tailored to the job requirements.\n"
        "- Export as **PDF** (HourGlass accepts PDF/DOC/DOCX ≤ 5MB) and add a short cover note when applying."
    ),
    "schedule": _txt(
        "🗓️ **Balancing Class & Work Schedules**\n"
        "1. Register your weekly **Available Shifts** in the Dashboard so employers can schedule you easily.\n"
        "2. Once hired, track your shifts in **Work Schedule** and check for conflicts before confirming.\n"
        "3. Recommendation: work at most **15–20 hours/week** during the semester and leave buffer time before exams."
    ),
    "apply": _txt(
        "📨 **Applying & Tracking Applications**\n"
        "- Open a job listing → **Apply Now** → select a saved CV (or upload a new one) + write a short cover note.\n"
        "- Status flow: **Submitted → Received → Interview → Hired / Rejected**, tracked in *My Applications*.\n"
        "- You can **withdraw** an application while it is still pending review."
    ),
    "interview": _txt(
        "🎤 **Part-time Interview Preparation**\n"
        "- Review the job description carefully and prepare a 30-second self-introduction.\n"
        "- Common questions: *Which shifts can you commit to? Do you have relevant experience? How do you handle difficult situations?*\n"
        "- Don't hesitate to clarify **hourly wage, payment schedule, and training**."
    ),
    "safety": _txt(
        "⚠️ **Spotting Suspicious Job Postings**\n"
        "- Requests for **upfront deposits, uniform fees, or training fees** before starting are major scam red flags.\n"
        "- Watch out for unrealistic pay for simple tasks or vague workplace addresses.\n"
        "- Check employer ratings and click **Report** on any suspicious listing so Administrators can investigate."
    ),
    "post_job": lambda s: (
        "📢 **Writing an Attractive Student Job Posting**\n"
        "- **Title** = role + key highlight: *Evening Barista – 30K/hr – Near National University*.\n"
        "- **Description**: 3–5 bullet points of actual daily duties per shift.\n"
        "- **Shift & Salary**: clearly state shift hours, minimum shifts/week, and pay rate.\n"
        "- **Requirements**: keep only essential requirements; mention *'no experience required, training provided'* if applicable.\n"
        "- New posts stay in **Pending Moderation** until approved by an Admin; you can also **Save Draft**."
        + (f"\n\n📌 You currently have {s.my_jobs} job postings on HourGlass." if s.my_jobs is not None else "")
    ),
    "filter": _txt(
        "👥 **Screening & Managing Candidates**\n"
        "1. Open **Manage Candidates** → **Kanban** view, and filter by job position.\n"
        "2. Quick screening: shift availability match → distance to workplace → relevant skills/experience.\n"
        "3. Drag cards across **Received / Interview / Hired**; when selecting **Reject**, provide a clear reason for the student.\n"
        "4. Respond within **48 hours** to secure top student candidates."
    ),
    "rejected_post": _txt(
        "🛡️ **Pending or Rejected Job Postings**\n"
        "- Every new posting is reviewed by an Administrator; rejection reasons are shown in **Manage Job Posts**.\n"
        "- Common rejection reasons: unclear salary/shift hours, vague job description, charging fees to applicants, or incomplete company profile.\n"
        "- Edit the listing based on the feedback and resubmit for review."
    ),
    "moderate": lambda s: (
        "🛡️ **Job Post Moderation Workflow**\n"
        "1. Go to **Job Moderation** and review the earliest submitted listings first.\n"
        "2. Verify: clear salary & shift hours, realistic description, **no applicant fees**, and complete company profile.\n"
        "3. Click **Approve** if valid, or **Reject** with a specific reason so the employer can revise and resubmit."
        + (f"\n\n📌 There are currently **{s.pending_jobs} job postings** awaiting moderation." if s.available else "")
    ),
    "reports": lambda s: (
        "📮 **Handling Violation Reports**\n"
        "- Review the reporter's reason and inspect the reported job posting or account.\n"
        "- **Resolve**: when a violation is confirmed (optionally remove the violating job post) and send a resolution note.\n"
        "- **Dismiss**: when the report lacks evidence, providing a clear explanation note to the reporter."
        + (f"\n\n📌 There are currently **{s.pending_reports} pending reports**." if s.available else "")
    ),
    "users": _txt(
        "👤 **User Management**\n"
        "- Tabs **Manage Students / Manage Employers**: search by name or email and inspect account details.\n"
        "- **Lock** accounts when violations are confirmed (scams, spam, inappropriate content); accounts can be unlocked later.\n"
        "- Verify legitimate employers with complete company profiles."
    ),
    "categories": lambda s: (
        "🗂️ **Job Categories Management**\n"
        "- Tab **Job Categories**: add, edit name/description, or delete categories.\n"
        "- Keep category names concise and student-friendly; only categories with 0 linked job postings can be deleted."
    ),
    "roles": _txt(
        "🔑 **Admin Permissions**\n"
        "- Only the **Root Admin** can grant or revoke administrator privileges (tab **Admin Permissions**).\n"
        "- Granted administrators can moderate jobs and manage users/categories, but cannot modify admin permissions."
    ),
    "stats": lambda s: (
        "📊 **System Analytics**\n"
        "- Tab **Analytics & Reports**: tracks total users, approval rate, applications, and job postings by category."
        + (
            f"\n\n📌 Quick snapshot: {s.open_jobs} active jobs · {s.pending_jobs} pending jobs · "
            f"{s.pending_reports} pending reports."
            if s.available else ""
        )
    ),
}

_EN_KEYWORDS: dict[str, tuple[str, ...]] = {
    "account": ("password", "change password", "forgot password", "login", "sign in", "locked account"),
    "about": ("what is hourglass", "about hourglass", "who are you", "how to use", "help"),
    "find_job": ("find job", "part-time", "part time", "suitable job", "evening shift", "weekend job", "browse job"),
    "cv": ("write a cv", "no experience", "resume", "cover letter", "cover note", "upload cv"),
    "schedule": ("balance work", "class schedule", "work schedule", "free shift", "availability", "timetable", "shift"),
    "apply": ("apply", "application status", "withdraw", "submitted", "hired"),
    "interview": ("interview", "interview question", "prepare for interview"),
    "safety": ("scam", "spot job scam", "deposit", "fraud", "suspicious", "report"),
    "post_job": ("write a great job", "job post", "job description", "post a job", "attract student", "salary"),
    "filter": ("screen candidate", "manage candidate", "kanban", "filter candidate", "applicant"),
    "rejected_post": ("rejected", "why was my job", "not approved", "pending moderation"),
    "moderate": ("moderation workflow", "job moderation", "approve job", "reject job", "moderate"),
    "reports": ("violation report", "handle violation", "dispute", "complaint"),
    "users": ("lock an account", "when to lock", "unlock account", "manage user", "verify employer"),
    "categories": ("category", "categories", "add category"),
    "roles": ("admin permission", "grant admin", "revoke admin", "root admin", "permission rule"),
    "stats": ("analytics", "statistics", "system overview", "metrics"),
}

_GREETINGS = ("xin chao", "chao", "hello", "hi ", "hey", "alo")
_THANKS = ("cam on", "thank", "thanks", "tks")
_FOLLOW_UPS = ("chi tiet", "them nua", "noi them", "vi du", "con gi", "tiep di", "giai thich them", "cu the hon", "more detail", "tell me more", "example")


def _match_intent(text: str, role: str) -> Intent | None:
    norm = f" {normalize_text(text)} "
    best, best_score = None, 0
    for intent in ROLE_INTENTS.get(role, ()) + _COMMON_INTENTS:
        kws = intent.keywords + _EN_KEYWORDS.get(intent.key, ())
        score = sum(len(kw.split()) for kw in kws if f" {kw} " in norm or (len(kw) > 4 and kw in norm))
        if score > best_score:
            best, best_score = intent, score
    return best


def build_fallback_reply(role: str, message: str, history: list, snap: SystemSnapshot, lang: str = "vi") -> tuple[str, list[str]]:
    is_en = lang == "en"
    default_suggs = _DEFAULT_SUGGESTIONS_EN[role] if is_en else _DEFAULT_SUGGESTIONS[role]
    norm = f" {normalize_text(message)} "
    intent = _match_intent(message, role)

    def render_intent(it: Intent, include_more: bool = False) -> tuple[str, list[str]]:
        if is_en and it.key in _FALLBACK_ANSWERS_EN:
            return _FALLBACK_ANSWERS_EN[it.key](snap), list(default_suggs)
        extra = f"\n\n💡 {it.more}" if (include_more and it.more) else ""
        return it.answer(snap) + extra, list(it.suggestions or default_suggs)

    # Câu hỏi nối tiếp ("chi tiết hơn", "ví dụ?") → dùng chủ đề của câu hỏi trước
    if intent is None and any(f in norm for f in _FOLLOW_UPS):
        for item in reversed(history):
            if item.role == "user":
                prev = _match_intent(item.content, role)
                if prev:
                    return render_intent(prev, include_more=True)
                break

    if intent:
        return render_intent(intent)

    if is_en:
        role_en = {"student": "Student", "employer": "Employer", "admin": "Administrator"}[role]
        if any(f" {g.strip()} " in norm for g in _GREETINGS):
            return (
                f"Hello! 👋 I am **HourGlass AI Assistant**, supporting {role_en.lower()}s on HourGlass. "
                "Feel free to ask me anything or pick one of the suggested topics below.",
                default_suggs,
            )
        if any(t in norm for t in _THANKS):
            return "Happy to help! Let me know if you have any other questions. 😊", default_suggs

        topics_en = {
            "student": "finding part-time jobs, writing CVs, preparing for interviews, managing work shifts, and spotting job scams",
            "employer": "writing job postings, screening and interviewing candidates, and managing applications via Kanban",
            "admin": "moderating job postings, handling violation reports, managing users, categories, permissions, and analytics",
        }[role]
        return (
            f"I'm not sure I understood your question. For the **{role_en}** role, I can help with: {topics_en}. "
            "Please try asking more specifically or choose a suggestion below.",
            default_suggs,
        )

    label = ROLE_LABELS[role]
    if any(f" {g.strip()} " in norm for g in _GREETINGS):
        return (
            f"Xin chào! 👋 Mình là **HourGlass AI Assistant**, hỗ trợ {label.lower()} trên HourGlass. "
            "Bạn có thể hỏi mình theo các gợi ý bên dưới nhé.",
            default_suggs,
        )
    if any(t in norm for t in _THANKS):
        return "Rất vui được hỗ trợ bạn! Nếu cần thêm gì, cứ hỏi mình nhé. 😊", default_suggs

    topics = {
        "student": "tìm việc part-time, viết CV, chuẩn bị phỏng vấn, sắp xếp lịch làm và nhận diện tin lừa đảo",
        "employer": "viết tin tuyển dụng, lọc và phỏng vấn ứng viên, quản lý hồ sơ bằng Kanban",
        "admin": "kiểm duyệt tin, xử lý báo cáo, quản lý người dùng, danh mục, phân quyền và thống kê",
    }[role]
    return (
        f"Mình chưa hiểu rõ câu hỏi này. Ở vai trò **{label}**, mình có thể hỗ trợ: {topics}. "
        "Bạn thử hỏi cụ thể hơn hoặc chọn một gợi ý bên dưới nhé.",
        default_suggs,
    )


# ═══════════════════════ 6. HÀM PUBLIC ═══════════════════════
def _user_role(user: "User | None") -> str | None:
    if user is None:
        return None
    value = getattr(getattr(user, "role", None), "value", getattr(user, "role", None))
    value = str(value or "").lower()
    if value in ("employer", "recruiter"):
        return "employer"
    return value if value in ("student", "admin") else None


def resolve_role(requested: str, user: "User | None") -> str:
    """Có JWT → luôn dùng vai trò thật (sinh viên không thể "mượn" chế độ Admin)."""
    return _user_role(user) or (requested if requested in ROLE_LABELS else "student")


def generate_ai_reply(db: "Session | None", payload: AIChatRequest, user: "User | None" = None) -> AIChatResponse:
    """Trả lời một câu hỏi. Mọi lỗi đều được hạ cấp về chế độ dự phòng – không bao giờ ném ngoại lệ."""
    role = "student"
    lang = getattr(payload, "lang", "vi") or "vi"
    is_en = lang == "en"
    default_suggs_map = _DEFAULT_SUGGESTIONS_EN if is_en else _DEFAULT_SUGGESTIONS
    try:
        role = resolve_role(payload.role, user)
        snap = collect_system_snapshot(db, user)
        cfg = get_ai_config()

        notice = NOTICE_NO_KEY
        if cfg.enabled:
            cooldown = _active_cooldown()
            if cooldown:
                notice = NOTICE_QUOTA if cooldown == "quota" else NOTICE_ERROR
            else:
                try:
                    reply = call_llm(cfg, build_system_prompt(role, snap, lang=lang), payload.history, payload.message)
                    intent = _match_intent(payload.message, role)
                    suggs = (
                        default_suggs_map[role]
                        if is_en
                        else (list(intent.suggestions) if intent and intent.suggestions else default_suggs_map[role])
                    )
                    return AIChatResponse(
                        reply=reply,
                        role=role,
                        source="llm",
                        provider=cfg.provider,
                        model=cfg.model,
                        suggestions=suggs,
                    )
                except AIProviderError as exc:
                    logger.warning("AI provider %s failed (%s): %s", cfg.provider, exc.kind, exc)
                    if exc.kind == "quota":
                        _set_cooldown("quota", 60)
                        notice = NOTICE_QUOTA
                    elif exc.kind == "auth":
                        _set_cooldown("auth", 300)
                        notice = NOTICE_ERROR
                    else:
                        notice = NOTICE_ERROR

        reply, suggestions = build_fallback_reply(role, payload.message, payload.history, snap, lang=lang)
        return AIChatResponse(reply=reply, role=role, source="fallback", suggestions=suggestions, notice=notice)
    except Exception as exc:  # lưới an toàn cuối cùng
        logger.exception("AI assistant unexpected error: %s", exc)
        return AIChatResponse(
            reply=(
                "Sorry, the assistant is temporarily busy. Please try again in a moment or pick a suggestion below."
                if is_en
                else "Xin lỗi, trợ lý đang bận một chút. Bạn có thể thử lại sau ít phút, hoặc chọn một gợi ý bên dưới nhé."
            ),
            role=role if role in ROLE_LABELS else "student",
            source="fallback",
            suggestions=default_suggs_map.get(role, default_suggs_map["student"]),
            notice=NOTICE_ERROR,
        )


def get_ai_status() -> AIStatusResponse:
    cfg = get_ai_config()
    if not cfg.enabled:
        return AIStatusResponse(enabled=False, mode="fallback", message=NOTICE_NO_KEY)
    cooldown = _active_cooldown()
    if cooldown:
        return AIStatusResponse(
            enabled=True,
            mode="fallback",
            provider=cfg.provider,
            model=cfg.model,
            message=NOTICE_QUOTA if cooldown == "quota" else NOTICE_ERROR,
        )
    return AIStatusResponse(
        enabled=True,
        mode="llm",
        provider=cfg.provider,
        model=cfg.model,
        message=f"Trợ lý AI đang dùng {cfg.provider} · {cfg.model}.",
    )
