from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.application import (
    Application,
    ApplicationStatusNameEnum,
    ApplicationStatusRef,
    CV,
)
from app.models.job import Job, JobCategory, JobLocation, JobSave, JobStatusEnum
from app.models.profile import EmployerProfile
from app.models.report import Report, ReportStatusEnum, ReportTypeEnum
from app.models.review import Review
from app.models.user import RoleEnum, User, UserStatusEnum
from app.schemas.reports import ReportCreateSchema, ReportHandleSchema


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


def _get_report_or_404(db: Session, report_id: int) -> Report:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy báo cáo khiếu nại (reports.id = {report_id})",
        )
    return report


def _validate_report_target(
    db: Session, report_type: ReportTypeEnum, target_id: int
) -> None:
    if report_type == ReportTypeEnum.JOB:
        _get_job_or_404(db, target_id)
    elif report_type == ReportTypeEnum.EMPLOYER:
        profile = (
            db.query(EmployerProfile)
            .filter(EmployerProfile.id == target_id)
            .first()
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hồ sơ nhà tuyển dụng (employer_profiles.id = {target_id})",
            )
    elif report_type == ReportTypeEnum.USER:
        _get_user_or_404(db, target_id)
    elif report_type == ReportTypeEnum.APPLICATION:
        app = db.query(Application).filter(Application.id == target_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hồ sơ ứng tuyển (applications.id = {target_id})",
            )


def create_report(db: Session, report_data: ReportCreateSchema) -> Report:
    _get_user_or_404(db, report_data.reporter_id, "người khiếu nại")
    _validate_report_target(db, report_data.report_type, report_data.target_id)

    existing_pending = (
        db.query(Report)
        .filter(
            Report.reporter_id == report_data.reporter_id,
            Report.report_type == report_data.report_type,
            Report.target_id == report_data.target_id,
            Report.status == ReportStatusEnum.PENDING,
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đã gửi khiếu nại cho đối tượng này và đang chờ Admin xử lý",
        )

    now = datetime.now()
    new_report = Report(
        reporter_id=report_data.reporter_id,
        report_type=report_data.report_type,
        target_id=report_data.target_id,
        reason=report_data.reason,
        status=ReportStatusEnum.PENDING,
        created_at=now,
        updated_at=now,
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report


def get_reports(
    db: Session,
    status_filter: ReportStatusEnum | None = None,
    report_type: ReportTypeEnum | None = None,
    target_id: int | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[Report]]:
    query = db.query(Report)
    if status_filter is not None:
        query = query.filter(Report.status == status_filter)
    if report_type is not None:
        query = query.filter(Report.report_type == report_type)
    if target_id is not None:
        query = query.filter(Report.target_id == target_id)

    total = query.count()
    priority_order = case(
        (Report.status == ReportStatusEnum.PENDING, 0),
        else_=1,
    )
    items = (
        query.order_by(
            priority_order,
            Report.created_at.desc(),
            Report.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items


def get_report_by_id(db: Session, report_id: int) -> Report:
    return _get_report_or_404(db, report_id)


def process_report(
    db: Session,
    report_id: int,
    handle_data: ReportHandleSchema,
) -> tuple[Report, bool]:
    report = _get_report_or_404(db, report_id)
    if report.status != ReportStatusEnum.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Khiếu nại này đã được xử lý trước đó",
        )

    report.status = handle_data.status
    report.admin_note = (
        handle_data.admin_note.strip() if handle_data.admin_note else None
    )
    report.updated_at = datetime.now()

    job_removed = False
    if (
        handle_data.status == ReportStatusEnum.RESOLVED
        and handle_data.remove_job
        and report.report_type == ReportTypeEnum.JOB
    ):
        job = _get_job_or_404(db, report.target_id)
        if job.status != JobStatusEnum.REJECTED:
            job.status = JobStatusEnum.REJECTED
            job.rejected_reason = report.admin_note or report.reason
            job.updated_at = datetime.now()
            job_removed = True

            other_pending = (
                db.query(Report)
                .filter(
                    Report.report_type == ReportTypeEnum.JOB,
                    Report.target_id == report.target_id,
                    Report.id != report.id,
                    Report.status == ReportStatusEnum.PENDING,
                )
                .all()
            )
            for other in other_pending:
                other.status = ReportStatusEnum.RESOLVED
                other.admin_note = (
                    f"Tin tuyển dụng đã bị gỡ từ khiếu nại #{report.id}"
                )
                other.updated_at = datetime.now()

    db.commit()
    db.refresh(report)
    return report, job_removed


def get_system_statistics(db: Session) -> dict:
    """Thống kê tổng hợp toàn hệ thống HourGlass."""
    user_stats = db.query(
        func.count(User.id).label("total"),
        func.sum(case((User.role == RoleEnum.STUDENT, 1), else_=0)).label(
            "students"
        ),
        func.sum(
            case(
                (User.role.in_([RoleEnum.EMPLOYER, RoleEnum.RECRUITER]), 1),
                else_=0,
            )
        ).label("employers"),
        func.sum(case((User.role == RoleEnum.ADMIN, 1), else_=0)).label(
            "admins"
        ),
        func.sum(case((User.status == UserStatusEnum.ACTIVE, 1), else_=0)).label(
            "active"
        ),
        func.sum(case((User.status == UserStatusEnum.LOCKED, 1), else_=0)).label(
            "locked"
        ),
    ).one()

    job_stats = db.query(
        func.count(Job.id).label("total"),
        func.sum(case((Job.status == JobStatusEnum.PENDING, 1), else_=0)).label(
            "pending"
        ),
        func.sum(case((Job.status == JobStatusEnum.APPROVED, 1), else_=0)).label(
            "approved"
        ),
        func.sum(case((Job.status == JobStatusEnum.REJECTED, 1), else_=0)).label(
            "rejected"
        ),
        func.sum(case((Job.status == JobStatusEnum.CLOSED, 1), else_=0)).label(
            "closed"
        ),
    ).one()

    app_rows = (
        db.query(
            ApplicationStatusRef.name,
            func.count(Application.id).label("cnt"),
        )
        .outerjoin(
            Application,
            Application.status_id == ApplicationStatusRef.id,
        )
        .group_by(ApplicationStatusRef.id, ApplicationStatusRef.name)
        .all()
    )
    app_by_status = {row.name: int(row.cnt or 0) for row in app_rows}
    total_apps = sum(app_by_status.values())
    accepted_apps = app_by_status.get(
        ApplicationStatusNameEnum.ACCEPTED.value, 0
    )
    success_rate = (
        round((accepted_apps / total_apps * 100), 2) if total_apps > 0 else 0.0
    )

    report_stats = db.query(
        func.count(Report.id).label("total"),
        func.sum(
            case((Report.status == ReportStatusEnum.PENDING, 1), else_=0)
        ).label("pending"),
        func.sum(
            case((Report.status == ReportStatusEnum.RESOLVED, 1), else_=0)
        ).label("resolved"),
        func.sum(
            case((Report.status == ReportStatusEnum.REJECTED, 1), else_=0)
        ).label("rejected"),
    ).one()

    review_stats = db.query(
        func.count(Review.id).label("total"),
        func.avg(Review.rating).label("avg_rating"),
    ).one()

    return {
        "users": {
            "total": int(user_stats.total or 0),
            "students": int(user_stats.students or 0),
            "employers": int(user_stats.employers or 0),
            "admins": int(user_stats.admins or 0),
            "active": int(user_stats.active or 0),
            "locked": int(user_stats.locked or 0),
        },
        "jobs": {
            "total": int(job_stats.total or 0),
            "pending": int(job_stats.pending or 0),
            "approved": int(job_stats.approved or 0),
            "rejected": int(job_stats.rejected or 0),
            "closed": int(job_stats.closed or 0),
        },
        "applications": {
            "total": total_apps,
            "by_status": app_by_status,
            "accepted": accepted_apps,
            "success_rate_percent": success_rate,
        },
        "reports": {
            "total": int(report_stats.total or 0),
            "pending": int(report_stats.pending or 0),
            "resolved": int(report_stats.resolved or 0),
            "rejected": int(report_stats.rejected or 0),
        },
        "reviews": {
            "total": int(review_stats.total or 0),
            "average_system_rating": (
                round(float(review_stats.avg_rating), 2)
                if review_stats.avg_rating is not None
                else 0.0
            ),
        },
        "resources": {
            "categories": int(
                db.query(func.count(JobCategory.id)).scalar() or 0
            ),
            "locations": int(
                db.query(func.count(JobLocation.id)).scalar() or 0
            ),
            "cvs": int(db.query(func.count(CV.id)).scalar() or 0),
            "job_saves": int(db.query(func.count(JobSave.id)).scalar() or 0),
        },
    }


def get_employer_statistics(db: Session, recruiter_id: int) -> dict:
    """KPI cho trang quản lý Nhà tuyển dụng (recruiter_id = employer_profiles.id)."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == recruiter_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ nhà tuyển dụng (id = {recruiter_id})",
        )
    job_ids = [
        row[0]
        for row in db.query(Job.id)
        .filter((Job.recruiter_id == recruiter_id) | (Job.employer_id == profile.user_id))
        .all()
    ]
    jobs_by_status = {s.value: 0 for s in JobStatusEnum}
    if job_ids:
        for st, cnt in (
            db.query(Job.status, func.count(Job.id))
            .filter(Job.id.in_(job_ids))
            .group_by(Job.status)
            .all()
        ):
            jobs_by_status[st.value if hasattr(st, "value") else str(st)] = int(cnt)

    apps_by_status = {s.value: 0 for s in ApplicationStatusNameEnum}
    if job_ids:
        rows = (
            db.query(ApplicationStatusRef.name, func.count(Application.id))
            .join(Application, Application.status_id == ApplicationStatusRef.id)
            .filter(Application.job_id.in_(job_ids))
            .group_by(ApplicationStatusRef.name)
            .all()
        )
        for name, cnt in rows:
            apps_by_status[name] = int(cnt)
    total_apps = sum(apps_by_status.values())
    accepted = apps_by_status.get("accepted", 0)
    return {
        "recruiter_id": recruiter_id,
        "jobs": {"total": len(job_ids), **jobs_by_status},
        "applications": {
            "total": total_apps,
            "by_status": apps_by_status,
            "new": apps_by_status.get("submitted", 0),
            "accepted": accepted,
            "success_rate_percent": round(accepted / total_apps * 100, 2) if total_apps else 0.0,
        },
    }
