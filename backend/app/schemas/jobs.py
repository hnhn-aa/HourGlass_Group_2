from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.job import JobStatusEnum, JobTypeEnum, LocationTypeEnum


def _strip_required_text(value: str, field_label: str, min_len: int = 1) -> str:
    cleaned = value.strip()
    if len(cleaned) < min_len:
        raise ValueError(f"{field_label} phải có ít nhất {min_len} ký tự hợp lệ")
    return cleaned


# ── Category ──────────────────────────────────────────────
class JobCategoryCreate(BaseModel):
    name: str = Field(max_length=150)
    description: Optional[str] = None


class JobCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None


class JobCategoryOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


# ── Location ─────────────────────────────────────────────
class JobLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: LocationTypeEnum | str
    parent_id: Optional[int] = None


JobLocationOutSchema = JobLocationResponse


# ── Job (Nhánh B) ────────────────────────────────────────
class JobCreate(BaseModel):
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    requirements: Optional[str] = None
    salary_min: Optional[Decimal] = Field(default=None, ge=0)
    salary_max: Optional[Decimal] = Field(default=None, ge=0)
    job_type: JobTypeEnum = JobTypeEnum.PART_TIME
    work_time: Optional[str] = None
    quantity: Optional[int] = Field(default=1, ge=1)
    experience_level: Optional[str] = None
    benefits: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    image_url: Optional[str] = None


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employer_id: Optional[int] = None
    recruiter_id: Optional[int] = None
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
    image_url: Optional[str] = None
    status: JobStatusEnum
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    category: Optional[JobCategoryResponse] = None
    location: Optional[JobLocationResponse] = None


class PaginatedJobs(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[JobResponse]


class JobApproveReject(BaseModel):
    rejected_reason: Optional[str] = None


# ── Job Schemas (Tích hợp từ Nhánh A) ────────────────────
class JobCreateSchema(BaseModel):
    recruiter_id: int = Field(..., gt=0, examples=[1], description="ID trong employer_profiles / recruiter_profiles")
    category_id: int = Field(..., gt=0, examples=[1], description="ID trong job_categories")
    location_id: int = Field(..., gt=0, examples=[2], description="ID trong job_locations")
    title: str = Field(..., min_length=3, max_length=255, examples=["Nhân viên pha chế part-time"])
    description: str = Field(
        ...,
        min_length=10,
        examples=["Chuẩn bị đồ uống theo công thức chuẩn và phục vụ khách hàng."],
    )
    requirements: str | None = Field(default=None, examples=["Nhanh nhẹn, trung thực."])
    salary_min: float | None = Field(default=None, ge=0, examples=[28000])
    salary_max: float | None = Field(default=None, ge=0, examples=[35000])
    job_type: JobTypeEnum = Field(default=JobTypeEnum.PART_TIME)
    work_time: str | None = Field(default=None, max_length=255, examples=["17:00 - 22:00"])
    quantity: int = Field(default=1, ge=1)
    experience_level: str | None = Field(default=None, max_length=100, examples=["Không yêu cầu"])
    benefits: str | None = Field(default=None, examples=["Bao ăn theo ca, thưởng KPI."])
    start_date: date | None = Field(default=None, examples=["2026-11-20"])
    end_date: date | None = Field(default=None, examples=["2027-05-20"])
    image_url: str | None = Field(
        default=None,
        description="URL hình ảnh / thumbnail của công việc",
    )
    status: Literal[JobStatusEnum.PENDING, JobStatusEnum.APPROVED] = Field(
        default=JobStatusEnum.PENDING,
        description="Mặc định 'pending' (chờ Admin duyệt) hoặc 'approved' (duyệt ngay)",
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        return _strip_required_text(v, "Tiêu đề công việc", 3)

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        return _strip_required_text(v, "Mô tả công việc", 10)

    @model_validator(mode="after")
    def validate_ranges(self) -> "JobCreateSchema":
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_max < self.salary_min
        ):
            raise ValueError("salary_max không được nhỏ hơn salary_min")
        if self.end_date is not None and self.end_date < date.today():
            raise ValueError("Ngày kết thúc tuyển (end_date) không được ở quá khứ")
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date không được nhỏ hơn start_date")
        return self


class JobUpdateSchema(BaseModel):
    category_id: int | None = Field(default=None, gt=0)
    location_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    requirements: str | None = None
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    job_type: JobTypeEnum | None = None
    work_time: str | None = Field(default=None, max_length=255)
    quantity: int | None = Field(default=None, ge=1)
    experience_level: str | None = Field(default=None, max_length=100)
    benefits: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    image_url: str | None = None
    status: Literal[JobStatusEnum.PENDING, JobStatusEnum.APPROVED, JobStatusEnum.CLOSED] | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        return _strip_required_text(v, "Tiêu đề công việc", 3) if v is not None else None

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        return _strip_required_text(v, "Mô tả công việc", 10) if v is not None else None


JobUpdate = JobUpdateSchema


class JobReviewSchema(BaseModel):
    """Schema cho Admin tiếp nhận & duyệt tin đăng mới."""

    status: Literal[
        JobStatusEnum.APPROVED,
        JobStatusEnum.REJECTED,
        JobStatusEnum.CLOSED,
    ]
    approved_by: int | None = Field(
        default=None,
        gt=0,
        description="ID trong bảng admin_profiles (nếu bỏ trống hệ thống tự lấy Admin đầu tiên)",
    )
    rejected_reason: str | None = Field(
        default=None,
        max_length=1000,
        description="Lý do từ chối nếu chọn trạng thái rejected",
    )


class JobOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recruiter_id: int | None = None
    employer_id: int | None = None
    category_id: int | None = None
    location_id: int | None = None
    approved_by: int | None = None
    title: str
    description: str
    requirements: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    job_type: JobTypeEnum
    work_time: str | None = None
    quantity: int
    experience_level: str | None = None
    benefits: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    image_url: str | None = None
    status: JobStatusEnum
    approved_at: datetime | None = None
    rejected_reason: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
