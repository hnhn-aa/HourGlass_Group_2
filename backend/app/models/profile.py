from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    token = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(
        DateTime, default=datetime.now, server_default=func.now(), nullable=False
    )

    user = relationship("User", back_populates="password_resets")


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        unique=True,
    )
    university = Column(String(200), nullable=True)
    major = Column(String(150), nullable=True)
    bio = Column(Text, nullable=True)
    address = Column(String(255), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    # Kỹ năng & Thế mạnh: chuỗi JSON của mảng, VD '["Tiếng Anh", "Canva"]' (xem app/core/skills.py)
    skills = Column(Text, nullable=True)
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

    user = relationship("User", back_populates="student_profile")
    cvs = relationship("CV", back_populates="student", cascade="all, delete-orphan")
    applications = relationship(
        "Application", back_populates="student", cascade="all, delete-orphan"
    )
    job_saves = relationship(
        "JobSave", back_populates="student", cascade="all, delete-orphan"
    )
    availabilities = relationship(
        "Availability", back_populates="student", cascade="all, delete-orphan"
    )
    schedules = relationship(
        "Schedule", back_populates="student", cascade="all, delete-orphan"
    )


class EmployerProfile(Base):
    __tablename__ = "employer_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        unique=True,
    )
    company_name = Column(String(200), nullable=False)
    representative_name = Column(String(150), nullable=True)
    company_address = Column(String(255), nullable=True)
    company_phone = Column(String(20), nullable=True)
    industry = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    verified = Column(Boolean, default=False, nullable=False)
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

    user = relationship("User", back_populates="employer_profile")
    jobs = relationship(
        "Job", back_populates="recruiter", foreign_keys="Job.recruiter_id"
    )


class AdminProfile(Base):
    __tablename__ = "admin_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        unique=True,
    )
    position = Column(String(150), nullable=True)
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

    user = relationship("User", back_populates="admin_profile")


# Aliases tương thích với Nhánh A
PasswordResetModel = PasswordReset
StudentProfileModel = StudentProfile
RecruiterProfile = EmployerProfile
RecruiterProfileModel = EmployerProfile
EmployerProfileModel = EmployerProfile
AdminProfileModel = AdminProfile
