from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.reviews import ReviewCreateSchema, ReviewOutSchema
from app.services.review_services import (
    create_review as create_review_service,
    get_user_reputation_stats,
    get_user_reviews as get_user_reviews_service,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/api/reviews",
    status_code=status.HTTP_201_CREATED,
    tags=["Reviews"],
    summary="Đánh giá và chấm điểm uy tín (1 - 5 sao)",
)
def create_review(review_data: ReviewCreateSchema, db: DbSession):
    review = create_review_service(db, review_data)
    return {
        "success": True,
        "review": ReviewOutSchema.model_validate(review),
    }


@router.get(
    "/api/users/{user_id}/reputation",
    tags=["Reviews"],
    summary="Xem điểm uy tín và tổng hợp đánh giá của người dùng",
)
def get_user_reputation(user_id: int, db: DbSession):
    stats = get_user_reputation_stats(db, user_id)
    return {"success": True, **stats}


@router.get(
    "/api/users/{user_id}/reviews",
    tags=["Reviews"],
    summary="Danh sách đánh giá chi tiết của một người dùng",
)
def get_user_reviews(
    user_id: int,
    db: DbSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    total, reviews = get_user_reviews_service(db, user_id, skip=skip, limit=limit)
    return {
        "success": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "reviews": [ReviewOutSchema.model_validate(r) for r in reviews],
    }
