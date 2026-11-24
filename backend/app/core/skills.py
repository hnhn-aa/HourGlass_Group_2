"""Chuẩn hóa trường `skills` (Kỹ năng & Thế mạnh) của hồ sơ sinh viên.

- Database: cột `student_profiles.skills` (TEXT) lưu CHUỖI JSON, VD: '["Tiếng Anh", "Canva"]'.
  NULL = sinh viên chưa từng lưu kỹ năng; '[]' = đã xóa hết.
- API: luôn nhận/trả MẢNG chuỗi (list[str]). Để tương thích, khi nhận vào cũng chấp nhận
  chuỗi JSON hoặc chuỗi phân tách bằng dấu phẩy ("Tiếng Anh, Canva").
"""
from __future__ import annotations

import json
import re
from typing import Any

MAX_SKILL_LENGTH = 40
MAX_SKILLS = 20


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_skills(value: Any) -> list[str] | None:
    """Đọc giá trị thô (list / chuỗi JSON / chuỗi phẩy / None) thành list[str] hoặc None."""
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        items = list(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            try:
                loaded = json.loads(text)
                items = loaded if isinstance(loaded, list) else [loaded]
            except ValueError:
                items = text.strip("[]").split(",")
        else:
            items = text.split(",")
    else:
        raise ValueError("Danh sách kỹ năng phải là mảng chuỗi")
    return [s for s in (_clean(x) for x in items if not isinstance(x, (dict, list))) if s]


def normalize_skills(value: Any) -> list[str] | None:
    """Kiểm tra & chuẩn hóa dữ liệu gửi lên: gộp khoảng trắng, bỏ trùng (không phân biệt hoa/thường)."""
    skills = parse_skills(value)
    if skills is None:
        return None
    result: list[str] = []
    seen: set[str] = set()
    for skill in skills:
        if len(skill) > MAX_SKILL_LENGTH:
            raise ValueError(f'Tên kỹ năng "{skill[:20]}…" vượt quá {MAX_SKILL_LENGTH} ký tự')
        key = skill.casefold()
        if key not in seen:
            seen.add(key)
            result.append(skill)
    if len(result) > MAX_SKILLS:
        raise ValueError(f"Chỉ được lưu tối đa {MAX_SKILLS} kỹ năng")
    return result


def dump_skills(skills: list[str] | None) -> str | None:
    """list[str] → chuỗi JSON để lưu DB (giữ nguyên tiếng Việt có dấu)."""
    return None if skills is None else json.dumps(skills, ensure_ascii=False)


def load_skills(raw: Any) -> list[str] | None:
    """Giá trị cột DB → list[str] (không bao giờ ném lỗi khi đọc dữ liệu cũ/hỏng)."""
    try:
        return parse_skills(raw)
    except ValueError:
        return []
