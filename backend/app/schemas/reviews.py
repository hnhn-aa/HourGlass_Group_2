from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReviewCreateSchema(BaseModel):
    reviewer_id: int = Field(..., gt=0, examples=[1], description="ID trong users")
    target_id: int = Field(..., gt=0, examples=[4], description="ID trong users")
    job_id: int | None = Field(default=None, gt=0)
    rating: int = Field(..., ge=1, le=5, description="Điểm đánh giá từ 1 đến 5 sao")
    comment: str | None = Field(
        default=None,
        max_length=1000,
        examples=["Môi trường làm việc rất tốt, trả lương đúng hạn."],
    )

    @model_validator(mode="after")
    def validate_distinct_users(self) -> "ReviewCreateSchema":
        if self.reviewer_id == self.target_id:
            raise ValueError("Không thể tự đánh giá uy tín của chính mình")
        return self


class ReviewOutSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reviewer_id: int
    target_id: int
    job_id: int | None = None
    rating: int
    comment: str | None = None
    created_at: datetime
