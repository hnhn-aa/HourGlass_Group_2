import math
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.models.job import (
    Job,
    JobCategory,
    JobLocation,
    JobSave,
    JobStatusEnum,
    JobTypeEnum,
)
from app.models.profile import AdminProfile, EmployerProfile, StudentProfile
from app.models.report import Report, ReportStatusEnum, ReportTypeEnum
from app.models.user import RoleEnum, User, UserStatusEnum
from app.schemas.jobs import (
    JobCategoryCreate,
    JobCreate,
    JobCreateSchema,
    JobOutSchema,
    JobReviewSchema,
    JobUpdateSchema,
)


def _get_recruiter_profile_or_404(
    db: Session, recruiter_id: int
) -> EmployerProfile:
    profile = (
        db.query(EmployerProfile)
        .options(joinedload(EmployerProfile.user))
        .filter(EmployerProfile.id == recruiter_id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ nhà tuyển dụng (employer_profiles.id = {recruiter_id})",
        )
    return profile


def _get_job_or_404(db: Session, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tin tuyển dụng (jobs.id = {job_id})",
        )
    return job


# ═══════════════════════ CATEGORY ═══════════════════════
def get_all_categories(db: Session) -> list[JobCategory]:
    return db.query(JobCategory).order_by(JobCategory.id.asc()).all()


get_categories = get_all_categories


def get_category_by_id(category_id: int, db: Session) -> JobCategory:
    cat = db.query(JobCategory).filter(JobCategory.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy ngành nghề (job_categories.id = {category_id})",
        )
    return cat


_get_category_by_id = get_category_by_id


def create_category(data: JobCategoryCreate, db: Session) -> JobCategory:
    if db.query(JobCategory).filter(JobCategory.name == data.name).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Danh mục đã tồn tại"
        )
    now = datetime.now()
    cat = JobCategory(
        name=data.name,
        description=data.description,
        created_at=now,
        updated_at=now,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def update_category(
    db: Session, category_id: int, name: str | None = None, description: str | None = None
) -> JobCategory:
    cat = get_category_by_id(category_id, db)
    if name is not None and name.strip():
        dup = (
            db.query(JobCategory)
            .filter(JobCategory.name == name.strip(), JobCategory.id != category_id)
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tên danh mục đã tồn tại",
            )
        cat.name = name.strip()
    if description is not None:
        cat.description = description.strip()
    cat.updated_at = datetime.now()
    db.commit()
    db.refresh(cat)
    return cat


def delete_category(db: Session, category_id: int) -> None:
    cat = get_category_by_id(category_id, db)
    in_use = db.query(Job).filter(Job.category_id == category_id).count()
    if in_use > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa: đang có {in_use} tin tuyển dụng thuộc danh mục này",
        )
    db.delete(cat)
    db.commit()


# ═══════════════════════ LOCATION ═══════════════════════
def get_all_locations(
    db: Session,
    parent_id: int | None = None,
    loc_type: str | None = None,
) -> list[JobLocation]:
    q = db.query(JobLocation)
    if parent_id is not None:
        q = q.filter(JobLocation.parent_id == parent_id)
    if loc_type:
        q = q.filter(JobLocation.type == loc_type)
    return q.order_by(JobLocation.id.asc()).all()


def get_locations(db: Session) -> list[JobLocation]:
    return db.query(JobLocation).order_by(JobLocation.id.asc()).all()


def get_location_by_id(location_id: int, db: Session) -> JobLocation:
    loc = db.query(JobLocation).filter(JobLocation.id == location_id).first()
    if not loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy địa điểm (job_locations.id = {location_id})",
        )
    return loc


_get_location_by_id = get_location_by_id


# ═══════════════════════ JOB (Nhánh B) ══════════════════
def get_jobs(
    db: Session,
    *,
    keyword: str | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    job_type: JobTypeEnum | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
    job_status: JobStatusEnum | None = JobStatusEnum.APPROVED,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    q = db.query(Job)
    if job_status:
        q = q.filter(Job.status == job_status)
    if keyword:
        kw = f"%{keyword.strip()}%"
        q = q.filter(
            or_(
                Job.title.ilike(kw),
                Job.description.ilike(kw),
                Job.requirements.ilike(kw),
            )
        )
    if category_id:
        q = q.filter(Job.category_id == category_id)
    if location_id:
        q = q.filter(Job.location_id == location_id)
    if job_type:
        q = q.filter(Job.job_type == job_type)
    if salary_min is not None:
        q = q.filter(and_(Job.salary_min.isnot(None), Job.salary_min >= salary_min))
    if salary_max is not None:
        q = q.filter(and_(Job.salary_max.isnot(None), Job.salary_max <= salary_max))

    total = q.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        q.order_by(Job.created_at.desc(), Job.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


def get_job_by_id(job_id_or_db, db_or_job_id=None) -> Job:
    """Hỗ trợ cả (job_id, db) của Nhánh B và (db, job_id) của Nhánh A."""
    if isinstance(job_id_or_db, Session):
        db: Session = job_id_or_db
        job_id: int = int(db_or_job_id)
    else:
        job_id = int(job_id_or_db)
        db = db_or_job_id
    return _get_job_or_404(db, job_id)


def create_job(data: JobCreate, employer: User, db: Session) -> Job:
    if data.category_id:
        _get_category_by_id(data.category_id, db)
    if data.location_id:
        _get_location_by_id(data.location_id, db)

    emp_profile = (
        db.query(EmployerProfile)
        .filter(EmployerProfile.user_id == employer.id)
        .first()
    )
    now = datetime.now()
    job = Job(
        employer_id=employer.id,
        recruiter_id=emp_profile.id if emp_profile else None,
        category_id=data.category_id,
        location_id=data.location_id,
        title=data.title,
        description=data.description,
        requirements=data.requirements,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        job_type=data.job_type,
        work_time=data.work_time,
        quantity=data.quantity or 1,
        experience_level=data.experience_level,
        benefits=data.benefits,
        start_date=data.start_date,
        end_date=data.end_date,
        image_url=data.image_url,
        status=JobStatusEnum.PENDING,
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_employer_jobs(employer: User, db: Session) -> list[Job]:
    emp_profile = (
        db.query(EmployerProfile)
        .filter(EmployerProfile.user_id == employer.id)
        .first()
    )
    if emp_profile:
        return (
            db.query(Job)
            .filter(
                or_(
                    Job.employer_id == employer.id,
                    Job.recruiter_id == emp_profile.id,
                )
            )
            .order_by(Job.created_at.desc())
            .all()
        )
    return (
        db.query(Job)
        .filter(Job.employer_id == employer.id)
        .order_by(Job.created_at.desc())
        .all()
    )


def approve_job(job_id: int, admin: User, db: Session) -> Job:
    job = _get_job_or_404(db, job_id)
    if job.status != JobStatusEnum.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ duyệt được tin đang chờ",
        )
    job.status = JobStatusEnum.APPROVED
    job.approved_by = admin.id
    job.approved_at = datetime.now()
    job.updated_at = datetime.now()
    db.commit()
    db.refresh(job)
    return job


def reject_job(job_id: int, admin: User, reason: str | None, db: Session) -> Job:
    job = _get_job_or_404(db, job_id)
    if job.status != JobStatusEnum.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ từ chối được tin đang chờ",
        )
    job.status = JobStatusEnum.REJECTED
    job.approved_by = admin.id
    job.rejected_reason = reason or "Tin đăng chưa đạt tiêu chuẩn kiểm duyệt"
    job.updated_at = datetime.now()
    db.commit()
    db.refresh(job)
    return job


def get_all_jobs_admin(
    db: Session, job_status: JobStatusEnum | None = None
) -> list[Job]:
    q = db.query(Job)
    if job_status:
        q = q.filter(Job.status == job_status)
    return q.order_by(Job.created_at.desc()).all()


# ═══════════════════════ JOB (Tích hợp từ Nhánh A) ══════
def create_job_v1(db: Session, job_data: JobCreateSchema) -> Job:
    recruiter = _get_recruiter_profile_or_404(db, job_data.recruiter_id)
    if not recruiter.user or recruiter.user.role not in (
        RoleEnum.EMPLOYER,
        RoleEnum.RECRUITER,
        RoleEnum.ADMIN,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản nhà tuyển dụng (employer) hoặc Admin mới được đăng tin",
        )
    if recruiter.user.status != UserStatusEnum.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản nhà tuyển dụng đang bị khóa hoặc chưa kích hoạt",
        )

    get_category_by_id(job_data.category_id, db)
    get_location_by_id(job_data.location_id, db)

    approved_by = None
    approved_at = None
    if job_data.status == JobStatusEnum.APPROVED:
        first_admin = (
            db.query(AdminProfile).order_by(AdminProfile.id.asc()).first()
        )
        approved_by = first_admin.id if first_admin else None
        approved_at = datetime.now(timezone.utc)

    now = datetime.now()
    new_job = Job(
        employer_id=recruiter.user_id,
        recruiter_id=job_data.recruiter_id,
        category_id=job_data.category_id,
        location_id=job_data.location_id,
        approved_by=approved_by,
        title=job_data.title,
        description=job_data.description,
        requirements=job_data.requirements,
        salary_min=job_data.salary_min,
        salary_max=job_data.salary_max,
        job_type=job_data.job_type,
        work_time=job_data.work_time,
        quantity=job_data.quantity,
        experience_level=job_data.experience_level,
        benefits=job_data.benefits,
        start_date=job_data.start_date,
        end_date=job_data.end_date,
        image_url=job_data.image_url,
        status=job_data.status,
        approved_at=approved_at,
        created_at=now,
        updated_at=now,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job


def get_jobs_v1(
    db: Session,
    status_filter: str | None = JobStatusEnum.APPROVED.value,
    keyword: str | None = None,
    recruiter_id: int | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    job_type: JobTypeEnum | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[Job]]:
    query = db.query(Job)

    if status_filter and status_filter.lower() != "all":
        try:
            status_enum = JobStatusEnum(status_filter.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trạng thái tin tuyển dụng phải là pending, approved, rejected, closed hoặc all",
            ) from None
        query = query.filter(Job.status == status_enum)

    if keyword:
        pattern = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                Job.title.ilike(pattern),
                Job.description.ilike(pattern),
                Job.requirements.ilike(pattern),
            )
        )
    if recruiter_id is not None:
        query = query.filter(Job.recruiter_id == recruiter_id)
    if category_id is not None:
        query = query.filter(Job.category_id == category_id)
    if location_id is not None:
        query = query.filter(Job.location_id == location_id)
    if job_type is not None:
        query = query.filter(Job.job_type == job_type)

    total = query.count()
    items = (
        query.order_by(Job.created_at.desc(), Job.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items


def update_job(
    db: Session, job_id: int, job_data: JobUpdateSchema
) -> Job:
    job = _get_job_or_404(db, job_id)
    if job.status == JobStatusEnum.REJECTED and job_data.status is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể chỉnh sửa tin tuyển dụng đã bị từ chối/gỡ bỏ",
        )

    updates = job_data.model_dump(exclude_unset=True)
    if (
        "end_date" in updates
        and updates["end_date"]
        and updates["end_date"] < date.today()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ngày kết thúc (end_date) không được nhỏ hơn ngày hiện tại",
        )

    for field, value in updates.items():
        setattr(job, field, value)
    if updates.get("status") == JobStatusEnum.PENDING:
        # Gửi duyệt lại: xóa lý do từ chối/duyệt cũ để Admin xét lại từ đầu
        job.rejected_reason = None
        job.approved_at = None
    job.updated_at = datetime.now()

    db.commit()
    db.refresh(job)
    return job


def review_new_job(
    db: Session, job_id: int, review_data: JobReviewSchema
) -> Job:
    """Admin tiếp nhận và duyệt (approved / rejected / closed) tin tuyển dụng mới."""
    job = _get_job_or_404(db, job_id)

    admin_profile = None
    if review_data.approved_by is not None:
        admin_profile = (
            db.query(AdminProfile)
            .filter(AdminProfile.id == review_data.approved_by)
            .first()
        )
        if not admin_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hồ sơ Admin (admin_profiles.id = {review_data.approved_by})",
            )
    else:
        admin_profile = (
            db.query(AdminProfile).order_by(AdminProfile.id.asc()).first()
        )

    job.status = review_data.status
    if review_data.status == JobStatusEnum.APPROVED:
        job.approved_by = admin_profile.id if admin_profile else job.approved_by
        job.approved_at = datetime.now(timezone.utc)
        job.rejected_reason = None
    elif review_data.status == JobStatusEnum.REJECTED:
        job.rejected_reason = (
            review_data.rejected_reason or "Tin đăng chưa đạt tiêu chuẩn kiểm duyệt"
        )
        job.approved_at = None
    job.updated_at = datetime.now()

    db.commit()
    db.refresh(job)
    return job


def _resolve_pending_job_reports(db: Session, job_id: int, note: str) -> int:
    pending_reports = (
        db.query(Report)
        .filter(
            Report.report_type == ReportTypeEnum.JOB,
            Report.target_id == job_id,
            Report.status == ReportStatusEnum.PENDING,
        )
        .all()
    )
    for rep in pending_reports:
        rep.status = ReportStatusEnum.RESOLVED
        rep.admin_note = note
        rep.updated_at = datetime.now()
    return len(pending_reports)


def remove_job_by_id(
    db: Session,
    job_id: int,
    reason: str | None = None,
    hard_delete: bool = False,
    resolve_reports: bool = True,
) -> tuple[JobOutSchema, int]:
    """Gỡ tin vi phạm (chuyển status='rejected' hoặc xóa hẳn khi hard_delete=True)."""
    job = _get_job_or_404(db, job_id)
    final_reason = (reason or "").strip() or "Vi phạm quy định đăng tin của hệ thống"

    if not hard_delete and job.status == JobStatusEnum.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tin tuyển dụng này đã bị từ chối/gỡ bỏ trước đó",
        )

    resolved_count = 0
    if resolve_reports:
        resolved_count = _resolve_pending_job_reports(
            db, job_id, f"Admin đã xử lý gỡ tin vi phạm: {final_reason}"
        )

    if hard_delete:
        job_snapshot = JobOutSchema.model_validate(job)
        db.delete(job)
        db.commit()
        return job_snapshot, resolved_count

    job.status = JobStatusEnum.REJECTED
    job.rejected_reason = final_reason
    job.updated_at = datetime.now()
    db.commit()
    db.refresh(job)
    return JobOutSchema.model_validate(job), resolved_count


# ═══════════════════════ JOB SAVES ══════════════════════
def save_job(db: Session, student_id: int, job_id: int) -> JobSave:
    _get_job_or_404(db, job_id)
    student = (
        db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ sinh viên (student_profiles.id = {student_id})",
        )
    existing = (
        db.query(JobSave)
        .filter(JobSave.student_id == student_id, JobSave.job_id == job_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Công việc này đã được lưu trước đó",
        )
    saved = JobSave(student_id=student_id, job_id=job_id, created_at=datetime.now())
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


def toggle_saved_job(db: Session, student_id: int, job_id: int) -> bool:
    _get_job_or_404(db, job_id)
    existing = (
        db.query(JobSave)
        .filter(JobSave.student_id == student_id, JobSave.job_id == job_id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return False
    saved = JobSave(student_id=student_id, job_id=job_id, created_at=datetime.now())
    db.add(saved)
    db.commit()
    return True


def get_saved_jobs(db: Session, student_id: int | None = None) -> list[JobSave]:
    q = db.query(JobSave)
    if student_id is not None:
        q = q.filter(JobSave.student_id == student_id)
    return q.order_by(JobSave.created_at.desc()).all()
