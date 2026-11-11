from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from apps.models.user import RoleEnum


# ── Auth ──────────────────────────────────────────────────
class RegisterForm(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: Optional[str] = "student"


class LoginUser(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── User response ────────────────────────────────────────
class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: RoleEnum
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Profiles ─────────────────────────────────────────────
class StudentProfileUpdate(BaseModel):
    university: Optional[str] = None
    major: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    avatar_url: Optional[str] = None


class StudentProfileResponse(BaseModel):
    id: int
    user_id: int
    university: Optional[str] = None
    major: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class EmployerProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    representative_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None


class EmployerProfileResponse(BaseModel):
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

    model_config = {"from_attributes": True}
