import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.skills import load_skills, normalize_skills
from app.models.user import RoleEnum, UserStatusEnum

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _strip_required_text(value: str, field_label: str, min_len: int = 1) -> str:
    cleaned = value.strip()
    if len(cleaned) < min_len:
        raise ValueError(f"{field_label} phải có ít nhất {min_len} ký tự hợp lệ")
    return cleaned


# ── Auth (Nhánh B) ────────────────────────────────────────
class RegisterForm(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: Optional[str] = "student"
    company_name: Optional[str] = None
    university: Optional[str] = None
    major: Optional[str] = None
    position: Optional[str] = None


class LoginUser(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── User Schemas (Tích hợp Nhánh A & Nhánh B) ─────────────
class UserCreateSchema(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150, examples=["Nguyễn Văn An"])
    email: str = Field(..., max_length=255, examples=["nguyenvanan@gmail.com"])
    password: str = Field(..., min_length=6, max_length=100, examples=["123456"])
    phone: str | None = Field(default=None, max_length=20, examples=["0987654321"])
    role: RoleEnum = Field(default=RoleEnum.STUDENT)
    company_name: str | None = Field(default=None, max_length=200)
    university: str | None = Field(default=None, max_length=200)
    major: str | None = Field(default=None, max_length=150)
    position: str | None = Field(default=None, max_length=150)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        return _strip_required_text(v, "Họ và tên", 2)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("Định dạng email không hợp lệ")
        return cleaned


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: RoleEnum
    status: UserStatusEnum | str
    created_at: datetime
    updated_at: Optional[datetime] = None


class UserOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone: str | None = None
    role: RoleEnum
    status: UserStatusEnum
    created_at: datetime
    updated_at: datetime | None = None


# ── Profiles (Tích hợp Nhánh A & Nhánh B) ─────────────────
class StudentProfileUpdate(BaseModel):
    university: Optional[str] = None
    major: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    avatar_url: Optional[str] = None
    skills: Optional[list[str]] = Field(
        default=None,
        description="Kỹ năng & Thế mạnh (mảng chuỗi, tối đa 20 mục, mỗi mục ≤ 40 ký tự)",
        examples=[["Tiếng Anh", "Pha chế", "Canva"]],
    )

    @field_validator("skills", mode="before")
    @classmethod
    def validate_skills(cls, value):
        return normalize_skills(value)


class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    university: Optional[str] = None
    major: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    avatar_url: Optional[str] = None
    skills: Optional[list[str]] = None  # null = chưa từng lưu kỹ năng
    full_name: Optional[str] = None
    email: Optional[str] = None

    @field_validator("skills", mode="before")
    @classmethod
    def parse_stored_skills(cls, value):
        # Dữ liệu từ ORM là chuỗi JSON → chuyển thành mảng
        return load_skills(value)


StudentProfileOutSchema = StudentProfileResponse


class EmployerProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    representative_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None


class EmployerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    company_name: str
    representative_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    verified: bool


RecruiterProfileOutSchema = EmployerProfileResponse
