from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from fastapi import HTTPException, status
from datetime import datetime
import math

from apps.models.job import Job, JobCategory, JobLocation, JobSave, JobStatusEnum, JobTypeEnum
from apps.models.user import User
from apps.schemas.jobs import JobCreate, JobCategoryCreate


# ═══════════════════════ CATEGORY ═══════════════════════
def get_all_categories(db: Session):
    return db.query(JobCategory).order_by(JobCategory.name).all()


def get_category_by_id(category_id: int, db: Session):
    cat = db.query(JobCategory).filter(JobCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Danh mục không tồn tại")
    return cat


def create_category(data: JobCategoryCreate, db: Session):
    if db.query(JobCategory).filter(JobCategory.name == data.name).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Danh mục đã tồn tại")
    cat = JobCategory(name=data.name, description=data.description, created_at=datetime.now(), updated_at=datetime.now())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ═══════════════════════ LOCATION ═══════════════════════
def get_all_locations(db: Session, parent_id: int | None = None, loc_type: str | None = None):
    q = db.query(JobLocation)
    if parent_id is not None:
        q = q.filter(JobLocation.parent_id == parent_id)
    if loc_type:
        q = q.filter(JobLocation.type == loc_type)
    return q.order_by(JobLocation.name).all()


def get_location_by_id(location_id: int, db: Session):
    loc = db.query(JobLocation).filter(JobLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Địa điểm không tồn tại")
    return loc


# ═══════════════════════ JOB ════════════════════════════
def get_jobs(
    db: Session, *,
    keyword: str | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    job_type: JobTypeEnum | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
    job_status: JobStatusEnum = JobStatusEnum.APPROVED,
    page: int = 1,
    page_size: int = 10,
):
    q = db.query(Job)
    if job_status:
        q = q.filter(Job.status == job_status)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(or_(Job.title.ilike(kw), Job.description.ilike(kw)))
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
    items = q.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {"total": total, "page": page, "page_size": page_size, "total_pages": total_pages, "items": items}


def get_job_by_id(job_id: int, db: Session):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bài đăng không tồn tại")
    return job


# Employer tạo job (status=pending, chờ admin duyệt)
def create_job(data: JobCreate, employer: User, db: Session):
    if data.category_id:
        get_category_by_id(data.category_id, db)
    if data.location_id:
        get_location_by_id(data.location_id, db)

    job = Job(
        employer_id=employer.id,
        category_id=data.category_id,
        location_id=data.location_id,
        title=data.title,
        description=data.description,
        requirements=data.requirements,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        job_type=data.job_type,
        work_time=data.work_time,
        quantity=data.quantity,
        experience_level=data.experience_level,
        benefits=data.benefits,
        start_date=data.start_date,
        end_date=data.end_date,
        status=JobStatusEnum.PENDING,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


# Employer xem danh sách job của mình
def get_employer_jobs(employer: User, db: Session):
    return db.query(Job).filter(Job.employer_id == employer.id).order_by(Job.created_at.desc()).all()


# Admin duyệt job
def approve_job(job_id: int, admin: User, db: Session):
    job = get_job_by_id(job_id, db)
    if job.status != JobStatusEnum.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chỉ duyệt được tin đang chờ")
    job.status = JobStatusEnum.APPROVED
    job.approved_by = admin.id
    job.approved_at = datetime.now()
    job.updated_at = datetime.now()
    db.commit()
    db.refresh(job)
    return job


# Admin từ chối job
def reject_job(job_id: int, admin: User, reason: str | None, db: Session):
    job = get_job_by_id(job_id, db)
    if job.status != JobStatusEnum.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chỉ từ chối được tin đang chờ")
    job.status = JobStatusEnum.REJECTED
    job.approved_by = admin.id
    job.rejected_reason = reason
    job.updated_at = datetime.now()
    db.commit()
    db.refresh(job)
    return job


# Admin xem tất cả job (bao gồm pending)
def get_all_jobs_admin(db: Session, job_status: JobStatusEnum | None = None):
    q = db.query(Job)
    if job_status:
        q = q.filter(Job.status == job_status)
    return q.order_by(Job.created_at.desc()).all()
