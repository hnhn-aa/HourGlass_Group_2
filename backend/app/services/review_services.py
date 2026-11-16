from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatusEnum
from app.models.profile import EmployerProfile
from app.models.report import Report, ReportStatusEnum, ReportTypeEnum
from app.models.review import Review
from app.models.user import User
from app.schemas.reviews import ReviewCreateSchema, ReviewOutSchema


def _get_user_or_404(
    db: Session, user_id: int, label: str = "người dùng"
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy {label} (users.id = {user_id})",
        )
    return user


def _get_job_or_404(db: Session, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tin tuyển dụng (jobs.id = {job_id})",
        )
    return job


def create_review(db: Session, review_data: ReviewCreateSchema) -> Review:
    _get_user_or_404(db, review_data.reviewer_id, "người đánh giá")
    _get_user_or_404(db, review_data.target_id, "người được đánh giá")

    if review_data.job_id is not None:
        _get_job_or_404(db, review_data.job_id)

    dup_query = db.query(Review).filter(
        Review.reviewer_id == review_data.reviewer_id,
        Review.target_id == review_data.target_id,
    )
    if review_data.job_id is not None:
        dup_query = dup_query.filter(Review.job_id == review_data.job_id)

    if dup_query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đã đánh giá người dùng này rồi",
        )

    new_review = Review(
        reviewer_id=review_data.reviewer_id,
        target_id=review_data.target_id,
        job_id=review_data.job_id,
        rating=review_data.rating,
        comment=review_data.comment.strip() if review_data.comment else None,
        created_at=datetime.now(),
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)
    return new_review


def _compute_reputation_badge(
    avg_rating: float,
    total_reviews: int,
    rejected_jobs_count: int,
    resolved_violation_reports: int,
    is_verified_employer: bool,
) -> str:
    if (
        rejected_jobs_count > 0
        or resolved_violation_reports > 0
        or (total_reviews > 0 and avg_rating < 2.5)
    ):
        return "Cảnh báo uy tín thấp"
    if total_reviews == 0:
        return (
            "Nhà tuyển dụng đã xác minh"
            if is_verified_employer
            else "Chưa có đánh giá"
        )
    if avg_rating >= 4.5:
        return "Rất uy tín"
    if avg_rating >= 3.5:
        return "Uy tín tốt"
    return "Trung bình"


def get_user_reputation_stats(db: Session, user_id: int) -> dict:
    user = _get_user_or_404(db, user_id)

    rating_rows = (
        db.query(
            Review.rating,
            func.count(Review.id).label("cnt"),
        )
        .filter(Review.target_id == user_id)
        .group_by(Review.rating)
        .all()
    )

    breakdown = {str(star): 0 for star in range(1, 6)}
    total_reviews = 0
    total_score = 0
    for row in rating_rows:
        cnt = int(row.cnt or 0)
        breakdown[str(row.rating)] = cnt
        total_reviews += cnt
        total_score += int(row.rating) * cnt

    avg_score = round(total_score / total_reviews, 2) if total_reviews > 0 else 0.0

    recruiter_profile = (
        db.query(EmployerProfile)
        .filter(EmployerProfile.user_id == user_id)
        .first()
    )
    rejected_jobs_count = 0
    resolved_reports_count = 0
    is_verified_employer = False

    if recruiter_profile:
        is_verified_employer = bool(recruiter_profile.verified)
        rejected_jobs_count = int(
            db.query(func.count(Job.id))
            .filter(
                or_(
                    Job.recruiter_id == recruiter_profile.id,
                    Job.employer_id == user_id,
                ),
                Job.status == JobStatusEnum.REJECTED,
            )
            .scalar()
            or 0
        )
        resolved_reports_count = int(
            db.query(func.count(Report.id))
            .filter(
                Report.report_type == ReportTypeEnum.EMPLOYER,
                Report.target_id == recruiter_profile.id,
                Report.status == ReportStatusEnum.RESOLVED,
            )
            .scalar()
            or 0
        )

    recent_reviews = (
        db.query(Review)
        .filter(Review.target_id == user_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(5)
        .all()
    )

    return {
        "user_id": user.id,
        "full_name": user.full_name,
        "role": user.role.value,
        "verified_employer": is_verified_employer,
        "average_rating": avg_score,
        "total_reviews": total_reviews,
        "rating_breakdown": breakdown,
        "rejected_jobs_count": rejected_jobs_count,
        "resolved_reports_count": resolved_reports_count,
        "reputation_badge": _compute_reputation_badge(
            avg_score,
            total_reviews,
            rejected_jobs_count,
            resolved_reports_count,
            is_verified_employer,
        ),
        "recent_reviews": [
            ReviewOutSchema.model_validate(r) for r in recent_reviews
        ],
    }


def get_user_reviews(
    db: Session, user_id: int, skip: int = 0, limit: int = 20
) -> tuple[int, list[Review]]:
    _get_user_or_404(db, user_id)
    query = db.query(Review).filter(Review.target_id == user_id)
    total = query.count()
    items = (
        query.order_by(Review.created_at.desc(), Review.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items
