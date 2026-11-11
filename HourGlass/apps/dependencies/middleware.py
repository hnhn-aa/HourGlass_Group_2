from apps.models.user import RoleEnum, User, UserStatusEnum
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from apps.db.database import get_db
from apps.core.security import decode_access_token

security = HTTPBearer()


def _get_user_by_email(email: str, db: Session) -> User | None:
    return db.query(User).filter(User.email == email).first()


# ── Lấy user hiện tại từ JWT ─────────────────────────────
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
                detail="Token đã hết hạn, vui lòng đăng nhập lại",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")

    if not payload or not payload.get("email"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")

    user = _get_user_by_email(payload["email"], db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Không tìm thấy người dùng")
    if user.status != UserStatusEnum.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị vô hiệu hóa hoặc khóa")

    return user


# ── Phân quyền theo Use-Case ─────────────────────────────
def get_student_user(current_user: User = Depends(get_current_user)) -> User:
    """Sinh viên: ứng tuyển, theo dõi, cập nhật hồ sơ, lịch, đánh giá."""
    if current_user.role != RoleEnum.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ sinh viên mới được truy cập")
    return current_user


def get_recruiter_user(current_user: User = Depends(get_current_user)) -> User:
    """Nhà tuyển dụng: đăng tin, quản lý tin, quản lý hồ sơ ứng tuyển."""
    if current_user.role != RoleEnum.RECRUITER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ nhà tuyển dụng mới được truy cập")
    return current_user


# Alias tương thích ngược
get_employer_user = get_recruiter_user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Admin: kiểm duyệt tin, quản lý danh mục, quản lý người dùng."""
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ quản trị viên mới được truy cập")
    return current_user
