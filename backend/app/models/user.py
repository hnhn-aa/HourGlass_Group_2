from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Enum as SAEnum, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


def _enum_values(enum_cls: type[Enum]) -> list[str]:
    return [e.value for e in enum_cls]


class RoleEnum(str, Enum):
    STUDENT = "student"
    EMPLOYER = "employer"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class UserStatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    LOCKED = "locked"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(
        SAEnum(RoleEnum, values_callable=_enum_values),
        nullable=False,
        default=RoleEnum.STUDENT,
    )
    status = Column(
        SAEnum(UserStatusEnum, values_callable=_enum_values),
        nullable=False,
        default=UserStatusEnum.ACTIVE,
    )
    created_at = Column(
        DateTime, default=datetime.now, server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        server_default=func.now(),
        onupdate=datetime.now,
        nullable=False,
    )

    def __init__(self, **kwargs):
        if "password" in kwargs and "hashed_password" not in kwargs:
            kwargs["hashed_password"] = kwargs.pop("password")
        super().__init__(**kwargs)

    @property
    def password(self) -> str:
        return self.hashed_password

    @password.setter
    def password(self, value: str) -> None:
        self.hashed_password = value

    # ── one-to-one profiles ──
    student_profile = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    employer_profile = relationship(
        "EmployerProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    admin_profile = relationship(
        "AdminProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    password_resets = relationship(
        "PasswordReset", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def recruiter_profile(self):
        return self.employer_profile

    # ── jobs ──
    jobs_posted = relationship(
        "Job", back_populates="employer", foreign_keys="Job.employer_id"
    )

    # ── reports, logs & reviews ──
    reports = relationship(
        "Report",
        back_populates="reporter",
        foreign_keys="Report.reporter_id",
        cascade="all, delete-orphan",
    )
    status_changes = relationship(
        "ApplicationStatusLog",
        back_populates="changed_by_user",
        foreign_keys="ApplicationStatusLog.changed_by",
    )
    reviews_given = relationship(
        "Review",
        back_populates="reviewer",
        foreign_keys="Review.reviewer_id",
        cascade="all, delete-orphan",
    )
    reviews_received = relationship(
        "Review",
        back_populates="target",
        foreign_keys="Review.target_id",
        cascade="all, delete-orphan",
    )


# Alias tương thích với Nhánh A
UserModel = User
