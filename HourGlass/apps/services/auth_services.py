from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from apps.models.user import User, UserStatusEnum, RoleEnum
from apps.schemas.users import RegisterForm, LoginUser
from apps.core.security import hashed_password, verify_password, create_access_token, create_refresh_token


def get_user_by_email(email: str, db: Session) -> User | None:
    return db.query(User).filter(User.email == email).first()


def register_user(user: RegisterForm, db: Session) -> User:
    # 1. Validate email
    if not user.email or "@" not in user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email không đúng định dạng")

    # 2. Validate password
    if not user.password or len(user.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu phải có ít nhất 6 ký tự")

    # 3. Validate full_name
    if not user.full_name or not user.full_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Họ và tên không được để trống")

    # 4. Check email duplicate
    if get_user_by_email(user.email.strip().lower(), db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email đã tồn tại")

    # 5. Normalize role (student / recruiter / admin)
    role_str = (user.role or "student").strip().lower()
    role_mapping = {
        "student": RoleEnum.STUDENT,
        "recruiter": RoleEnum.RECRUITER,
        "employer": RoleEnum.RECRUITER,  # Hỗ trợ cả alias employer -> recruiter
        "admin": RoleEnum.ADMIN
    }
    assigned_role = role_mapping.get(role_str)
    if not assigned_role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vai trò (role) không hợp lệ, chỉ chấp nhận: student, recruiter")

    new_user = User(
        email=user.email.strip().lower(),
        hashed_password=hashed_password(user.password),
        full_name=user.full_name.strip(),
        phone=user.phone,
        role=assigned_role,
        status=UserStatusEnum.ACTIVE,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def login_user(data: LoginUser, db: Session) -> dict:
    user = get_user_by_email(data.email, db)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản hoặc mật khẩu không đúng")

    if user.status != UserStatusEnum.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị vô hiệu hóa hoặc khóa")

    token_data = {"email": user.email, "role": user.role.value}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
    }
