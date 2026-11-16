from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.report import ReportStatusEnum, ReportTypeEnum


def _strip_required_text(value: str, field_label: str, min_len: int = 1) -> str:
    cleaned = value.strip()
    if len(cleaned) < min_len:
        raise ValueError(f"{field_label} phải có ít nhất {min_len} ký tự hợp lệ")
    return cleaned


class ReportCreateSchema(BaseModel):
    reporter_id: int = Field(..., gt=0, examples=[1], description="ID trong users")
    report_type: ReportTypeEnum = Field(
        default=ReportTypeEnum.JOB,
        description="job, employer, user, application, other",
    )
    target_id: int = Field(
        ...,
        gt=0,
        examples=[1],
        description="ID của đối tượng bị khiếu nại theo report_type",
    )
    reason: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        examples=["Tin tuyển dụng có thông tin lương không rõ ràng."],
    )

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        return _strip_required_text(v, "Lý do khiếu nại", 5)


class ReportHandleSchema(BaseModel):
    status: Literal[ReportStatusEnum.RESOLVED, ReportStatusEnum.REJECTED]
    admin_note: str | None = Field(
        default=None,
        max_length=2000,
        examples=["Đã xác minh vi phạm và xử lý tin đăng."],
    )
    remove_job: bool = Field(
        default=False,
        description="Nếu true và status='resolved' với report_type='job', tự động gỡ/từ chối tin tuyển dụng",
    )


class ReportOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reporter_id: int
    report_type: ReportTypeEnum
    target_id: int
    reason: str
    status: ReportStatusEnum
    admin_note: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
