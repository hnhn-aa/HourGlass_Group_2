from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def _enum_values(enum_cls: type[Enum]) -> list[str]:
    return [e.value for e in enum_cls]


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
    reporter_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    report_type = Column(
        SAEnum(ReportTypeEnum, values_callable=_enum_values), nullable=False
    )
    target_id = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(
        SAEnum(ReportStatusEnum, values_callable=_enum_values),
        nullable=False,
        default=ReportStatusEnum.PENDING,
    )
    admin_note = Column(Text, nullable=True)
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

    reporter = relationship(
        "User", back_populates="reports", foreign_keys=[reporter_id]
    )


# Alias tương thích với Nhánh A
ReportModel = Report
