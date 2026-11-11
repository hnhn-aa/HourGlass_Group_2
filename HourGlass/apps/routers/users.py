from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from apps.db.database import get_db
from apps.schemas.users import (
    RegisterForm, LoginUser, TokenResponse, RefreshTokenRequest,
    UserResponse, StudentProfileUpdate, StudentProfileResponse,
    EmployerProfileUpdate, EmployerProfileResponse,
)
from apps.services.auth_services import register_user, login_user
from apps.services.user_services import (
    get_student_profile, update_student_profile,
    get_employer_profile, update_employer_profile,
    get_all_users, get_user_by_id,
)
from apps.core.security import refresh_access_token
from apps.dependencies.middleware import (
    get_current_user, get_student_user, get_employer_user, get_admin_user,
)
from apps.models.user import User

router = APIRouter(prefix="/users", tags=["Users & Profiles"])


# ═══════════════════════ AUTH (TẤT CẢ) ═══════════════════
# Use case: Đăng ký / đăng nhập
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: RegisterForm, db: Session = Depends(get_db)):
    """Khách: Đăng ký tài khoản (student hoặc employer)."""
    return register_user(user, db)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginUser, db: Session = Depends(get_db)):
    """Đăng nhập – nhận access + refresh token."""
    return login_user(data, db)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshTokenRequest):
    """Làm mới token."""
    return refresh_access_token(body.refresh_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin tài khoản hiện tại."""
    return current_user


# ═══════════════════════ USE CASE: CẬP NHẬT HỒ SƠ CÁ NHÂN ═
# Sinh viên
@router.get("/profile/student", response_model=StudentProfileResponse)
def get_my_student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_student_user),
):
    """Sinh viên: Xem hồ sơ sinh viên của mình."""
    return get_student_profile(current_user, db)


@router.put("/profile/student", response_model=StudentProfileResponse)
def update_my_student_profile(
    data: StudentProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_student_user),
):
    """Sinh viên: Cập nhật hồ sơ sinh viên của mình."""
    return update_student_profile(current_user, data, db)


# Nhà tuyển dụng
@router.get("/profile/employer", response_model=EmployerProfileResponse)
def get_my_employer_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Xem hồ sơ doanh nghiệp."""
    return get_employer_profile(current_user, db)


@router.put("/profile/employer", response_model=EmployerProfileResponse)
def update_my_employer_profile(
    data: EmployerProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Cập nhật hồ sơ doanh nghiệp."""
    return update_employer_profile(current_user, data, db)


# ═══════════════════════ QUẢN TRỊ VIÊN ═══════════════════
# Use case: Quản lý người dùng
@router.get("/admin/users", response_model=list[UserResponse])
def admin_list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Quản lý danh sách người dùng toàn hệ thống."""
    return get_all_users(db)


@router.get("/admin/users/{user_id}", response_model=UserResponse)
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Xem chi tiết người dùng."""
    return get_user_by_id(user_id, db)

