from apps.db.database import Base
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime,
    ForeignKey, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from enum import Enum


# ── Bảng tham chiếu trạng thái – dùng cho application_status_logs ──
class ApplicationStatusRef(Base):
    __tablename__ = "application_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    logs = relationship("ApplicationStatusLog", back_populates="status_ref")


# ── Enum trạng thái trực tiếp trên applications ──────────
class AppStatusEnum(str, Enum):
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    INTERVIEW = "interview"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class FileTypeEnum(str, Enum):
    PDF = "pdf"
    DOC = "doc"
    DOCX = "docx"


# ── CV ────────────────────────────────────────────────────
class CV(Base):
    __tablename__ = "cvs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_type = Column(SAEnum(FileTypeEnum), nullable=False)
    is_default = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, nullable=False)

    student = relationship("User", back_populates="cvs")
    applications = relationship("Application", back_populates="cv")


# ── Application ──────────────────────────────────────────
class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    cv_id = Column(Integer, ForeignKey("cvs.id"), nullable=True)
    cover_letter = Column(Text, nullable=True)
    status = Column(
        SAEnum(AppStatusEnum), nullable=False, default=AppStatusEnum.SUBMITTED
    )
    applied_at = Column(DateTime, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    student = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    cv = relationship("CV", back_populates="applications")
    status_logs = relationship("ApplicationStatusLog", back_populates="application")


# ── Application Status Log ───────────────────────────────
class ApplicationStatusLog(Base):
    __tablename__ = "application_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    status_id = Column(Integer, ForeignKey("application_statuses.id"), nullable=False)
    note = Column(Text, nullable=True)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime, nullable=False)

    application = relationship("Application", back_populates="status_logs")
    status_ref = relationship("ApplicationStatusRef", back_populates="logs")
    changed_by_user = relationship("User", back_populates="status_changes")
