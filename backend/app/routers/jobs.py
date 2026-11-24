from decimal import Decimal
from pathlib import Path
from typing import Annotated, Optional
import uuid

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.paths import JOB_UPLOAD_DIR
from app.db.database import get_db
from app.dependencies.middleware import (
    get_admin_user,
    get_employer_user,
    get_optional_user,
    verify_admin_or_internal,
    verify_employer_or_internal,
    verify_student_or_internal,
)
from app.models.job import JobStatusEnum, JobTypeEnum
from app.models.user import RoleEnum, User
from app.schemas.jobs import (
    JobApproveReject,
    JobCategoryCreate,
    JobCategoryOutSchema,
    JobCategoryResponse,
    JobCreate,
    JobCreateSchema,
    JobLocationOutSchema,
    JobLocationResponse,
    JobOutSchema,
    JobResponse,
    JobUpdateSchema,
    PaginatedJobs,
)
from app.services.job_services import (
    approve_job,
    create_category,
    create_job,
    create_job_v1,
    delete_category,
    get_all_categories,
    get_all_jobs_admin,
    get_all_locations,
    get_categories,
    get_employer_jobs,
    get_job_by_id,
    get_jobs,
    get_jobs_v1,
    get_locations,
    get_saved_jobs,
    reject_job,
    remove_job_by_id,
    toggle_saved_job,
    update_category,
    update_job as update_job_service,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


# ═══════════════════════ JOBS & DANH MỤC (Nhánh B: /jobs/...) ═══════════════
@router.get(
    "/jobs",
    response_model=PaginatedJobs,
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
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


@router.post(
    "/jobs",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def post_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Đăng tin mới (chờ admin kiểm duyệt)."""
    return create_job(data, current_user, db)


@router.get(
    "/jobs/categories",
    response_model=list[JobCategoryResponse],
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def categories(db: Session = Depends(get_db)):
    """Tất cả mọi người: Xem danh mục công việc."""
    return get_all_categories(db)


@router.post(
    "/jobs/categories",
    response_model=JobCategoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def add_category(
    data: JobCategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Thêm danh mục mới."""
    return create_category(data, db)


@router.get(
    "/jobs/locations",
    response_model=list[JobLocationResponse],
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def locations(
    parent_id: Optional[int] = Query(default=None),
    type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Tất cả mọi người: Xem danh sách địa điểm."""
    return get_all_locations(db, parent_id=parent_id, loc_type=type)


@router.get(
    "/jobs/employer/my-jobs",
    response_model=list[JobResponse],
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def my_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employer_user),
):
    """Nhà tuyển dụng: Quản lý danh sách các tin mình đã đăng."""
    return get_employer_jobs(current_user, db)


@router.get(
    "/jobs/admin/all",
    response_model=list[JobResponse],
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def list_jobs_for_admin(
    status_filter: Optional[JobStatusEnum] = Query(
        default=None, description="Lọc theo status"
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Admin: Xem tất cả tin (kể cả pending, rejected)."""
    return get_all_jobs_admin(db, status_filter)


@router.put(
    "/jobs/admin/{job_id}/approve",
    response_model=JobResponse,
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def approve_job_post(
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Admin: Duyệt tin tuyển dụng."""
    return approve_job(job_id, admin, db)


@router.put(
    "/jobs/admin/{job_id}/reject",
    response_model=JobResponse,
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def reject_job_post(
    job_id: int,
    body: JobApproveReject,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Admin: Từ chối tin tuyển dụng với lý do."""
    return reject_job(job_id, admin, body.rejected_reason, db)


@router.get(
    "/jobs/{job_id}",
    response_model=JobResponse,
    tags=["Jobs – Tìm kiếm & Quản lý"],
)
def get_job_detail_v2(job_id: int, db: Session = Depends(get_db)):
    """Khách & Sinh viên: Xem chi tiết công việc."""
    return get_job_by_id(job_id, db)


# ═══════════════════════ JOBS & CATALOGS (Tích hợp từ Nhánh A: /api/...) ═════
@router.get(
    "/api/categories",
    tags=["Catalogs"],
    summary="Danh sách ngành nghề (job_categories)",
)
def list_categories_api(db: DbSession):
    cats = get_categories(db)
    return {
        "success": True,
        "total": len(cats),
        "categories": [JobCategoryOutSchema.model_validate(c) for c in cats],
    }


@router.post(
    "/api/categories",
    status_code=status.HTTP_201_CREATED,
    tags=["Catalogs"],
    summary="Thêm danh mục ngành nghề mới",
    dependencies=[Depends(verify_admin_or_internal)],
)
def create_category_api(data: JobCategoryCreate, db: DbSession):
    cat = create_category(data, db)
    return {
        "success": True,
        "category": JobCategoryOutSchema.model_validate(cat),
    }


@router.patch(
    "/api/categories/{category_id}",
    tags=["Catalogs"],
    summary="Cập nhật danh mục ngành nghề",
    dependencies=[Depends(verify_admin_or_internal)],
)
def update_category_api(
    category_id: int,
    db: DbSession,
    payload: dict = Body(...),
):
    cat = update_category(
        db,
        category_id,
        name=payload.get("name"),
        description=payload.get("description"),
    )
    return {
        "success": True,
        "category": JobCategoryOutSchema.model_validate(cat),
    }


@router.delete(
    "/api/categories/{category_id}",
    tags=["Catalogs"],
    summary="Xóa danh mục ngành nghề",
    dependencies=[Depends(verify_admin_or_internal)],
)
def delete_category_api(category_id: int, db: DbSession):
    delete_category(db, category_id)
    return {"success": True, "message": "Đã xóa danh mục thành công"}


@router.get(
    "/api/locations",
    tags=["Catalogs"],
    summary="Danh sách địa điểm (job_locations)",
)
def list_locations_api(db: DbSession):
    locs = get_locations(db)
    return {
        "success": True,
        "total": len(locs),
        "locations": [JobLocationOutSchema.model_validate(loc) for loc in locs],
    }


@router.get(
    "/api/job-saves",
    tags=["Jobs"],
    summary="Danh sách công việc đã lưu (job_saves)",
)
def list_job_saves_api(
    db: DbSession,
    student_id: int | None = Query(default=None, gt=0),
):
    saves = get_saved_jobs(db, student_id=student_id)
    return {
        "success": True,
        "total": len(saves),
        "job_saves": [
            {
                "id": s.id,
                "student_id": s.student_id,
                "job_id": s.job_id,
                "created_at": s.created_at,
            }
            for s in saves
        ],
    }


@router.post(
    "/api/job-saves/toggle",
    tags=["Jobs"],
    summary="Lưu hoặc bỏ lưu công việc yêu thích",
    dependencies=[Depends(verify_student_or_internal)],
)
def toggle_job_save_api(db: DbSession, payload: dict = Body(...)):
    student_id = int(payload.get("student_id") or 1)
    job_id = int(payload.get("job_id") or 1)
    saved = toggle_saved_job(db, student_id=student_id, job_id=job_id)
    return {"success": True, "saved": saved, "student_id": student_id, "job_id": job_id}


@router.post(
    "/api/jobs/upload-image",
    status_code=status.HTTP_201_CREATED,
    tags=["Jobs"],
    summary="Tải lên hình ảnh / thumbnail cho công việc (Chỉ Employer hoặc Admin, tối đa 5MB)",
    dependencies=[Depends(verify_employer_or_internal)],
)
async def upload_job_image_api(
    request: Request,
    file: UploadFile | None = File(default=None),
    image: UploadFile | None = File(default=None),
):
    upload_file = file or image
    if upload_file is None or not upload_file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng chọn một tệp hình ảnh để tải lên.",
        )

    ext = Path(upload_file.filename).suffix.lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng ảnh không hợp lệ. Chỉ chấp nhận .jpg, .jpeg, .png, .webp.",
        )

    content = await upload_file.read()
    max_size = 5 * 1024 * 1024  # 5MB
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp hình ảnh trống hoặc không hợp lệ.",
        )
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dung lượng ảnh vượt quá mức tối đa 5MB.",
        )

    unique_name = f"{uuid.uuid4().hex}{ext}"
    JOB_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    target_path = JOB_UPLOAD_DIR / unique_name
    target_path.write_bytes(content)

    base_url = str(request.base_url).rstrip("/")
    relative_url = f"/uploads/jobs/{unique_name}"
    full_url = f"{base_url}{relative_url}"

    return {
        "success": True,
        "message": "Tải lên hình ảnh công việc thành công",
        "filename": unique_name,
        "relative_url": relative_url,
        "image_url": full_url,
        "url": full_url,
    }


@router.post(
    "/api/jobs",
    status_code=status.HTTP_201_CREATED,
    tags=["Jobs"],
    summary="Đăng tin tuyển dụng mới",
    dependencies=[Depends(verify_employer_or_internal)],
)
def create_job_api(
    job_data: JobCreateSchema,
    db: DbSession,
    current_user: User | None = Depends(get_optional_user),
):
    # Giống PATCH /api/jobs/{id}: nhà tuyển dụng không được tự duyệt tin khi đăng mới
    if (
        current_user is not None
        and current_user.role != RoleEnum.ADMIN
        and job_data.status == JobStatusEnum.APPROVED
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên mới được duyệt tin tuyển dụng",
        )
    job = create_job_v1(db, job_data)
    return {"success": True, "job": JobOutSchema.model_validate(job)}


@router.get(
    "/api/jobs",
    tags=["Jobs"],
    summary="Tiếp nhận & tìm kiếm danh sách tin tuyển dụng",
)
def get_jobs_api(
    db: DbSession,
    status_filter: str = Query(
        default=JobStatusEnum.APPROVED.value,
        alias="status",
        description="Lọc trạng thái: approved, pending, rejected, closed, all",
    ),
    keyword: str | None = Query(
        default=None, description="Tìm kiếm theo tiêu đề, mô tả hoặc yêu cầu"
    ),
    recruiter_id: int | None = Query(default=None, gt=0),
    category_id: int | None = Query(default=None, gt=0),
    location_id: int | None = Query(default=None, gt=0),
    job_type: JobTypeEnum | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    total, jobs = get_jobs_v1(
        db,
        status_filter=status_filter,
        keyword=keyword,
        recruiter_id=recruiter_id,
        category_id=category_id,
        location_id=location_id,
        job_type=job_type,
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


@router.get(
    "/api/jobs/latest",
    tags=["Jobs"],
    summary="Lấy danh sách tin đăng mới nhất đã được duyệt",
)
def get_latest_jobs_api(
    db: DbSession,
    limit: int = Query(default=10, ge=1, le=50),
):
    total, jobs = get_jobs_v1(
        db,
        status_filter=JobStatusEnum.APPROVED.value,
        skip=0,
        limit=limit,
    )
    return {
        "success": True,
        "total": total,
        "jobs": [JobOutSchema.model_validate(j) for j in jobs],
    }


@router.get(
    "/api/jobs/{job_id}",
    tags=["Jobs"],
    summary="Xem chi tiết một tin tuyển dụng",
)
def get_job_detail_api(job_id: int, db: DbSession):
    job = get_job_by_id(db, job_id)
    return {"success": True, "job": JobOutSchema.model_validate(job)}


@router.patch(
    "/api/jobs/{job_id}",
    tags=["Jobs"],
    summary="Cập nhật thông tin hoặc đóng tin tuyển dụng",
    dependencies=[Depends(verify_employer_or_internal)],
)
def update_job_api(
    job_id: int,
    job_data: JobUpdateSchema,
    db: DbSession,
    current_user: User | None = Depends(get_optional_user),
):
    # Nhà tuyển dụng chỉ được gửi duyệt lại (pending) hoặc đóng tin; duyệt (approved) là quyền của Admin.
    if (
        job_data.status == JobStatusEnum.APPROVED
        and current_user is not None
        and current_user.role != RoleEnum.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên mới được duyệt tin tuyển dụng",
        )
    job = update_job_service(db, job_id, job_data)
    return {"success": True, "job": JobOutSchema.model_validate(job)}


@router.delete(
    "/api/jobs/{job_id}",
    tags=["Jobs"],
    summary="Gỡ tin tuyển dụng",
    dependencies=[Depends(verify_employer_or_internal)],
)
def delete_job_api(
    job_id: int,
    db: DbSession,
    reason: str | None = Query(default=None, description="Lý do gỡ tin"),
    hard_delete: bool = Query(
        default=False, description="True để xóa hẳn khỏi bảng jobs"
    ),
):
    job_out, resolved_count = remove_job_by_id(
        db, job_id, reason=reason, hard_delete=hard_delete, resolve_reports=False
    )
    return {
        "success": True,
        "message": "Đã gỡ tin tuyển dụng thành công",
        "job": job_out,
        "resolved_reports_count": resolved_count,
    }
