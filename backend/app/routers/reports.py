from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.middleware import verify_admin_or_internal
from app.models.report import ReportStatusEnum, ReportTypeEnum
from app.schemas.jobs import JobOutSchema, JobReviewSchema
from app.schemas.reports import (
    ReportCreateSchema,
    ReportHandleSchema,
    ReportOutSchema,
)
from app.services.job_services import (
    get_jobs_v1,
    remove_job_by_id,
    review_new_job,
)
from app.services.report_services import (
    create_report as create_report_service,
    get_report_by_id,
    get_reports as get_reports_service,
    get_system_statistics,
    process_report as process_report_service,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/api/reports",
    status_code=status.HTTP_201_CREATED,
    tags=["Reports"],
    summary="Gửi khiếu nại vi phạm (job, employer, user, application, other)",
)
def create_report(report_data: ReportCreateSchema, db: DbSession):
    report = create_report_service(db, report_data)
    return {
        "success": True,
        "report": ReportOutSchema.model_validate(report),
    }


@router.get(
    "/api/admin/jobs",
    tags=["Admin"],
    summary="Admin xem & tiếp nhận tin đăng theo trạng thái (mặc định tất cả)",
    dependencies=[Depends(verify_admin_or_internal)],
)
def admin_list_jobs(
    db: DbSession,
    status_filter: str = Query(
        default="all",
        alias="status",
        description="Lọc trạng thái: pending, approved, rejected, closed, all",
    ),
    keyword: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    total, jobs = get_jobs_v1(
        db,
        status_filter=status_filter,
        keyword=keyword,
        skip=skip,
        limit=limit,
    )
    return {
        "success": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "jobs": [JobOutSchema.model_validate(j) for j in jobs],
    }


@router.patch(
    "/api/admin/jobs/{job_id}/review",
    tags=["Admin"],
    summary="Admin tiếp nhận & duyệt tin đăng mới (approved / rejected / closed)",
    dependencies=[Depends(verify_admin_or_internal)],
)
def admin_review_job(
    job_id: int,
    review_data: JobReviewSchema,
    db: DbSession,
):
    job = review_new_job(db, job_id, review_data)
    return {
        "success": True,
        "message": f"Đã cập nhật trạng thái duyệt tin thành '{job.status.value}'",
        "job": JobOutSchema.model_validate(job),
    }


@router.delete(
    "/api/admin/jobs/{job_id}/remove",
    tags=["Admin"],
    summary="Admin gỡ/xóa tin đăng vi phạm (soft reject hoặc hard_delete=true)",
    dependencies=[Depends(verify_admin_or_internal)],
)
def admin_remove_violating_job(
    job_id: int,
    db: DbSession,
    reason: str | None = Query(
        default=None, description="Lý do gỡ tin tuyển dụng vi phạm"
    ),
    hard_delete: bool = Query(
        default=False, description="True để xóa hẳn dòng dữ liệu trong bảng jobs"
    ),
):
    job_out, resolved_count = remove_job_by_id(
        db,
        job_id,
        reason=reason,
        hard_delete=hard_delete,
        resolve_reports=True,
    )
    return {
        "success": True,
        "message": "Admin đã gỡ tin tuyển dụng vi phạm thành công",
        "job": job_out,
        "resolved_reports_count": resolved_count,
    }


@router.get(
    "/api/admin/reports",
    tags=["Admin"],
    summary="Admin tiếp nhận & xem danh sách khiếu nại",
    dependencies=[Depends(verify_admin_or_internal)],
)
def admin_list_reports(
    db: DbSession,
    status_filter: ReportStatusEnum | None = Query(
        default=None, alias="status", description="Lọc: pending, resolved, rejected"
    ),
    report_type: ReportTypeEnum | None = Query(default=None),
    target_id: int | None = Query(default=None, gt=0),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    total, reports = get_reports_service(
        db,
        status_filter=status_filter,
        report_type=report_type,
        target_id=target_id,
        skip=skip,
        limit=limit,
    )
    return {
        "success": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "reports": [ReportOutSchema.model_validate(r) for r in reports],
    }


@router.get(
    "/api/admin/reports/{report_id}",
    tags=["Admin"],
    summary="Admin xem chi tiết một khiếu nại",
    dependencies=[Depends(verify_admin_or_internal)],
)
def admin_get_report(report_id: int, db: DbSession):
    report = get_report_by_id(db, report_id)
    return {
        "success": True,
        "report": ReportOutSchema.model_validate(report),
    }


@router.patch(
    "/api/admin/reports/{report_id}",
    tags=["Admin"],
    summary="Admin xử lý khiếu nại (resolved / rejected)",
    dependencies=[Depends(verify_admin_or_internal)],
)
def process_report(
    report_id: int,
    status_data: ReportHandleSchema,
    db: DbSession,
):
    report, job_removed = process_report_service(db, report_id, status_data)
    return {
        "success": True,
        "report": ReportOutSchema.model_validate(report),
        "job_removed": job_removed,
    }


@router.get(
    "/api/admin/statistics",
    tags=["Admin"],
    summary="Thống kê dữ liệu toàn hệ thống cho Admin",
    dependencies=[Depends(verify_admin_or_internal)],
)
def get_statistics(db: DbSession):
    stats = get_system_statistics(db)
    return {"success": True, "statistics": stats}
