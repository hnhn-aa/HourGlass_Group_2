from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime

from apps.models.user import User
from apps.models.profile import StudentProfile, EmployerProfile
from apps.schemas.users import StudentProfileUpdate, EmployerProfileUpdate


# ═══════════════════════ STUDENT PROFILE ═══════════════
def get_student_profile(user: User, db: Session):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có hồ sơ sinh viên")
    return profile


def update_student_profile(user: User, data: StudentProfileUpdate, db: Session):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    now = datetime.now()
    if not profile:
        profile = StudentProfile(user_id=user.id, created_at=now, updated_at=now)
        db.add(profile)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    profile.updated_at = now
    db.commit()
    db.refresh(profile)
    return profile


# ═══════════════════════ EMPLOYER PROFILE ══════════════
def get_employer_profile(user: User, db: Session):
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có hồ sơ doanh nghiệp")
    return profile


def update_employer_profile(user: User, data: EmployerProfileUpdate, db: Session):
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
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
        setattr(profile, field, value)
    profile.updated_at = now
    db.commit()
    db.refresh(profile)
    return profile


# ═══════════════════════ ADMIN: QUẢN LÝ NGƯỜI DÙNG ════
def get_all_users(db: Session):
    return db.query(User).order_by(User.created_at.desc()).all()


def get_user_by_id(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng")
    return user

