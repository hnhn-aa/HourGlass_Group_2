from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.application import ApplicationStatusNameEnum, CVFileTypeEnum


class ApplicationStatusOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    display_order: int


class CVOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    file_name: str
    file_url: str
    file_type: CVFileTypeEnum
    is_default: bool
    uploaded_at: datetime


class ApplicationCreateSchema(BaseModel):
    student_id: int = Field(..., gt=0, examples=[1], description="ID trong student_profiles")
    job_id: int = Field(..., gt=0, examples=[3])
    cv_id: int | None = Field(default=None, gt=0, description="ID CV có sẵn trong bảng cvs")
    cv_url: str | None = Field(
        default=None,
        max_length=500,
        examples=["/uploads/sample_cv_tai.pdf"],
        description="Hoặc truyền đường dẫn CV mới nếu không dùng cv_id",
    )
    cover_letter: str | None = Field(
        default=None,
        examples=["Em mong muốn ứng tuyển vị trí này."],
    )


class StatusUpdateSchema(BaseModel):
    status: ApplicationStatusNameEnum = Field(
        ...,
        description="submitted, reviewing, interview, accepted, rejected, withdrawn",
    )
    changed_by: int | None = Field(
        default=None,
        gt=0,
        description="ID user thực hiện cập nhật (nếu bỏ trống hệ thống tự lấy user của nhà tuyển dụng/sinh viên)",
    )
    note: str | None = Field(default=None, max_length=1000)


class ApplicationStatusLogOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    status_id: int
    status_name: str | None = None
    changed_by: int
    note: str | None = None
    changed_at: datetime


class ApplicationOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    job_id: int
    cv_id: int | None = None
    cv_url: str | None = None
    status_id: int
    status_name: str | None = None
    cover_letter: str | None = None
    applied_at: datetime
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None
