from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.security import hashed_password, verify_password
from app.core.skills import dump_skills, normalize_skills
from app.models.profile import AdminProfile, EmployerProfile, StudentProfile
from app.models.user import RoleEnum, User, UserStatusEnum
from app.schemas.users import (
    EmployerProfileUpdate,
    StudentProfileOutSchema,
    StudentProfileUpdate,
    UserCreateSchema,
)


def _get_user_or_404(
    db: Session, user_id: int, label: str = "người dùng"
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy {label} (users.id = {user_id})",
        )
    return user


def _ensure_email_available(db: Session, new_email: str, owner_user_id: int | None) -> str:
    """Chuẩn hóa email mới và đảm bảo không trùng với tài khoản khác (409)."""
    email = str(new_email).strip().lower()
    if "@" not in email or len(email) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Địa chỉ email không hợp lệ",
        )
    clash = (
        db.query(User)
        .filter(User.email == email, User.id != owner_user_id)
        .first()
    )
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email này đã được sử dụng bởi một tài khoản khác",
        )
    return email


# ═══════════════════════ STUDENT PROFILE ═══════════════
def get_student_profile(user: User, db: Session) -> StudentProfile:
    profile = (
        db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có hồ sơ sinh viên"
        )
    return profile


def update_student_profile(
    user: User, data: StudentProfileUpdate, db: Session
) -> StudentProfile:
    profile = (
        db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    )
    now = datetime.now()
    if not profile:
        profile = StudentProfile(user_id=user.id, created_at=now, updated_at=now)
        db.add(profile)

    updates = data.model_dump(exclude_unset=True)
    if "full_name" in updates and updates["full_name"]:
        user.full_name = updates.pop("full_name")
    if "email" in updates and updates["email"]:
        user.email = updates.pop("email")
    if "phone" in updates and updates["phone"] is not None:
        user.phone = updates.pop("phone")
    user.updated_at = now

    if "skills" in updates:  # mảng đã được schema chuẩn hóa → lưu dạng chuỗi JSON
        skills = updates.pop("skills")
        if skills is not None:
            profile.skills = dump_skills(skills)
    for field, value in updates.items():
        if hasattr(profile, field):
            setattr(profile, field, value)
    profile.updated_at = now
    db.commit()
    db.refresh(profile)
    return profile


def update_student_profile_by_id(
    db: Session, student_id: int, payload: dict, acting_user: User | None = None
) -> StudentProfileOutSchema:
    profile = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.id == student_id)
        .first()
    )
    if not profile:
        profile = (
            db.query(StudentProfile)
            .options(joinedload(StudentProfile.user))
            .filter(StudentProfile.user_id == student_id)
            .first()
        )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ sinh viên (id = {student_id})",
        )
    from app.dependencies.middleware import ensure_self_or_admin

    ensure_self_or_admin(acting_user, profile.user_id, "cập nhật hồ sơ sinh viên")
    now = datetime.now()
    if profile.user:
        if payload.get("full_name"):
            profile.user.full_name = str(payload["full_name"]).strip()
        if payload.get("email"):
            profile.user.email = _ensure_email_available(
                db, payload["email"], profile.user_id
            )
        if "phone" in payload and payload["phone"] is not None:
            profile.user.phone = str(payload["phone"]).strip()
        profile.user.updated_at = now

    for field in ("university", "major", "bio", "address", "avatar_url"):
        if field in payload and payload[field] is not None:
            setattr(profile, field, payload[field])
    if "date_of_birth" in payload:
        dob = payload["date_of_birth"]
        if isinstance(dob, str) and dob.strip():
            from datetime import date

            try:
                profile.date_of_birth = date.fromisoformat(dob.strip()[:10])
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ngày sinh không đúng định dạng (YYYY-MM-DD)",
                )
        elif not dob:
            profile.date_of_birth = None
    if "skills" in payload and payload["skills"] is not None:
        try:
            profile.skills = dump_skills(normalize_skills(payload["skills"]))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    profile.updated_at = now
    db.commit()
    db.refresh(profile)
    return StudentProfileOutSchema(
        id=profile.id,
        user_id=profile.user_id,
        university=profile.university,
        major=profile.major,
        bio=profile.bio,
        address=profile.address,
        date_of_birth=profile.date_of_birth,
        avatar_url=profile.avatar_url,
        skills=profile.skills,
        full_name=profile.user.full_name if profile.user else None,
        email=profile.user.email if profile.user else None,
    )


# ═══════════════════════ EMPLOYER PROFILE ══════════════
def get_employer_profile(user: User, db: Session) -> EmployerProfile:
    profile = (
        db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chưa có hồ sơ doanh nghiệp",
        )
    return profile


def update_employer_profile(
    user: User, data: EmployerProfileUpdate, db: Session
) -> EmployerProfile:
    profile = (
        db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    )
    now = datetime.now()
    if not profile:
        profile = EmployerProfile(
            user_id=user.id,
            company_name=data.company_name or user.full_name,
            created_at=now,
            updated_at=now,
        )
        db.add(profile)

    for field, value in data.model_dump(exclude_unset=True).items():
        if hasattr(profile, field):
            setattr(profile, field, value)
    profile.updated_at = now
    db.commit()
    db.refresh(profile)
    return profile


def update_employer_profile_by_id(
    db: Session, recruiter_id: int, payload: dict, acting_user: User | None = None
) -> EmployerProfile:
    profile = (
        db.query(EmployerProfile)
        .options(joinedload(EmployerProfile.user))
        .filter(EmployerProfile.id == recruiter_id)
        .first()
    )
    if not profile:
        profile = (
            db.query(EmployerProfile)
            .options(joinedload(EmployerProfile.user))
            .filter(EmployerProfile.user_id == recruiter_id)
            .first()
        )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ doanh nghiệp (id = {recruiter_id})",
        )
    from app.dependencies.middleware import ensure_self_or_admin

    ensure_self_or_admin(acting_user, profile.user_id, "cập nhật hồ sơ doanh nghiệp")
    if "company_name" in payload and not str(payload.get("company_name") or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên công ty không được để trống",
        )
    now = datetime.now()
    for field in (
        "company_name",
        "representative_name",
        "company_address",
        "company_phone",
        "industry",
        "description",
        "logo_url",
        "verified",
    ):
        if field in payload and payload[field] is not None:
            setattr(profile, field, payload[field])
    if profile.user and payload.get("email"):
        profile.user.email = _ensure_email_available(
            db, payload["email"], profile.user_id
        )
        profile.user.updated_at = now
    profile.updated_at = now
    db.commit()
    db.refresh(profile)
    return profile


# ═══════════════════════ USERS & CATALOGS (Tích hợp Nhánh A & B) ════
def create_user(db: Session, user_data: UserCreateSchema) -> User:
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email này đã được đăng ký trong hệ thống",
        )

    now = datetime.now()
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        status=UserStatusEnum.ACTIVE,
        created_at=now,
        updated_at=now,
    )
    db.add(new_user)
    db.flush()

    if user_data.role == RoleEnum.STUDENT:
        db.add(
            StudentProfile(
                user_id=new_user.id,
                university=user_data.university,
                major=user_data.major,
                created_at=now,
                updated_at=now,
            )
        )
    elif user_data.role in (RoleEnum.EMPLOYER, RoleEnum.RECRUITER):
        db.add(
            EmployerProfile(
                user_id=new_user.id,
                company_name=user_data.company_name or user_data.full_name,
                representative_name=user_data.full_name,
                company_phone=user_data.phone,
                verified=False,
                created_at=now,
                updated_at=now,
            )
        )
    elif user_data.role == RoleEnum.ADMIN:
        db.add(
            AdminProfile(
                user_id=new_user.id,
                position=user_data.position or "Quản trị viên",
                created_at=now,
                updated_at=now,
            )
        )

    db.commit()
    db.refresh(new_user)
    return new_user


def get_users(
    db: Session,
    role: RoleEnum | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[User]]:
    query = db.query(User)
    if role is not None:
        if role in (RoleEnum.EMPLOYER, RoleEnum.RECRUITER):
            query = query.filter(
                User.role.in_([RoleEnum.EMPLOYER, RoleEnum.RECRUITER])
            )
        else:
            query = query.filter(User.role == role)
    total = query.count()
    items = query.order_by(User.id.asc()).offset(skip).limit(limit).all()
    return total, items


def get_all_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.created_at.desc()).all()


def get_user_by_id(user_id_or_db, db_or_user_id=None) -> User:
    """Hỗ trợ cả 2 chữ ký gọi hàm: (user_id, db) của Nhánh B và (db, user_id) của Nhánh A."""
    if isinstance(user_id_or_db, Session):
        db: Session = user_id_or_db
        user_id: int = int(db_or_user_id)
    else:
        user_id = int(user_id_or_db)
        db = db_or_user_id
    return _get_user_or_404(db, user_id)


def change_user_password(
    db: Session, user_id: int, current_password: str, new_password: str
) -> User:
    user = _get_user_or_404(db, user_id)
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không đúng.",
        )
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới cần ít nhất 6 ký tự.",
        )
    user.hashed_password = hashed_password(new_password)
    user.updated_at = datetime.now()
    db.commit()
    db.refresh(user)
    return user


ROOT_ADMIN_ID = 6


def update_user_status(db: Session, user_id: int, new_status: str) -> User:
    user = _get_user_or_404(db, user_id)
    if user.id == ROOT_ADMIN_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể khóa tài khoản Quản trị viên gốc (Root Admin)",
        )
    norm = new_status.strip().lower()
    if norm in ("blocked", "locked"):
        user.status = UserStatusEnum.LOCKED
    elif norm == "inactive":
        user.status = UserStatusEnum.INACTIVE
    else:
        user.status = UserStatusEnum.ACTIVE
    user.updated_at = datetime.now()
    db.commit()
    db.refresh(user)
    return user


def update_user_role(db: Session, user_id: int, new_role: str) -> User:
    user = _get_user_or_404(db, user_id)
    if user.id == ROOT_ADMIN_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể thay đổi vai trò của Quản trị viên gốc (Root Admin)",
        )
    norm = new_role.strip().lower()
    role_map = {
        "student": RoleEnum.STUDENT,
        "employer": RoleEnum.EMPLOYER,
        "recruiter": RoleEnum.RECRUITER,
        "admin": RoleEnum.ADMIN,
    }
    if norm not in role_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vai trò không hợp lệ (chỉ chấp nhận: student, employer, admin)",
        )
    user.role = role_map[norm]
    user.updated_at = datetime.now()
    db.commit()
    db.refresh(user)
    return user


def get_students(db: Session) -> list[StudentProfileOutSchema]:
    rows = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .order_by(StudentProfile.id.asc())
        .all()
    )
    return [
        StudentProfileOutSchema(
            id=r.id,
            user_id=r.user_id,
            university=r.university,
            major=r.major,
            bio=r.bio,
            address=r.address,
            date_of_birth=r.date_of_birth,
            avatar_url=r.avatar_url,
            skills=r.skills,
            full_name=r.user.full_name if r.user else None,
            email=r.user.email if r.user else None,
        )
        for r in rows
    ]


def get_recruiters(db: Session) -> list[EmployerProfile]:
    return (
        db.query(EmployerProfile)
        .order_by(EmployerProfile.id.asc())
        .all()
    )
