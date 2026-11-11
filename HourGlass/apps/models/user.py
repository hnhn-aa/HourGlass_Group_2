from apps.db.database import Base
from sqlalchemy import Column, String, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from enum import Enum


class RoleEnum(str, Enum):
    STUDENT = "student"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class UserStatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    LOCKED = "locked"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String(100), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(
        SAEnum(RoleEnum, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=RoleEnum.STUDENT,
    )
    status = Column(
        SAEnum(UserStatusEnum, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=UserStatusEnum.ACTIVE,
    )
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    # ── one-to-one profiles ──
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    employer_profile = relationship("EmployerProfile", back_populates="user", uselist=False)
    admin_profile = relationship("AdminProfile", back_populates="user", uselist=False)
    password_resets = relationship("PasswordReset", back_populates="user")

    # ── jobs ──
    jobs_posted = relationship("Job", back_populates="employer", foreign_keys="Job.employer_id")
    jobs_approved = relationship("Job", back_populates="approver", foreign_keys="Job.approved_by")

    # ── student activities ──
    cvs = relationship("CV", back_populates="student")
    applications = relationship("Application", back_populates="student")
    job_saves = relationship("JobSave", back_populates="student")
    availabilities = relationship("Availability", back_populates="student")
    schedules = relationship("Schedule", back_populates="student")

    # ── misc ──
    reports = relationship("Report", back_populates="reporter")
    status_changes = relationship("ApplicationStatusLog", back_populates="changed_by_user")
