from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal

from apps.db.database import get_db
from apps.schemas.jobs import (
    JobCategoryResponse, JobCategoryCreate,
    JobLocationResponse,
    JobResponse, JobCreate, PaginatedJobs, JobApproveReject,
)
from apps.services.job_services import (
    get_all_categories, get_category_by_id, create_category,
    get_all_locations, get_location_by_id,
    get_jobs, get_job_by_id, create_job, get_employer_jobs,
    approve_job, reject_job, get_all_jobs_admin,
)
from apps.models.job import JobTypeEnum, JobStatusEnum
from apps.dependencies.middleware import (
    get_employer_user, get_admin_user,
)
from apps.models.user import User

router = APIRouter(prefix="/jobs", tags=["Jobs – Tìm kiếm & Quản lý"])


# ═══════════════════════ KHÁCH + SINH VIÊN ═══════════════
# Use case: Xem danh sách việc làm, Tìm kiếm và lọc việc làm
@router.get("", response_model=PaginatedJobs)
def search_jobs(
    keyword: Optional[str] = Query(default=None, description="Từ khóa (tiêu đề/mô tả)"),
    category_id: Optional[int] = Query(default=None, description="Danh mục"),
    location_id: Optional[int] = Query(default=None, description="Địa điểm"),
    job_type: Optional[JobTypeEnum] = Query(default=None, description="Loại công việc"),
    salary_min: Optional[Decimal] = Query(default=None, ge=0),
    salary_max: Optional[Decimal] = Query(default=None, ge=0),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Khách & Sinh viên: Xem danh sách việc làm đã duyệt, tìm kiếm, lọc đa tiêu chí, phân trang."""
    return get_jobs(
        db=db,
        keyword=keyword,
        category_id=category_id,
        location_id=location_id,
        job_type=job_type,
        salary_min=salary_min,
        salary_max=salary_max,
        page=page,
        page_size=page_size,
    )


# Use case: Xem chi tiết công việc
@router.get("/{job_id}", response_model=JobResponse)
def get_job_detail(job_id: int, db: Session = Depends(get_db)):
    """Khách & Sinh viên: Xem chi tiết công việc."""
    return get_job_by_id(job_id, db)


# ═══════════════════════ NHÀ TUYỂN DỤNG ══════════════════
# Use case: Đăng tin tuyển dụng
@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def post_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Đăng tin mới (chờ admin kiểm duyệt)."""
    return create_job(data, current_user, db)


# Use case: Quản lý tin tuyển dụng (xem các tin của mình)
@router.get("/employer/my-jobs", response_model=list[JobResponse])
def my_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Quản lý danh sách các tin mình đã đăng."""
    return get_employer_jobs(current_user, db)


# ═══════════════════════ QUẢN TRỊ VIÊN ═══════════════════
# Use case: Kiểm duyệt tin tuyển dụng
@router.get("/admin/all", response_model=list[JobResponse])
def list_jobs_for_admin(
    status_filter: Optional[JobStatusEnum] = Query(default=None, description="Lọc theo status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Xem tất cả tin (kể cả pending, rejected)."""
    return get_all_jobs_admin(db, status_filter)


@router.put("/admin/{job_id}/approve", response_model=JobResponse)
def approve_job_post(
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Admin: Duyệt tin tuyển dụng."""
    return approve_job(job_id, admin, db)


@router.put("/admin/{job_id}/reject", response_model=JobResponse)
def reject_job_post(
    job_id: int,
    body: JobApproveReject,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Admin: Từ chối tin tuyển dụng với lý do."""
    return reject_job(job_id, admin, body.rejected_reason, db)


# Use case: Quản lý danh mục
@router.get("/categories", response_model=list[JobCategoryResponse])
def categories(db: Session = Depends(get_db)):
    """Tất cả mọi người: Xem danh mục công việc."""
    return get_all_categories(db)


@router.post("/categories", response_model=JobCategoryResponse, status_code=status.HTTP_201_CREATED)
def add_category(
    data: JobCategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Thêm danh mục mới."""
    return create_category(data, db)


# ── Địa điểm ─────────────────────────────────────────────
@router.get("/locations", response_model=list[JobLocationResponse])
def locations(
    parent_id: Optional[int] = Query(default=None),
    type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Tất cả mọi người: Xem danh sách địa điểm."""
    return get_all_locations(db, parent_id=parent_id, loc_type=type)
