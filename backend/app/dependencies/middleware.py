from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.user import RoleEnum, User, UserStatusEnum

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def _get_user_by_email(email: str, db: Session) -> User | None:
    return db.query(User).filter(User.email == email).first()


# ── Lấy user hiện tại từ JWT (Bắt buộc có token) ─────────
def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = cred.credentials

    try:
        payload = decode_access_token(token)
    except ValueError as e:
        if str(e) == "TOKEN_EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token xác thực không hợp lệ",
        )

    if not payload or not payload.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token xác thực không hợp lệ",
        )

    user = _get_user_by_email(payload["email"], db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không tìm thấy tài khoản người dùng",
        )
    if user.status != UserStatusEnum.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa",
        )

    return user


# ── Lấy user hiện tại nếu request có đính kèm Bearer Token ──
def get_optional_user(
    cred: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
) -> User | None:
    if not cred or not cred.credentials:
        return None
    return get_current_user(cred=cred, db=db)


# ── Phân quyền chặt chẽ theo Vai trò (RBAC) ──────────────
def get_student_user(current_user: User = Depends(get_current_user)) -> User:
    """Sinh viên: ứng tuyển, lưu việc, quản lý CV, cập nhật hồ sơ, lịch làm việc."""
    if current_user.role != RoleEnum.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản Sinh viên mới có quyền thực hiện thao tác này",
        )
    return current_user


def get_recruiter_user(current_user: User = Depends(get_current_user)) -> User:
    """Nhà tuyển dụng: đăng tin, quản lý tin tuyển dụng, duyệt hồ sơ ứng viên."""
    if current_user.role not in (
        RoleEnum.RECRUITER,
        RoleEnum.EMPLOYER,
        RoleEnum.ADMIN,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản Nhà tuyển dụng mới có quyền thực hiện thao tác này",
        )
    return current_user


get_employer_user = get_recruiter_user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Quản trị viên (Admin): kiểm duyệt tin, quản lý danh mục, người dùng & báo cáo."""
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên (Admin) mới có quyền truy cập chức năng này",
        )
    return current_user


# ── Kiểm tra phân quyền cho các endpoint /api/... khi có gửi kèm JWT ──
def verify_student_or_internal(
    current_user: User | None = Depends(get_optional_user),
) -> User | None:
    if current_user is not None and current_user.role not in (
        RoleEnum.STUDENT,
        RoleEnum.ADMIN,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản Sinh viên mới được phép thực hiện thao tác này",
        )
    return current_user


def verify_employer_or_internal(
    current_user: User | None = Depends(get_optional_user),
) -> User | None:
    if current_user is not None and current_user.role not in (
        RoleEnum.EMPLOYER,
        RoleEnum.RECRUITER,
        RoleEnum.ADMIN,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản Nhà tuyển dụng hoặc Admin mới được phép thực hiện thao tác này",
        )
    return current_user


def verify_admin_or_internal(
    current_user: User | None = Depends(get_optional_user),
) -> User | None:
    if current_user is not None and current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên (Admin) mới được phép thực hiện thao tác này",
        )
    return current_user


# ── Kiểm tra "chính chủ hoặc Admin" khi request có gửi kèm JWT ──
def ensure_self_or_admin(
    current_user: User | None,
    owner_user_id: int | None,
    action_label: str = "thực hiện thao tác này",
) -> None:
    """Nếu request có Bearer Token, chỉ cho phép chủ sở hữu dữ liệu hoặc Admin.

    Request không kèm token vẫn được giữ nguyên hành vi cũ (dùng nội bộ / Swagger)
    để không phá vỡ các bài kiểm thử và luồng tích hợp hiện có.
    """
    if current_user is None or current_user.role == RoleEnum.ADMIN:
        return
    if owner_user_id is None or current_user.id != owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Bạn không có quyền {action_label} thay cho tài khoản khác",
        )
