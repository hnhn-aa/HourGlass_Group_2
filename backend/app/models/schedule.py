from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class Availability(Base):
    __tablename__ = "availabilities"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_day_of_week"),
        CheckConstraint("end_time > start_time", name="chk_avail_time"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    day_of_week = Column(SmallInteger, nullable=False)  # 1 = T2 … 7 = CN
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
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

    student = relationship("StudentProfile", back_populates="availabilities")


class Schedule(Base):
    __tablename__ = "schedules"
    __table_args__ = (
        CheckConstraint("end_datetime > start_datetime", name="chk_schedule_datetime"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    job_id = Column(
        Integer,
        ForeignKey("jobs.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    title = Column(String(255), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    note = Column(Text, nullable=True)
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

    student = relationship("StudentProfile", back_populates="schedules")
    job = relationship("Job", back_populates="schedules")


# Aliases tương thích với Nhánh A
AvailabilityModel = Availability
ScheduleModel = Schedule
