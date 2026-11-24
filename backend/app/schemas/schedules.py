from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AvailabilityCreateSchema(BaseModel):
    student_id: int = Field(..., gt=0, description="ID trong student_profiles")
    day_of_week: int = Field(..., ge=1, le=7, description="1 (Thứ 2) đến 7 (Chủ nhật)")
    start_time: time
    end_time: time
    is_available: bool = True

    @model_validator(mode="after")
    def validate_times(self) -> "AvailabilityCreateSchema":
        if self.end_time <= self.start_time:
            raise ValueError("end_time phải lớn hơn start_time")
        return self


class AvailabilityOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    day_of_week: int
    start_time: time
    end_time: time
    is_available: bool
    created_at: datetime
    updated_at: datetime | None = None


class ScheduleCreateSchema(BaseModel):
    student_id: int = Field(..., gt=0, description="ID trong student_profiles")
    job_id: int | None = Field(default=None, gt=0)
    title: str = Field(..., min_length=2, max_length=255)
    start_datetime: datetime
    end_datetime: datetime
    note: str | None = None

    @model_validator(mode="after")
    def validate_datetimes(self) -> "ScheduleCreateSchema":
        if self.end_datetime <= self.start_datetime:
            raise ValueError("end_datetime phải lớn hơn start_datetime")
        return self


class ScheduleUpdateSchema(BaseModel):
    """Sửa ca làm việc: chỉ gửi các trường cần đổi (các trường bỏ trống giữ nguyên)."""

    job_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=2, max_length=255)
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    note: str | None = None

    @model_validator(mode="after")
    def validate_datetimes(self) -> "ScheduleUpdateSchema":
        if (
            self.start_datetime is not None
            and self.end_datetime is not None
            and self.end_datetime <= self.start_datetime
        ):
            raise ValueError("end_datetime phải lớn hơn start_datetime")
        return self


class ScheduleOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    job_id: int | None = None
    title: str
    start_datetime: datetime
    end_datetime: datetime
    note: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
