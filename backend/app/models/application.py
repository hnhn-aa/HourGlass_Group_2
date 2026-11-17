from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def _enum_values(enum_cls: type[Enum]) -> list[str]:
    return [e.value for e in enum_cls]


# ── Bảng tham chiếu trạng thái – dùng cho applications & application_status_logs ──
class ApplicationStatusRef(Base):
    __tablename__ = "application_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
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


STATUS_ID_TO_ENUM = {
    1: AppStatusEnum.SUBMITTED,
    2: AppStatusEnum.REVIEWING,
    3: AppStatusEnum.INTERVIEW,
    4: AppStatusEnum.ACCEPTED,
    5: AppStatusEnum.REJECTED,
    6: AppStatusEnum.WITHDRAWN,
}
ENUM_TO_STATUS_ID = {v.value: k for k, v in STATUS_ID_TO_ENUM.items()}


# ── CV ────────────────────────────────────────────────────
class CV(Base):
    __tablename__ = "cvs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_type = Column(
        SAEnum(FileTypeEnum, values_callable=_enum_values), nullable=False
    )
    is_default = Column(Boolean, default=False, nullable=False)
    uploaded_at = Column(
        DateTime, default=datetime.now, server_default=func.now(), nullable=False
    )

    student = relationship("StudentProfile", back_populates="cvs")
    applications = relationship("Application", back_populates="cv")


# ── Application ──────────────────────────────────────────
class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("student_id", "job_id", name="unique_student_job_application"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    job_id = Column(
        Integer,
        ForeignKey("jobs.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    cv_id = Column(
        Integer,
        ForeignKey("cvs.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    status_id = Column(
        Integer,
        ForeignKey("application_statuses.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        default=1,
    )
    cover_letter = Column(Text, nullable=True)
    status = Column(
        SAEnum(AppStatusEnum, values_callable=_enum_values),
        nullable=False,
        default=AppStatusEnum.SUBMITTED,
    )
    applied_at = Column(
        DateTime, default=datetime.now, server_default=func.now(), nullable=False
    )
    reviewed_at = Column(DateTime, nullable=True)
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
        if "status_id" in kwargs and "status" not in kwargs:
            kwargs["status"] = STATUS_ID_TO_ENUM.get(
                kwargs["status_id"], AppStatusEnum.SUBMITTED
            )
        elif "status" in kwargs and "status_id" not in kwargs:
            st = kwargs["status"]
            st_val = st.value if isinstance(st, Enum) else str(st)
            kwargs["status_id"] = ENUM_TO_STATUS_ID.get(st_val, 1)
        super().__init__(**kwargs)

    student = relationship("StudentProfile", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    cv = relationship("CV", back_populates="applications")
    status_obj = relationship("ApplicationStatusRef")
    status_logs = relationship(
        "ApplicationStatusLog",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationStatusLog.changed_at.desc()",
    )

    @property
    def logs(self):
        return self.status_logs


# ── Application Status Log ───────────────────────────────
class ApplicationStatusLog(Base):
    __tablename__ = "application_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    application_id = Column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    status_id = Column(
        Integer,
        ForeignKey("application_statuses.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    note = Column(Text, nullable=True)
    changed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    changed_at = Column(
        DateTime, default=datetime.now, server_default=func.now(), nullable=False
    )

    application = relationship("Application", back_populates="status_logs")
    status_ref = relationship("ApplicationStatusRef", back_populates="logs")
    changed_by_user = relationship("User", back_populates="status_changes")

    @property
    def status_obj(self):
        return self.status_ref


# Aliases tương thích với Nhánh A
ApplicationStatusNameEnum = AppStatusEnum
CVFileTypeEnum = FileTypeEnum
ApplicationStatusModel = ApplicationStatusRef
CVModel = CV
ApplicationModel = Application
ApplicationStatusLogModel = ApplicationStatusLog
