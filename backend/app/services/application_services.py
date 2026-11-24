from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.models.application import (
    Application,
    ApplicationStatusLog,
    ApplicationStatusNameEnum,
    ApplicationStatusRef,
    AppStatusEnum,
    CV,
    CVFileTypeEnum,
)
from app.models.job import Job, JobStatusEnum
from app.models.profile import EmployerProfile, StudentProfile
from app.models.user import RoleEnum, User, UserStatusEnum
from app.schemas.applications import (
    ApplicationOutSchema,
    ApplicationStatusLogOutSchema,
)

from app.core.paths import UPLOAD_DIR  # backend/uploads (đường dẫn tuyệt đối)  # noqa: E402

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_CV_EXTENSIONS = {".pdf", ".doc", ".docx"}
MAX_CV_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _infer_cv_file_type(filename_or_url: str) -> CVFileTypeEnum:
    ext = Path(filename_or_url.split("?", 1)[0]).suffix.lower().lstrip(".")
    if ext == "doc":
        return CVFileTypeEnum.DOC
    if ext == "docx":
        return CVFileTypeEnum.DOCX
    return CVFileTypeEnum.PDF


async def save_cv_file(cv_file: UploadFile) -> tuple[str, str, CVFileTypeEnum]:
    """Kiểm tra định dạng, dung lượng và lưu file CV vào uploads/."""
    original_name = Path(cv_file.filename or "cv.pdf").name
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_CV_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng CV không hợp lệ. Chỉ chấp nhận file .pdf, .doc, .docx",
        )

    content = await cv_file.read(MAX_CV_SIZE_BYTES + 1)
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File CV bị rỗng, vui lòng chọn file hợp lệ",
        )
    if len(content) > MAX_CV_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dung lượng file CV vượt quá giới hạn 5MB",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_filename = f"cv_{uuid4().hex}{ext}"
    (UPLOAD_DIR / safe_filename).write_bytes(content)
    return original_name, f"/uploads/{safe_filename}", _infer_cv_file_type(ext)


def _get_student_profile_or_404(
    db: Session, student_id: int
) -> StudentProfile:
    profile = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.id == student_id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ sinh viên (student_profiles.id = {student_id})",
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


def _get_application_or_404(db: Session, application_id: int) -> Application:
    app = (
        db.query(Application)
        .options(
            joinedload(Application.cv),
            joinedload(Application.status_obj),
            joinedload(Application.student),
            joinedload(Application.job).joinedload(Job.recruiter),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ ứng tuyển (applications.id = {application_id})",
        )
    return app


def _get_status_by_name_or_404(
    db: Session, status_name: str
) -> ApplicationStatusRef:
    status_obj = (
        db.query(ApplicationStatusRef)
        .filter(ApplicationStatusRef.name == status_name)
        .first()
    )
    if not status_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy trạng thái '{status_name}' trong bảng application_statuses",
        )
    return status_obj


def serialize_application(app: Application) -> ApplicationOutSchema:
    status_name = (
        app.status_obj.name
        if app.status_obj
        else (app.status.value if isinstance(app.status, AppStatusEnum) else str(app.status))
    )
    return ApplicationOutSchema(
        id=app.id,
        student_id=app.student_id,
        job_id=app.job_id,
        cv_id=app.cv_id,
        cv_url=app.cv.file_url if app.cv else None,
        status_id=app.status_id,
        status_name=status_name,
        cover_letter=app.cover_letter,
        applied_at=app.applied_at,
        reviewed_at=app.reviewed_at,
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


def serialize_application_log(
    log: ApplicationStatusLog,
) -> ApplicationStatusLogOutSchema:
    return ApplicationStatusLogOutSchema(
        id=log.id,
        application_id=log.application_id,
        status_id=log.status_id,
        status_name=log.status_ref.name if log.status_ref else None,
        changed_by=log.changed_by,
        note=log.note,
        changed_at=log.changed_at,
    )


def get_application_statuses(db: Session) -> list[ApplicationStatusRef]:
    return (
        db.query(ApplicationStatusRef)
        .order_by(ApplicationStatusRef.display_order.asc())
        .all()
    )


def get_cvs(db: Session, student_id: int | None = None) -> list[CV]:
    query = db.query(CV)
    if student_id is not None:
        query = query.filter(CV.student_id == student_id)
    return query.order_by(CV.id.desc()).all()


def validate_application_eligibility(
    db: Session, job_id: int, student_id: int, cv_id: int | None = None
) -> tuple[StudentProfile, Job]:
    """Kiểm tra toàn bộ điều kiện ứng tuyển trước khi lưu file CV hoặc tạo đơn."""
    job = _get_job_or_404(db, job_id)
    if job.status != JobStatusEnum.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tin tuyển dụng chưa được duyệt hoặc đã ngừng nhận hồ sơ",
        )
    if job.end_date is not None and job.end_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tin tuyển dụng đã hết hạn nộp hồ sơ",
        )

    student = _get_student_profile_or_404(db, student_id)
    if not student.user or student.user.role != RoleEnum.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản sinh viên mới được phép nộp đơn ứng tuyển",
        )
    if student.user.status != UserStatusEnum.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản sinh viên đang bị khóa hoặc chưa kích hoạt",
        )

    if job.recruiter_id:
        recruiter = (
            db.query(EmployerProfile)
            .filter(EmployerProfile.id == job.recruiter_id)
            .first()
        )
        if recruiter and recruiter.user_id == student.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tự ứng tuyển vào tin tuyển dụng của chính mình",
            )
    if job.employer_id and job.employer_id == student.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tự ứng tuyển vào tin tuyển dụng của chính mình",
        )

    if cv_id is not None:
        cv = db.query(CV).filter(CV.id == cv_id).first()
        if not cv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy CV (cvs.id = {cv_id})",
            )
        if cv.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CV được chọn không thuộc về sinh viên này",
            )

    duplicate = (
        db.query(Application)
        .filter(
            Application.job_id == job_id,
            Application.student_id == student_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sinh viên đã nộp hồ sơ cho công việc này trước đó",
        )

    return student, job


def create_application(
    db: Session,
    job_id: int,
    student_id: int,
    cv_id: int | None = None,
    cv_url: str | None = None,
    cv_file_name: str | None = None,
    cv_file_type: CVFileTypeEnum | None = None,
    cover_letter: str | None = None,
) -> Application:
    student, _job = validate_application_eligibility(
        db, job_id, student_id, cv_id=cv_id
    )
    submitted_status = _get_status_by_name_or_404(
        db, ApplicationStatusNameEnum.SUBMITTED.value
    )

    now = datetime.now()
    resolved_cv_id = cv_id
    if resolved_cv_id is None and cv_url:
        file_url = cv_url.strip()
        file_name = cv_file_name or Path(file_url.split("?", 1)[0]).name or "cv.pdf"
        file_type = cv_file_type or _infer_cv_file_type(file_name)
        new_cv = CV(
            student_id=student_id,
            file_name=file_name,
            file_url=file_url,
            file_type=file_type,
            is_default=False,
            uploaded_at=now,
        )
        db.add(new_cv)
        db.flush()
        resolved_cv_id = new_cv.id

    new_app = Application(
        student_id=student_id,
        job_id=job_id,
        cv_id=resolved_cv_id,
        status_id=submitted_status.id,
        status=AppStatusEnum.SUBMITTED,
        cover_letter=cover_letter,
        applied_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(new_app)
    db.flush()

    db.add(
        ApplicationStatusLog(
            application_id=new_app.id,
            status_id=submitted_status.id,
            changed_by=student.user_id,
            note="Sinh viên gửi hồ sơ ứng tuyển.",
            changed_at=now,
        )
    )
    db.commit()
    return _get_application_or_404(db, new_app.id)


def get_applications(
    db: Session,
    job_id: int | None = None,
    student_id: int | None = None,
    status_name: ApplicationStatusNameEnum | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[Application]]:
    query = db.query(Application).options(
        joinedload(Application.cv),
        joinedload(Application.status_obj),
    )
    if job_id is not None:
        query = query.filter(Application.job_id == job_id)
    if student_id is not None:
        query = query.filter(Application.student_id == student_id)
    if status_name is not None:
        status_obj = _get_status_by_name_or_404(db, status_name.value)
        query = query.filter(Application.status_id == status_obj.id)

    total = query.count()
    items = (
        query.order_by(
            Application.applied_at.desc(),
            Application.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items


def get_application_by_id(db: Session, application_id: int) -> Application:
    return _get_application_or_404(db, application_id)


def get_application_logs(
    db: Session, application_id: int
) -> list[ApplicationStatusLog]:
    _get_application_or_404(db, application_id)
    return (
        db.query(ApplicationStatusLog)
        .options(joinedload(ApplicationStatusLog.status_ref))
        .filter(ApplicationStatusLog.application_id == application_id)
        .order_by(
            ApplicationStatusLog.changed_at.desc(),
            ApplicationStatusLog.id.desc(),
        )
        .all()
    )


def update_application_status(
    db: Session,
    application_id: int,
    new_status: ApplicationStatusNameEnum,
    changed_by: int | None = None,
    note: str | None = None,
) -> Application:
    app = _get_application_or_404(db, application_id)
    if app.job.status == JobStatusEnum.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể cập nhật đơn ứng tuyển của tin đã bị từ chối/gỡ bỏ",
        )

    status_obj = _get_status_by_name_or_404(db, new_status.value)

    if changed_by is not None:
        user = db.query(User).filter(User.id == changed_by).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy người cập nhật trạng thái (users.id = {changed_by})",
            )
        actor_user_id = changed_by
    elif new_status == ApplicationStatusNameEnum.WITHDRAWN:
        actor_user_id = app.student.user_id
    elif app.job.recruiter:
        actor_user_id = app.job.recruiter.user_id
    elif app.job.employer_id:
        actor_user_id = app.job.employer_id
    else:
        actor_user_id = app.student.user_id

    app.status_id = status_obj.id
    app.status = AppStatusEnum(new_status.value)
    app.updated_at = datetime.now()
    if new_status != ApplicationStatusNameEnum.SUBMITTED:
        app.reviewed_at = datetime.now(timezone.utc)

    db.add(
        ApplicationStatusLog(
            application_id=app.id,
            status_id=status_obj.id,
            changed_by=actor_user_id,
            note=note.strip()
            if note
            else f"Cập nhật trạng thái thành {new_status.value}",
            changed_at=datetime.now(),
        )
    )
    db.commit()
    return _get_application_or_404(db, app.id)
