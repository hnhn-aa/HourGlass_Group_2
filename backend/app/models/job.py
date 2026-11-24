from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def _enum_values(enum_cls: type[Enum]) -> list[str]:
    return [e.value for e in enum_cls]


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
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)
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

    jobs = relationship("Job", back_populates="category")


class JobLocation(Base):
    __tablename__ = "job_locations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(150), nullable=False)
    type = Column(
        SAEnum(LocationTypeEnum, values_callable=_enum_values), nullable=False
    )
    parent_id = Column(
        Integer,
        ForeignKey("job_locations.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
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

    parent = relationship(
        "JobLocation", back_populates="children", remote_side="JobLocation.id"
    )
    children = relationship("JobLocation", back_populates="parent")
    jobs = relationship("Job", back_populates="location")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    employer_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True,
    )
    recruiter_id = Column(
        Integer,
        ForeignKey("employer_profiles.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=True,
    )
    category_id = Column(
        Integer,
        ForeignKey("job_categories.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=True,
    )
    location_id = Column(
        Integer,
        ForeignKey("job_locations.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=True,
    )
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    requirements = Column(Text, nullable=True)
    salary_min = Column(Numeric(15, 2), nullable=True)
    salary_max = Column(Numeric(15, 2), nullable=True)
    job_type = Column(
        SAEnum(JobTypeEnum, values_callable=_enum_values),
        nullable=False,
        default=JobTypeEnum.PART_TIME,
    )
    work_time = Column(String(255), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    experience_level = Column(String(100), nullable=True)
    benefits = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    image_url = Column(String(500), nullable=True)
    status = Column(
        SAEnum(JobStatusEnum, values_callable=_enum_values),
        nullable=False,
        default=JobStatusEnum.PENDING,
    )
    approved_by = Column(Integer, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_reason = Column(Text, nullable=True)
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

    employer = relationship(
        "User", back_populates="jobs_posted", foreign_keys=[employer_id]
    )
    recruiter = relationship(
        "EmployerProfile", back_populates="jobs", foreign_keys=[recruiter_id]
    )
    category = relationship("JobCategory", back_populates="jobs")
    location = relationship("JobLocation", back_populates="jobs")
    applications = relationship(
        "Application", back_populates="job", cascade="all, delete-orphan"
    )
    job_saves = relationship(
        "JobSave", back_populates="job", cascade="all, delete-orphan"
    )
    schedules = relationship("Schedule", back_populates="job")


class JobSave(Base):
    __tablename__ = "job_saves"

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
    created_at = Column(
        DateTime, default=datetime.now, server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("student_id", "job_id", name="uq_student_job"),
    )

    student = relationship("StudentProfile", back_populates="job_saves")
    job = relationship("Job", back_populates="job_saves")


# Aliases tương thích với Nhánh A & Nhánh B
JobCategoryModel = JobCategory
JobLocationModel = JobLocation
JobModel = Job
JobPost = Job
JobSaveModel = JobSave
