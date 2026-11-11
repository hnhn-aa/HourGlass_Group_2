from apps.db.database import Base
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from enum import Enum


class ReportTypeEnum(str, Enum):
    JOB = "job"
    EMPLOYER = "employer"
    USER = "user"
    APPLICATION = "application"
    OTHER = "other"


class ReportStatusEnum(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_type = Column(SAEnum(ReportTypeEnum), nullable=False)
    target_id = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(SAEnum(ReportStatusEnum), nullable=False, default=ReportStatusEnum.PENDING)
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    reporter = relationship("User", back_populates="reports")
