from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import refresh_access_token
from app.db.database import get_db
from app.dependencies.middleware import (
    get_admin_user,
    get_current_user,
    get_employer_user,
    get_student_user,
    verify_admin_or_internal,
    verify_employer_or_internal,
    verify_student_or_internal,
)
from app.models.user import RoleEnum, User
from app.schemas.users import (
    EmployerProfileResponse,
    EmployerProfileUpdate,
    LoginUser,
    RecruiterProfileOutSchema,
    RefreshTokenRequest,
    RegisterForm,
    StudentProfileResponse,
    StudentProfileUpdate,
    TokenResponse,
    UserCreateSchema,
    UserOutSchema,
    UserResponse,
)
from app.services.auth_services import get_user_by_email, login_user, register_user
from app.services.user_services import (
    change_user_password,
    create_user as create_user_service,
    get_all_users,
    get_employer_profile,
    get_recruiters,
    get_student_profile,
    get_students,
    get_user_by_id,
    get_users as get_users_service,
    update_employer_profile,
    update_employer_profile_by_id,
    update_student_profile,
    update_student_profile_by_id,
    update_user_role,
    update_user_status,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


# ═══════════════════════ AUTH & PROFILE (Nhánh B: /users/...) ═══════════════════
@router.post(
    "/users/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Users & Profiles"],
)
def register(user: RegisterForm, db: Session = Depends(get_db)):
    """Khách: Đăng ký tài khoản (student hoặc employer)."""
    return register_user(user, db)


@router.post(
    "/users/login",
    response_model=TokenResponse,
    tags=["Users & Profiles"],
)
def login(data: LoginUser, db: Session = Depends(get_db)):
    """Đăng nhập – nhận access + refresh token."""
    return login_user(data, db)


@router.post(
    "/api/auth/login",
    tags=["Users & Profiles"],
    summary="Đăng nhập trả kèm thông tin user và JWT token cho Frontend",
)
def login_with_user(data: LoginUser, db: DbSession):
    tokens = login_user(data, db)
    user = get_user_by_email(data.email.strip().lower(), db)
    return {
        "success": True,
        **tokens,
        "user": UserOutSchema.model_validate(user) if user else None,
    }


@router.post(
    "/users/refresh",
    response_model=TokenResponse,
    tags=["Users & Profiles"],
)
def refresh(body: RefreshTokenRequest):
    """Làm mới token."""
    return refresh_access_token(body.refresh_token)


@router.get(
    "/users/me",
    response_model=UserResponse,
    tags=["Users & Profiles"],
)
def me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin tài khoản hiện tại."""
    return current_user


@router.get(
    "/users/profile/student",
    response_model=StudentProfileResponse,
    tags=["Users & Profiles"],
)
def get_my_student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_student_user),
):
    """Sinh viên: Xem hồ sơ sinh viên của mình."""
    return get_student_profile(current_user, db)


@router.put(
    "/users/profile/student",
    response_model=StudentProfileResponse,
    tags=["Users & Profiles"],
)
def update_my_student_profile(
    data: StudentProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_student_user),
):
    """Sinh viên: Cập nhật hồ sơ sinh viên của mình."""
    return update_student_profile(current_user, data, db)


@router.get(
    "/users/profile/employer",
    response_model=EmployerProfileResponse,
    tags=["Users & Profiles"],
)
def get_my_employer_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Xem hồ sơ doanh nghiệp."""
    return get_employer_profile(current_user, db)


@router.put(
    "/users/profile/employer",
    response_model=EmployerProfileResponse,
    tags=["Users & Profiles"],
)
def update_my_employer_profile(
    data: EmployerProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Cập nhật hồ sơ doanh nghiệp."""
    return update_employer_profile(current_user, data, db)


@router.get(
    "/users/admin/users",
    response_model=list[UserResponse],
    tags=["Users & Profiles"],
)
def admin_list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Quản lý danh sách người dùng toàn hệ thống."""
    return get_all_users(db)


@router.get(
    "/users/admin/users/{user_id}",
    response_model=UserResponse,
    tags=["Users & Profiles"],
)
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Xem chi tiết người dùng."""
    return get_user_by_id(user_id, db)


# ═══════════════════════ USERS & CATALOGS (Tích hợp từ Nhánh A: /api/...) ═════════
@router.post(
    "/api/users",
    status_code=status.HTTP_201_CREATED,
    tags=["Users"],
    summary="Tạo tài khoản và hồ sơ tương ứng (student / employer / admin)",
)
def create_user_api(user_data: UserCreateSchema, db: DbSession):
    user = create_user_service(db, user_data)
    return {"success": True, "user": UserOutSchema.model_validate(user)}


@router.get(
    "/api/users",
    tags=["Users"],
    summary="Danh sách tài khoản người dùng",
)
def get_users_api(
    db: DbSession,
    role: RoleEnum | None = Query(
        default=None, description="Lọc theo vai trò: student, employer, admin"
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    total, users = get_users_service(db, role=role, skip=skip, limit=limit)
    return {
        "success": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "users": [UserOutSchema.model_validate(u) for u in users],
    }


@router.get(
    "/api/users/{user_id}",
    tags=["Users"],
    summary="Chi tiết người dùng",
)
def get_user_detail_api(user_id: int, db: DbSession):
    user = get_user_by_id(db, user_id)
    return {"success": True, "user": UserOutSchema.model_validate(user)}


@router.post(
    "/api/users/{user_id}/change-password",
    tags=["Users"],
    summary="Đổi mật khẩu người dùng",
)
def change_password_api(
    user_id: int,
    db: DbSession,
    payload: dict = Body(...),
):
    user = change_user_password(
        db,
        user_id,
        str(payload.get("current_password") or ""),
        str(payload.get("new_password") or ""),
    )
    return {"success": True, "user": UserOutSchema.model_validate(user)}


@router.patch(
    "/api/users/{user_id}/status",
    tags=["Users"],
    summary="Admin khóa hoặc mở khóa tài khoản người dùng",
    dependencies=[Depends(verify_admin_or_internal)],
)
def patch_user_status_api(
    user_id: int,
    db: DbSession,
    payload: dict = Body(...),
):
    user = update_user_status(db, user_id, str(payload.get("status") or "active"))
    return {"success": True, "user": UserOutSchema.model_validate(user)}


@router.patch(
    "/api/users/{user_id}/role",
    tags=["Users"],
    summary="Admin gốc cấp hoặc thu hồi quyền quản trị viên",
    dependencies=[Depends(verify_admin_or_internal)],
)
def patch_user_role_api(
    user_id: int,
    db: DbSession,
    payload: dict = Body(...),
):
    user = update_user_role(db, user_id, str(payload.get("role") or "student"))
    return {"success": True, "user": UserOutSchema.model_validate(user)}


@router.get(
    "/api/students",
    tags=["Catalogs"],
    summary="Danh sách hồ sơ sinh viên (student_profiles)",
)
def list_students(db: DbSession):
    students = get_students(db)
    return {"success": True, "total": len(students), "students": students}


@router.put(
    "/api/students/{student_id}",
    tags=["Catalogs"],
    summary="Cập nhật hồ sơ sinh viên theo ID (chỉ chính chủ hoặc Admin)",
)
def update_student_by_id_api(
    student_id: int,
    db: DbSession,
    payload: dict = Body(...),
    current_user: User | None = Depends(verify_student_or_internal),
):
    student = update_student_profile_by_id(
        db, student_id, payload, acting_user=current_user
    )
    return {
        "success": True,
        "message": "Cập nhật hồ sơ sinh viên thành công",
        "student": student,
    }


@router.get(
    "/api/recruiters",
    tags=["Catalogs"],
    summary="Danh sách hồ sơ nhà tuyển dụng (employer_profiles)",
)
def list_recruiters(db: DbSession):
    recruiters = get_recruiters(db)
    return {
        "success": True,
        "total": len(recruiters),
        "recruiters": [
            RecruiterProfileOutSchema.model_validate(r) for r in recruiters
        ],
    }


@router.put(
    "/api/recruiters/{recruiter_id}",
    tags=["Catalogs"],
    summary="Cập nhật hồ sơ doanh nghiệp theo ID (chỉ chính chủ hoặc Admin)",
)
def update_recruiter_by_id_api(
    recruiter_id: int,
    db: DbSession,
    payload: dict = Body(...),
    current_user: User | None = Depends(verify_employer_or_internal),
):
    # Trạng thái xác minh chỉ do Admin thay đổi qua PATCH /api/recruiters/{id}/verify
    if current_user is not None and current_user.role != RoleEnum.ADMIN:
        payload = {k: v for k, v in payload.items() if k != "verified"}
    rec = update_employer_profile_by_id(
        db, recruiter_id, payload, acting_user=current_user
    )
    return {
        "success": True,
        "message": "Cập nhật hồ sơ doanh nghiệp thành công",
        "recruiter": RecruiterProfileOutSchema.model_validate(rec),
    }


@router.patch(
    "/api/recruiters/{recruiter_id}/verify",
    tags=["Catalogs"],
    summary="Admin xác minh hoặc hủy xác minh doanh nghiệp",
    dependencies=[Depends(verify_admin_or_internal)],
)
def verify_recruiter_api(
    recruiter_id: int,
    db: DbSession,
    payload: dict = Body(...),
):
    rec = update_employer_profile_by_id(
        db, recruiter_id, {"verified": bool(payload.get("verified", True))}
    )
    return {
        "success": True,
        "recruiter": RecruiterProfileOutSchema.model_validate(rec),
    }
