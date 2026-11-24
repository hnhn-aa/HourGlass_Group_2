from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.middleware import ensure_self_or_admin, get_optional_user
from app.models.review import Review
from app.models.user import User
from app.schemas.reviews import ReviewCreateSchema, ReviewOutSchema
from app.services.review_services import (
    create_review as create_review_service,
    get_user_reputation_stats,
    get_user_reviews as get_user_reviews_service,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


@router.post(
    "/api/reviews",
    status_code=status.HTTP_201_CREATED,
    tags=["Reviews"],
    summary="Đánh giá và chấm điểm uy tín (1 - 5 sao)",
)
def create_review(
    review_data: ReviewCreateSchema,
    db: DbSession,
    current_user: OptionalUser,
):
    ensure_self_or_admin(current_user, review_data.reviewer_id, "gửi đánh giá")
    review = create_review_service(db, review_data)
    return {
        "success": True,
        "message": "Gửi đánh giá thành công",
        "review": ReviewOutSchema.model_validate(review),
    }


@router.get(
    "/api/reviews",
    tags=["Reviews"],
    summary="Danh sách đánh giá (lọc theo người đánh giá / người được đánh giá / tin tuyển dụng)",
)
def list_reviews(
    db: DbSession,
    reviewer_id: int | None = Query(default=None, gt=0),
    target_id: int | None = Query(default=None, gt=0),
    job_id: int | None = Query(default=None, gt=0),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    query = db.query(Review)
    if reviewer_id is not None:
        query = query.filter(Review.reviewer_id == reviewer_id)
    if target_id is not None:
        query = query.filter(Review.target_id == target_id)
    if job_id is not None:
        query = query.filter(Review.job_id == job_id)
    total = query.count()
    items = (
        query.order_by(Review.created_at.desc(), Review.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "reviews": [ReviewOutSchema.model_validate(r) for r in items],
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
