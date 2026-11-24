"""
Kiểm thử HỒI QUY toàn diện sau khi ghép API cho 3 vai trò: Nhà tuyển dụng, Admin, Sinh viên.

Kịch bản chạy tuần tự trên 1 database SQLite tạm (nạp seed mới mỗi lần chạy):

  [NTD] Đăng nhập -> Upload ảnh tin -> Tạo tin tuyển dụng (kèm ảnh) -> Tin chờ duyệt chưa công khai
  [AD ] Đăng nhập -> Chụp số liệu ban đầu -> Duyệt tin vừa tạo
  [SV ] Đăng nhập -> Tìm kiếm & lọc tin đã duyệt -> Nộp đơn kèm upload CV PDF (file tải lại được)
        -> Chặn nộp trùng -> Cập nhật hồ sơ cá nhân -> Gửi đánh giá -> Gửi khiếu nại
  [NTD] Xem danh sách ứng viên của tin (kèm link CV) -> KPI nhà tuyển dụng
  [AD ] Tiếp nhận khiếu nại -> Xử lý (giải quyết + gỡ tin) -> Kiểm tra số liệu thống kê Dashboard
  [PQ ] Kiểm tra phân quyền hồi quy (SV không duyệt tin, không sửa hồ sơ người khác…)

Mỗi bước in [PASS]/[FAIL]/[SKIP] kèm mã bước; cuối cùng in bảng tổng kết.
Bước phụ thuộc kết quả bước trước sẽ SKIP (kèm lý do) nếu bước đó lỗi, tránh lỗi dây chuyền.

Chạy (từ thư mục backend/):
    python tests/test_regression_roles.py            # unittest, in báo cáo
    python -m pytest tests/test_regression_roles.py -v
    python -m pytest tests -v                        # cùng các test cũ (báo cáo in ở cuối nhờ tests/conftest.py)

Không cần server đang chạy, không cần httpx: gọi trực tiếp ứng dụng ASGI (FastAPI).
File upload sinh ra trong backend/uploads được dọn sạch sau khi chạy.
"""

import asyncio
import json
import os
import sys
import tempfile
import time
import unittest
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# DB tạm, đặt TRƯỚC khi import app (không đụng tới backend/hourglass.db thật)
_TMP_DIR = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
# Luôn ép dùng SQLite tạm – kể cả khi shell đang export DATABASE_URL trỏ tới MySQL thật
os.environ["DATABASE_URL"] = f"sqlite:///{(Path(_TMP_DIR.name) / 'regression.db').as_posix()}"

import app.models  # noqa: E402, F401
from app.core.paths import UPLOAD_DIR  # noqa: E402
from app.db.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from seed_data import seed_database  # noqa: E402

PASSWORD = "123456"
EMPLOYER_EMAIL = "employer1@gmail.com"
ADMIN_EMAIL = "admin@gmail.com"
STUDENT_EMAIL = "student1@gmail.com"
OTHER_STUDENT_EMAIL = "student2@gmail.com"

# 1x1 PNG hợp lệ & PDF tối giản
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)
PDF_BYTES = b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"


# ═══════════════════════ HTTP CLIENT (ASGI trực tiếp) ═══════════════════════
class Response:
    def __init__(self, status: int, headers: dict, body: bytes):
        self.status = status
        self.headers = headers
        self.body = body
        try:
            self.json = json.loads(body.decode("utf-8")) if body else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.json = {}

    def short(self) -> str:
        detail = self.json.get("detail") if isinstance(self.json, dict) else None
        return f"HTTP {self.status}" + (f" – {detail}" if detail else "")


async def _asgi(method, path, query="", body=b"", headers=None) -> Response:
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": method.upper(), "scheme": "http", "path": path,
        "raw_path": path.encode(), "query_string": query.encode(),
        "headers": headers or [], "client": ("127.0.0.1", 50000), "server": ("testserver", 80),
        "root_path": "",
    }
    sent, done = False, asyncio.Event()
    status, resp_headers, chunks = 500, {}, []

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        await done.wait()
        return {"type": "http.disconnect"}

    async def send(message):
        nonlocal status, resp_headers
        if message["type"] == "http.response.start":
            status = message["status"]
            resp_headers = {k.decode().lower(): v.decode() for k, v in message.get("headers", [])}
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                done.set()

    await fastapi_app(scope, receive, send)
    return Response(status, resp_headers, b"".join(chunks))


def _multipart(fields: dict, files: dict) -> tuple[bytes, str]:
    boundary = f"----HGRegression{uuid4().hex}"
    parts = []
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    for name, (filename, content, ctype) in files.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
            f"Content-Type: {ctype}\r\n\r\n".encode() + content + b"\r\n"
        )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def api(method, path, payload=None, token=None, query="", files=None, form=None) -> Response:
    headers, body = [], b""
    if files is not None or form is not None:
        body, ctype = _multipart(form or {}, files or {})
        headers += [(b"content-type", ctype.encode()), (b"content-length", str(len(body)).encode())]
    elif payload is not None:
        body = json.dumps(payload).encode()
        headers.append((b"content-type", b"application/json"))
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    return asyncio.run(_asgi(method, path, query=query, body=body, headers=headers))


# ═══════════════════════ GHI NHẬN KẾT QUẢ TỪNG BƯỚC ═══════════════════════
REPORT: list[dict] = []          # được tests/conftest.py đọc để in tổng kết khi chạy bằng pytest
_ROLE = {"NTD": "Nhà tuyển dụng", "AD": "Admin", "SV": "Sinh viên", "PQ": "Phân quyền"}


def _log(line: str) -> None:
    try:
        sys.__stdout__.write(line + "\n")
        sys.__stdout__.flush()
    except Exception:
        print(line)


def step(code: str, title: str, needs: tuple = ()):
    """Decorator: ghi PASS/FAIL/SKIP cho một bước. `needs` = các khóa state bắt buộc từ bước trước."""

    def deco(fn):
        def wrapper(self):
            missing = [k for k in needs if self.state.get(k) is None]
            if missing:
                reason = "thiếu dữ liệu từ bước trước: " + ", ".join(missing)
                REPORT.append({"code": code, "title": title, "status": "SKIP", "note": reason, "ms": 0})
                _log(f"  [SKIP] {code:<7} {title} – {reason}")
                raise unittest.SkipTest(reason)
            t0 = time.perf_counter()
            try:
                note = fn(self)
            except unittest.SkipTest:
                raise
            except AssertionError as exc:
                ms = (time.perf_counter() - t0) * 1000
                msg = str(exc).splitlines()[0][:220]
                REPORT.append({"code": code, "title": title, "status": "FAIL", "note": msg, "ms": ms})
                _log(f"  [FAIL] {code:<7} {title} – {msg}")
                raise
            except Exception as exc:  # lỗi bất ngờ (500, exception Python…)
                ms = (time.perf_counter() - t0) * 1000
                msg = f"{type(exc).__name__}: {exc}"[:220]
                REPORT.append({"code": code, "title": title, "status": "FAIL", "note": msg, "ms": ms})
                _log(f"  [FAIL] {code:<7} {title} – {msg}")
                raise
            ms = (time.perf_counter() - t0) * 1000
            REPORT.append({"code": code, "title": title, "status": "PASS", "note": note or "", "ms": ms})
            _log(f"  [PASS] {code:<7} {title}" + (f" – {note}" if note else ""))

        wrapper.__name__ = fn.__name__
        wrapper.__doc__ = f"{code} – {title}"
        return wrapper

    return deco


def format_report() -> str:
    if not REPORT:
        return ""
    line = "=" * 96
    out = [line, " BÁO CÁO KIỂM THỬ HỒI QUY – HourGlass (Sinh viên · Nhà tuyển dụng · Admin)", line]
    out.append(f" {'KẾT QUẢ':<8}{'MÃ':<9}{'BƯỚC KIỂM THỬ':<58}{'THỜI GIAN':>10}")
    out.append("-" * 96)
    for r in REPORT:
        out.append(f" {r['status']:<8}{r['code']:<9}{r['title'][:57]:<58}{r['ms']:>8.0f}ms")
        if r["status"] != "PASS" and r["note"]:
            out.append(f" {'':<17}↳ {r['note']}")
    out.append("-" * 96)
    for prefix, name in _ROLE.items():
        rows = [r for r in REPORT if r["code"].startswith(prefix + "-")]
        if rows:
            ok = sum(r["status"] == "PASS" for r in rows)
            out.append(f" {name:<16}: {ok}/{len(rows)} PASS")
    total = len(REPORT)
    passed = sum(r["status"] == "PASS" for r in REPORT)
    failed = sum(r["status"] == "FAIL" for r in REPORT)
    skipped = total - passed - failed
    verdict = "ĐẠT" if failed == 0 and skipped == 0 else "CHƯA ĐẠT"
    out.append(f" TỔNG CỘNG      : {passed} PASS · {failed} FAIL · {skipped} SKIP / {total} bước  =>  {verdict}")
    out.append(line)
    return "\n".join(out)


# ═══════════════════════ KỊCH BẢN HỒI QUY ═══════════════════════
class RegressionAllRoles(unittest.TestCase):
    """Các bước chạy theo thứ tự tên (test_01, test_02…); dùng chung `state` giữa các bước."""

    state: dict = {}
    created_files: list = []
    longMessage = False          # thông báo lỗi chỉ gồm mô tả tiếng Việt, không kèm "404 != 201 :"

    @classmethod
    def setUpClass(cls):
        # Chốt an toàn: chỉ drop/seed khi engine trỏ vào file SQLite nằm trong thư mục tạm
        # (nếu module test khác đã khởi tạo engine trước, đó cũng là DB tạm của chính nó).
        url = engine.url
        db_file = Path(url.database or "").resolve() if url.get_backend_name() == "sqlite" else None
        tmp_root = Path(tempfile.gettempdir()).resolve()
        if db_file is None or tmp_root not in db_file.parents:
            raise RuntimeError(f"Từ chối chạy kiểm thử hồi quy trên database không phải SQLite tạm: {url!r}")
        REPORT.clear()
        cls.state = {}
        cls.created_files = []
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
        boot = api("GET", "/api/bootstrap").json
        cls.boot = boot
        _log(f"\n▶ Kiểm thử hồi quy HourGlass – DB tạm: {db_file}")

    @classmethod
    def tearDownClass(cls):
        for p in cls.created_files:
            try:
                if p.exists():
                    p.unlink()
            except OSError:
                pass
        engine.dispose()
        _log("\n" + format_report())

    # ---------- tiện ích ----------
    def login(self, email):
        r = api("POST", "/api/auth/login", {"email": email, "password": PASSWORD})
        self.assertEqual(r.status, 200, f"Đăng nhập {email} thất bại: {r.short()}")
        self.assertTrue(r.json.get("access_token"), "Không nhận được access_token")
        self.assertEqual(r.json["user"]["email"], email)
        return r.json["access_token"], r.json["user"]

    def track_upload(self, url: str):
        if url and url.startswith("/uploads/"):
            self.created_files.append(UPLOAD_DIR / url[len("/uploads/"):])

    def expect(self, resp: Response, code: int, what: str):
        self.assertEqual(resp.status, code, f"{what}: mong đợi HTTP {code}, nhận {resp.short()}")

    # ════════════ NHÀ TUYỂN DỤNG – PHẦN 1 ════════════
    @step("NTD-01", "Nhà tuyển dụng đăng nhập (JWT)")
    def test_01_employer_login(self):
        token, user = self.login(EMPLOYER_EMAIL)
        self.assertEqual(user["role"], "employer")
        ep = next((e for e in self.boot["employer_profiles"] if e["user_id"] == user["id"]), None)
        self.assertIsNotNone(ep, "Không tìm thấy hồ sơ doanh nghiệp của tài khoản")
        self.state.update(emp_token=token, emp_user=user, recruiter_id=ep["id"], company=ep["company_name"])
        return f"{user['email']} · employer_profiles.id={ep['id']}"

    @step("NTD-02", "Upload ảnh tin tuyển dụng (PNG) & tải lại qua /uploads", needs=("emp_token",))
    def test_02_employer_upload_image(self):
        r = api("POST", "/api/jobs/upload-image", token=self.state["emp_token"],
                files={"file": ("banner_regression.png", PNG_BYTES, "image/png")})
        self.expect(r, 201, "Upload ảnh")
        rel = r.json.get("relative_url", "")
        self.track_upload(rel)
        self.assertTrue(rel.startswith("/uploads/jobs/") and rel.endswith(".png"), f"relative_url sai: {rel}")
        self.assertTrue((UPLOAD_DIR / rel[len('/uploads/'):]).is_file(), "File ảnh không nằm trong backend/uploads/jobs")
        served = api("GET", rel)
        self.expect(served, 200, "Tải lại ảnh qua StaticFiles")
        self.assertEqual(served.body, PNG_BYTES, "Nội dung ảnh tải về khác file đã upload")
        # Định dạng không hợp lệ bị từ chối
        bad = api("POST", "/api/jobs/upload-image", token=self.state["emp_token"],
                  files={"file": ("virus.exe", b"MZ", "application/octet-stream")})
        self.expect(bad, 400, "Upload sai định dạng")
        self.state["image_url"] = rel
        return rel

    @step("NTD-03", "Tạo tin tuyển dụng mới kèm ảnh (trạng thái chờ duyệt)", needs=("emp_token", "image_url"))
    def test_03_employer_create_job(self):
        uniq = uuid4().hex[:6].upper()
        title = f"Barista hồi quy {uniq}"
        payload = {
            "recruiter_id": self.state["recruiter_id"], "category_id": 1, "location_id": 2,
            "title": title, "description": "Pha chế đồ uống và phục vụ khách hàng tại quầy, ca tối cuối tuần.",
            "requirements": "Nhanh nhẹn; giao tiếp tốt", "salary_min": 26000, "salary_max": 32000,
            "job_type": "part-time", "work_time": "Ca tối 18:00 - 22:00", "quantity": 3,
            "experience_level": "Không yêu cầu", "benefits": "Ăn ca; thưởng lễ",
            "end_date": (date.today() + timedelta(days=30)).isoformat(),
            "image_url": self.state["image_url"], "status": "pending",
        }
        r = api("POST", "/api/jobs", payload, token=self.state["emp_token"])
        self.expect(r, 201, "Tạo tin")
        job = r.json["job"]
        self.assertEqual(job["status"], "pending")
        self.assertEqual(job["image_url"], self.state["image_url"], "Tin không lưu image_url đã upload")
        detail = api("GET", f"/api/jobs/{job['id']}")
        self.expect(detail, 200, "Xem chi tiết tin")
        self.assertEqual(detail.json["job"]["image_url"], self.state["image_url"])
        self.state.update(job_id=job["id"], job_title=title, keyword=uniq)
        return f"jobs.id={job['id']} · “{title}”"

    @step("NTD-04", "Tin chờ duyệt chưa xuất hiện ở tìm kiếm công khai", needs=("job_id",))
    def test_04_pending_job_hidden(self):
        r = api("GET", "/api/jobs", query=f"keyword={self.state['keyword']}")
        self.expect(r, 200, "Tìm kiếm công khai")
        self.assertNotIn(self.state["job_id"], [j["id"] for j in r.json["jobs"]], "Tin chưa duyệt bị lộ ra công khai")

    # ════════════ ADMIN – PHẦN 1 ════════════
    @step("AD-01", "Admin đăng nhập & chụp số liệu thống kê ban đầu")
    def test_05_admin_login_and_baseline(self):
        token, user = self.login(ADMIN_EMAIL)
        self.assertEqual(user["role"], "admin")
        r = api("GET", "/api/admin/statistics", token=token)
        self.expect(r, 200, "Thống kê ban đầu")
        ap = next(a for a in self.boot["admin_profiles"] if a["user_id"] == user["id"])
        self.state.update(admin_token=token, admin_user=user, admin_profile_id=ap["id"], stats0=r.json["statistics"])
        s = r.json["statistics"]
        return f"jobs={s['jobs']['total']} · đơn={s['applications']['total']} · khiếu nại={s['reports']['total']}"

    @step("AD-02", "Admin thấy tin mới trong hàng chờ & duyệt tin", needs=("admin_token", "job_id"))
    def test_06_admin_approve_job(self):
        queue = api("GET", "/api/admin/jobs", query="status=pending&limit=100", token=self.state["admin_token"])
        self.expect(queue, 200, "Hàng chờ duyệt")
        self.assertIn(self.state["job_id"], [j["id"] for j in queue.json["jobs"]], "Tin mới không có trong hàng chờ")
        r = api("PATCH", f"/api/admin/jobs/{self.state['job_id']}/review",
                {"status": "approved", "approved_by": self.state["admin_profile_id"]}, token=self.state["admin_token"])
        self.expect(r, 200, "Duyệt tin")
        self.assertEqual(r.json["job"]["status"], "approved")
        self.state["approved"] = True

    # ════════════ SINH VIÊN ════════════
    @step("SV-01", "Sinh viên đăng nhập")
    def test_07_student_login(self):
        token, user = self.login(STUDENT_EMAIL)
        self.assertEqual(user["role"], "student")
        sp = next(s for s in self.boot["student_profiles"] if s["user_id"] == user["id"])
        self.state.update(st_token=token, st_user=user, student_id=sp["id"])
        return f"{user['email']} · student_profiles.id={sp['id']}"

    @step("SV-02", "Tìm kiếm & lọc tin đã duyệt (từ khóa, danh mục, khu vực, hình thức)", needs=("st_token", "approved"))
    def test_08_student_search_filter(self):
        jid, kw = self.state["job_id"], self.state["keyword"]
        ids = lambda q: [j["id"] for j in api("GET", "/api/jobs", query=q).json.get("jobs", [])]  # noqa: E731
        self.assertIn(jid, ids(f"keyword={kw}"), "Không tìm thấy tin theo từ khóa")
        self.assertIn(jid, ids(f"keyword={kw}&category_id=1&location_id=2&job_type=part-time"), "Lọc kết hợp làm mất tin")
        self.assertNotIn(jid, ids(f"keyword={kw}&category_id=2"), "Lọc sai danh mục vẫn trả về tin")
        self.assertNotIn(jid, ids(f"keyword={kw}&job_type=internship"), "Lọc sai hình thức vẫn trả về tin")
        everything = api("GET", "/api/jobs", query="limit=200").json["jobs"]
        self.assertTrue(everything and all(j["status"] == "approved" for j in everything), "Danh sách công khai lẫn tin chưa duyệt")
        bad = api("GET", "/api/jobs", query="status=khong-hop-le")
        self.expect(bad, 400, "Trạng thái lọc không hợp lệ")
        return f"{len(everything)} tin công khai, tất cả 'approved'"

    @step("SV-03", "Nộp đơn ứng tuyển kèm upload CV PDF; CV tải lại được", needs=("st_token", "approved"))
    def test_09_student_apply_with_cv(self):
        r = api("POST", "/api/applications", token=self.state["st_token"],
                form={"job_id": str(self.state["job_id"]), "student_id": str(self.state["student_id"]),
                      "cover_letter": "Em có kinh nghiệm pha chế 6 tháng, có thể làm ca tối."},
                files={"cv_file": ("CV_Regression.pdf", PDF_BYTES, "application/pdf")})
        self.expect(r, 201, "Nộp đơn")
        app_ = r.json["application"]
        cv_url = app_.get("cv_url") or ""
        self.track_upload(cv_url)
        self.assertEqual(app_["status_name"], "submitted")
        self.assertTrue(cv_url.startswith("/uploads/cv_") and cv_url.endswith(".pdf"), f"cv_url sai: {cv_url}")
        served = api("GET", cv_url)
        self.expect(served, 200, "Tải lại CV qua /uploads")
        self.assertEqual(served.body, PDF_BYTES, "Nội dung CV tải về khác file đã nộp")
        self.state.update(application_id=app_["id"], cv_url=cv_url)
        return f"applications.id={app_['id']} · {cv_url}"

    @step("SV-04", "Chặn nộp trùng & chặn file CV sai định dạng", needs=("application_id",))
    def test_10_student_apply_rules(self):
        dup = api("POST", "/api/applications/json", token=self.state["st_token"],
                  payload={"student_id": self.state["student_id"], "job_id": self.state["job_id"],
                           "cv_url": self.state["cv_url"]})
        self.expect(dup, 409, "Nộp trùng")
        _, other = self.login(OTHER_STUDENT_EMAIL)
        sid2 = next(s["id"] for s in self.boot["student_profiles"] if s["user_id"] == other["id"])
        bad = api("POST", "/api/applications", form={"job_id": str(self.state["job_id"]), "student_id": str(sid2)},
                  files={"cv_file": ("cv.txt", b"plain text", "text/plain")})
        self.expect(bad, 400, "CV sai định dạng")

    @step("SV-05", "Cập nhật hồ sơ cá nhân & dữ liệu được lưu bền", needs=("st_token",))
    def test_11_student_update_profile(self):
        sid = self.state["student_id"]
        payload = {"full_name": "Nguyễn Văn An (HQ)", "phone": "0912345678", "university": "ĐH Bách khoa Hà Nội",
                   "major": "Khoa học máy tính", "address": "Hai Bà Trưng, Hà Nội", "bio": "Thích pha chế.",
                   "date_of_birth": "2004-05-06"}
        r = api("PUT", f"/api/students/{sid}", payload, token=self.state["st_token"])
        self.expect(r, 200, "Cập nhật hồ sơ")
        self.assertEqual(r.json["student"]["university"], payload["university"])
        boot = api("GET", "/api/bootstrap").json
        sp = next(s for s in boot["student_profiles"] if s["id"] == sid)
        u = next(x for x in boot["users"] if x["id"] == self.state["st_user"]["id"])
        self.assertEqual((sp["university"], sp["major"], sp["date_of_birth"]),
                         (payload["university"], payload["major"], payload["date_of_birth"]), "Hồ sơ không được lưu")
        self.assertEqual((u["full_name"], u["phone"]), (payload["full_name"], payload["phone"]), "Họ tên/SĐT không được lưu")
        bad = api("PUT", f"/api/students/{sid}", {"date_of_birth": "06/05/2004"}, token=self.state["st_token"])
        self.expect(bad, 400, "Ngày sinh sai định dạng")
        dup_email = api("PUT", f"/api/students/{sid}", {"email": OTHER_STUDENT_EMAIL}, token=self.state["st_token"])
        self.expect(dup_email, 409, "Đổi sang email đã tồn tại")

    @step("SV-06", "Gửi đánh giá nhà tuyển dụng; điểm uy tín cập nhật; chặn đánh giá trùng",
          needs=("st_token", "emp_user", "job_id"))
    def test_12_student_review(self):
        target = self.state["emp_user"]["id"]
        before = api("GET", f"/api/users/{target}/reputation").json["total_reviews"]
        body = {"reviewer_id": self.state["st_user"]["id"], "target_id": target, "job_id": self.state["job_id"],
                "rating": 4, "comment": "Quản lý thân thiện, trả lương đúng hẹn."}
        r = api("POST", "/api/reviews", body, token=self.state["st_token"])
        self.expect(r, 201, "Gửi đánh giá")
        rep = api("GET", f"/api/users/{target}/reputation").json
        self.assertEqual(rep["total_reviews"], before + 1, "Tổng số đánh giá không tăng")
        listed = api("GET", "/api/reviews", query=f"reviewer_id={body['reviewer_id']}&job_id={body['job_id']}")
        self.expect(listed, 200, "Danh sách đánh giá")
        self.assertEqual(listed.json["total"], 1)
        self.expect(api("POST", "/api/reviews", body, token=self.state["st_token"]), 409, "Đánh giá trùng")
        self.expect(api("POST", "/api/reviews", {**body, "rating": 6, "job_id": None}, token=self.state["st_token"]),
                    422, "Số sao ngoài 1–5")
        self.state["review_id"] = r.json["review"]["id"]
        return f"điểm TB {rep['average_rating']} / {rep['total_reviews']} đánh giá"

    @step("SV-07", "Gửi khiếu nại tin tuyển dụng; chặn khiếu nại trùng khi đang chờ", needs=("st_token", "job_id"))
    def test_13_student_report(self):
        body = {"reporter_id": self.state["st_user"]["id"], "report_type": "job", "target_id": self.state["job_id"],
                "reason": "Tin yêu cầu đặt cọc đồng phục trước khi đi làm."}
        r = api("POST", "/api/reports", body, token=self.state["st_token"])
        self.expect(r, 201, "Gửi khiếu nại")
        self.assertEqual(r.json["report"]["status"], "pending")
        self.expect(api("POST", "/api/reports", body, token=self.state["st_token"]), 409, "Khiếu nại trùng")
        self.expect(api("POST", "/api/reports", {**body, "reason": "abc"}, token=self.state["st_token"]), 422, "Lý do quá ngắn")
        mine = api("GET", f"/api/users/{body['reporter_id']}/reports", token=self.state["st_token"])
        self.expect(mine, 200, "Khiếu nại của tôi")
        self.assertIn(r.json["report"]["id"], [x["id"] for x in mine.json["reports"]])
        self.state["report_id"] = r.json["report"]["id"]
        return f"reports.id={self.state['report_id']}"

    # ════════════ NHÀ TUYỂN DỤNG – PHẦN 2 ════════════
    @step("NTD-05", "Xem danh sách ứng viên của tin (kèm CV) & KPI nhà tuyển dụng",
          needs=("emp_token", "application_id"))
    def test_14_employer_view_candidates(self):
        r = api("GET", "/api/applications", query=f"job_id={self.state['job_id']}", token=self.state["emp_token"])
        self.expect(r, 200, "Danh sách ứng viên")
        apps = r.json["applications"]
        self.assertEqual(len(apps), 1, f"Mong đợi 1 ứng viên, nhận {len(apps)}")
        self.assertEqual(apps[0]["student_id"], self.state["student_id"])
        self.assertEqual(apps[0]["cv_url"], self.state["cv_url"], "Nhà tuyển dụng không thấy đúng CV")
        kpi = api("GET", f"/api/employer/{self.state['recruiter_id']}/statistics", token=self.state["emp_token"])
        self.expect(kpi, 200, "KPI nhà tuyển dụng")
        self.assertGreaterEqual(kpi.json["statistics"]["applications"]["new"], 1)
        mv = api("PATCH", f"/api/applications/{self.state['application_id']}/status",
                 {"status": "reviewing", "note": "Đã xem CV"}, token=self.state["emp_token"])
        self.expect(mv, 200, "Chuyển trạng thái hồ sơ")
        return f"1 ứng viên · KPI đơn mới={kpi.json['statistics']['applications']['new']}"

    # ════════════ ADMIN – PHẦN 2 ════════════
    @step("AD-03", "Admin tiếp nhận & xử lý khiếu nại (giải quyết + gỡ tin vi phạm)",
          needs=("admin_token", "report_id"))
    def test_15_admin_process_report(self):
        rid, tok = self.state["report_id"], self.state["admin_token"]
        pending = api("GET", "/api/admin/reports", query="status=pending&limit=100", token=tok)
        self.expect(pending, 200, "Danh sách khiếu nại chờ xử lý")
        self.assertIn(rid, [x["id"] for x in pending.json["reports"]], "Khiếu nại mới không có trong hàng chờ")
        r = api("PATCH", f"/api/admin/reports/{rid}",
                {"status": "resolved", "admin_note": "Đã xác minh, gỡ tin vi phạm.", "remove_job": True}, token=tok)
        self.expect(r, 200, "Xử lý khiếu nại")
        self.assertEqual(r.json["report"]["status"], "resolved")
        self.assertTrue(r.json["job_removed"], "Tin vi phạm không bị gỡ")
        job = api("GET", f"/api/jobs/{self.state['job_id']}").json["job"]
        self.assertEqual(job["status"], "rejected")
        public = api("GET", "/api/jobs", query=f"keyword={self.state['keyword']}").json["jobs"]
        self.assertEqual(public, [], "Tin đã gỡ vẫn hiển thị công khai")
        again = api("PATCH", f"/api/admin/reports/{rid}", {"status": "rejected", "admin_note": "x"}, token=tok)
        self.expect(again, 400, "Xử lý lại khiếu nại đã đóng")
        mine = api("GET", f"/api/users/{self.state['st_user']['id']}/reports", token=self.state["st_token"]).json["reports"]
        self.assertEqual(next(x for x in mine if x["id"] == rid)["admin_note"], "Đã xác minh, gỡ tin vi phạm.",
                         "Sinh viên không thấy phản hồi của Admin")
        self.state["report_resolved"] = True

    @step("AD-04", "Số liệu thống kê Dashboard Admin khớp với các thao tác",
          needs=("admin_token", "stats0", "report_resolved", "review_id"))
    def test_16_admin_dashboard_stats(self):
        r = api("GET", "/api/admin/statistics", token=self.state["admin_token"])
        self.expect(r, 200, "Thống kê sau kịch bản")
        s0, s1 = self.state["stats0"], r.json["statistics"]
        checks = {
            "jobs.total (không đổi – tin tạo trước mốc)": (s1["jobs"]["total"], s0["jobs"]["total"]),
            "jobs.pending (-1: tin đã được duyệt)": (s1["jobs"]["pending"], s0["jobs"]["pending"] - 1),
            "jobs.rejected (+1: tin bị gỡ)": (s1["jobs"]["rejected"], s0["jobs"]["rejected"] + 1),
            "jobs.approved (không đổi: duyệt rồi gỡ)": (s1["jobs"]["approved"], s0["jobs"]["approved"]),
            "applications.total (+1)": (s1["applications"]["total"], s0["applications"]["total"] + 1),
            "reports.total (+1)": (s1["reports"]["total"], s0["reports"]["total"] + 1),
            "reports.pending (không đổi: +1 rồi xử lý)": (s1["reports"]["pending"], s0["reports"]["pending"]),
            "reports.resolved (+1)": (s1["reports"]["resolved"], s0["reports"]["resolved"] + 1),
            "reviews.total (+1)": (s1["reviews"]["total"], s0["reviews"]["total"] + 1),
            "resources.cvs (+1: CV upload)": (s1["resources"]["cvs"], s0["resources"]["cvs"] + 1),
        }
        wrong = [f"{k}: thực tế {a} ≠ mong đợi {b}" for k, (a, b) in checks.items() if a != b]
        self.assertFalse(wrong, "; ".join(wrong))
        return f"{len(checks)} chỉ số khớp"

    # ════════════ PHÂN QUYỀN (hồi quy bảo mật sau khi ghép API) ════════════
    @step("PQ-01", "SV/NTD không được duyệt tin (kể cả tự duyệt khi đăng) & xem thống kê Admin",
          needs=("st_token", "emp_token", "job_id"))
    def test_17_rbac_admin_only(self):
        self_approve = api("POST", "/api/jobs", {
            "recruiter_id": self.state["recruiter_id"], "category_id": 1, "location_id": 2,
            "title": "Tin tự duyệt (không hợp lệ)", "description": "Nhà tuyển dụng cố tình gửi status approved.",
            "status": "approved"}, token=self.state["emp_token"])
        self.expect(self_approve, 403, "NTD tự duyệt tin khi đăng mới")
        body = {"status": "approved", "approved_by": 1}
        self.expect(api("PATCH", f"/api/admin/jobs/{self.state['job_id']}/review", body, token=self.state["st_token"]),
                    403, "SV duyệt tin")
        self.expect(api("PATCH", f"/api/admin/jobs/{self.state['job_id']}/review", body, token=self.state["emp_token"]),
                    403, "NTD duyệt tin")
        self.expect(api("GET", "/api/admin/statistics", token=self.state["st_token"]), 403, "SV xem thống kê Admin")

    @step("PQ-02", "Không sửa hồ sơ / gửi đánh giá, khiếu nại thay người khác", needs=("st_token", "emp_token"))
    def test_18_rbac_ownership(self):
        other = next(s for s in self.boot["student_profiles"] if s["id"] != self.state["student_id"])
        self.expect(api("PUT", f"/api/students/{other['id']}", {"bio": "hack"}, token=self.state["st_token"]),
                    403, "SV sửa hồ sơ SV khác")
        self.expect(api("POST", "/api/reviews", {"reviewer_id": other["user_id"], "target_id": self.state["emp_user"]["id"],
                                                 "rating": 1}, token=self.state["st_token"]), 403, "Đánh giá giả danh")
        self.expect(api("POST", "/api/reports", {"reporter_id": other["user_id"], "report_type": "employer",
                                                 "target_id": self.state["recruiter_id"], "reason": "Giả danh khiếu nại"},
                        token=self.state["st_token"]), 403, "Khiếu nại giả danh")

    @step("PQ-03", "NTD không tự xác minh doanh nghiệp qua cập nhật hồ sơ", needs=("emp_token", "admin_token"))
    def test_19_rbac_employer_verified(self):
        rid = self.state["recruiter_id"]
        self.expect(api("PATCH", f"/api/recruiters/{rid}/verify", {"verified": False}, token=self.state["admin_token"]),
                    200, "Admin hủy xác minh")
        r = api("PUT", f"/api/recruiters/{rid}", {"description": "Cập nhật mô tả", "verified": True},
                token=self.state["emp_token"])
        self.expect(r, 200, "NTD cập nhật hồ sơ")
        self.assertFalse(r.json["recruiter"]["verified"], "NTD tự bật được trạng thái 'đã xác minh'")
        self.assertEqual(r.json["recruiter"]["description"], "Cập nhật mô tả")


if __name__ == "__main__":
    result = unittest.main(verbosity=0, exit=False).result
    sys.exit(0 if result.wasSuccessful() else 1)
