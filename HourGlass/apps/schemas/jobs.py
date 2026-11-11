from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from apps.models.job import JobTypeEnum, JobStatusEnum


# ── Category ──────────────────────────────────────────────
class JobCategoryCreate(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = None


class JobCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Location ─────────────────────────────────────────────
class JobLocationResponse(BaseModel):
    id: int
    name: str
    type: str
    parent_id: Optional[int] = None

    model_config = {"from_attributes": True}


# ── Job ──────────────────────────────────────────────────
class JobCreate(BaseModel):
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    title: str = Field(min_length=5, max_length=255)
    description: str = Field(min_length=10)
    requirements: Optional[str] = None
    salary_min: Optional[Decimal] = Field(default=None, ge=0)
    salary_max: Optional[Decimal] = Field(default=None, ge=0)
    job_type: JobTypeEnum = JobTypeEnum.PART_TIME
    work_time: Optional[str] = None
    quantity: Optional[int] = Field(default=None, ge=1)
    experience_level: Optional[str] = None
    benefits: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class JobResponse(BaseModel):
    id: int
    employer_id: int
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    title: str
    description: str
    requirements: Optional[str] = None
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    job_type: JobTypeEnum
    work_time: Optional[str] = None
    quantity: Optional[int] = None
    experience_level: Optional[str] = None
    benefits: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: JobStatusEnum
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    category: Optional[JobCategoryResponse] = None
    location: Optional[JobLocationResponse] = None

    model_config = {"from_attributes": True}


class PaginatedJobs(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[JobResponse]


# ── Job Approve / Reject (Admin) ─────────────────────────
class JobApproveReject(BaseModel):
    rejected_reason: Optional[str] = None
