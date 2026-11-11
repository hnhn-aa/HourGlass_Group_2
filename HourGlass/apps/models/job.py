from apps.db.database import Base
from sqlalchemy import (
    Column, String, Integer, Text, DateTime, Date,
    ForeignKey, Numeric, UniqueConstraint, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from enum import Enum


class JobTypeEnum(str, Enum):
    PART_TIME = "part-time"
    FULL_TIME = "full-time"
    INTERNSHIP = "internship"


class JobStatusEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"


class LocationTypeEnum(str, Enum):
    CITY = "city"
    DISTRICT = "district"
    WARD = "ward"
    OTHER = "other"


class JobCategory(Base):
    __tablename__ = "job_categories"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    jobs = relationship("Job", back_populates="category")


class JobLocation(Base):
    __tablename__ = "job_locations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(SAEnum(LocationTypeEnum), nullable=False)
    parent_id = Column(Integer, ForeignKey("job_locations.id"), nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    parent = relationship("JobLocation", back_populates="children", remote_side="JobLocation.id")
    children = relationship("JobLocation", back_populates="parent")
    jobs = relationship("Job", back_populates="location")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    employer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("job_categories.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("job_locations.id"), nullable=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    requirements = Column(Text, nullable=True)
    salary_min = Column(Numeric(12, 2), nullable=True)
    salary_max = Column(Numeric(12, 2), nullable=True)
    job_type = Column(SAEnum(JobTypeEnum), nullable=False, default=JobTypeEnum.PART_TIME)
    work_time = Column(String(200), nullable=True)
    quantity = Column(Integer, nullable=True)
    experience_level = Column(String(100), nullable=True)
    benefits = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(SAEnum(JobStatusEnum), nullable=False, default=JobStatusEnum.PENDING)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

    employer = relationship("User", back_populates="jobs_posted", foreign_keys=[employer_id])
    approver = relationship("User", back_populates="jobs_approved", foreign_keys=[approved_by])
    category = relationship("JobCategory", back_populates="jobs")
    location = relationship("JobLocation", back_populates="jobs")
    applications = relationship("Application", back_populates="job")
    job_saves = relationship("JobSave", back_populates="job")
    schedules = relationship("Schedule", back_populates="job")


class JobSave(Base):
    __tablename__ = "job_saves"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)

    __table_args__ = (
        UniqueConstraint("student_id", "job_id", name="uq_student_job"),
    )

    student = relationship("User", back_populates="job_saves")
    job = relationship("Job", back_populates="job_saves")
