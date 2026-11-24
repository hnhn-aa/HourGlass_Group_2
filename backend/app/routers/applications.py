from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.middleware import verify_student_or_internal
from app.models.application import ApplicationStatusNameEnum, CV, CVFileTypeEnum
from app.schemas.applications import (
    ApplicationCreateSchema,
    ApplicationStatusOutSchema,
    CVOutSchema,
    StatusUpdateSchema,
)
from app.services.application_services import (
    UPLOAD_DIR,
    create_application,
    get_application_by_id,
    get_application_logs,
    get_application_statuses,
    get_applications as get_applications_service,
    get_cvs,
    save_cv_file,
    serialize_application,
    serialize_application_log,
    update_application_status as update_application_status_service,
    validate_application_eligibility,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


@router.get(
    "/api/application-statuses",
    tags=["Catalogs"],
    summary="Danh sách trạng thái đơn ứng tuyển (application_statuses)",
)
def list_application_statuses(db: DbSession):
    statuses = get_application_statuses(db)
    return {
        "success": True,
        "total": len(statuses),
        "statuses": [
            ApplicationStatusOutSchema.model_validate(s) for s in statuses
        ],
    }


@router.get(
    "/api/cvs",
    tags=["Catalogs"],
    summary="Danh sách CV đã tải lên (cvs)",
)
def list_cvs(
    db: DbSession,
    student_id: int | None = Query(
        default=None, gt=0, description="Lọc theo student_profiles.id"
    ),
):
    cvs = get_cvs(db, student_id=student_id)
    return {
        "success": True,
        "total": len(cvs),
        "cvs": [CVOutSchema.model_validate(c) for c in cvs],
    }


@router.post(
    "/api/cvs",
    status_code=status.HTTP_201_CREATED,
    tags=["Catalogs"],
    summary="Tải lên hoặc đăng ký CV mới cho sinh viên",
    dependencies=[Depends(verify_student_or_internal)],
)
async def upload_cv_api(
    db: DbSession,
    student_id: Annotated[int, Form(..., gt=0)],
    cv_file: Annotated[UploadFile | None, File()] = None,
    file_name: Annotated[str | None, Form()] = None,
):
    if cv_file is not None and cv_file.filename:
        orig_name, file_url, ftype = await save_cv_file(cv_file)
    else:
        # Chỉ cho phép "đăng ký" CV không kèm file khi file đó đã có sẵn trong
        # backend/uploads (vd: CV mẫu). Tránh tạo bản ghi trỏ tới URL 404.
        orig_name = Path((file_name or "").strip()).name
        if not orig_name or not (UPLOAD_DIR / orig_name).is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vui lòng chọn file CV (.pdf, .doc, .docx) để tải lên.",
            )
        ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else "pdf"
        if f".{ext}" not in {".pdf", ".doc", ".docx"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Định dạng CV không hợp lệ. Chỉ chấp nhận file .pdf, .doc, .docx",
            )
        ftype = (
            CVFileTypeEnum.DOCX
            if ext == "docx"
            else (CVFileTypeEnum.DOC if ext == "doc" else CVFileTypeEnum.PDF)
        )
        file_url = f"/uploads/{orig_name}"

    existing_count = db.query(CV).filter(CV.student_id == student_id).count()
    new_cv = CV(
        student_id=student_id,
        file_name=orig_name,
        file_url=file_url,
        file_type=ftype,
        is_default=(existing_count == 0),
    )
    db.add(new_cv)
    db.commit()
    db.refresh(new_cv)
    return {"success": True, "cv": CVOutSchema.model_validate(new_cv)}


@router.patch(
    "/api/cvs/{cv_id}/default",
    tags=["Catalogs"],
    summary="Đặt CV làm mặc định cho sinh viên",
    dependencies=[Depends(verify_student_or_internal)],
)
def set_default_cv_api(cv_id: int, db: DbSession):
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy CV (id = {cv_id})",
        )
    db.query(CV).filter(CV.student_id == cv.student_id).update(
        {CV.is_default: False}
    )
    cv.is_default = True
    db.commit()
    db.refresh(cv)
    return {"success": True, "cv": CVOutSchema.model_validate(cv)}


@router.delete(
    "/api/cvs/{cv_id}",
    tags=["Catalogs"],
    summary="Xóa CV của sinh viên",
    dependencies=[Depends(verify_student_or_internal)],
)
def delete_cv_api(cv_id: int, db: DbSession):
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy CV (id = {cv_id})",
        )
    sid = cv.student_id
    was_default = cv.is_default
    db.delete(cv)
    db.commit()
    if was_default:
        first_cv = db.query(CV).filter(CV.student_id == sid).first()
        if first_cv:
            first_cv.is_default = True
            db.commit()
    return {"success": True, "message": "Đã xóa CV thành công"}


@router.post(
    "/api/applications",
    status_code=status.HTTP_201_CREATED,
    tags=["Applications"],
    summary="Nộp CV / đơn ứng tuyển (upload file .pdf/.doc/.docx, chọn cv_id hoặc gửi cv_url)",
    dependencies=[Depends(verify_student_or_internal)],
)
async def apply_job(
    db: DbSession,
    job_id: Annotated[int, Form(..., gt=0, description="ID tin tuyển dụng (jobs.id)")],
    student_id: Annotated[
        int, Form(..., gt=0, description="ID hồ sơ sinh viên (student_profiles.id)")
    ],
    cv_file: Annotated[
        UploadFile | None,
        File(description="File CV (.pdf, .doc, .docx, tối đa 5MB)"),
    ] = None,
    cv_id: Annotated[
        int | None,
        Form(gt=0, description="Hoặc dùng ID CV có sẵn trong bảng cvs"),
    ] = None,
    cv_url: Annotated[
        str | None,
        Form(description="Hoặc đường dẫn CV nếu không upload file trực tiếp"),
    ] = None,
    cover_letter: Annotated[
        str | None,
        Form(description="Thư giới thiệu bản thân"),
    ] = None,
):
    validate_application_eligibility(db, job_id, student_id, cv_id=cv_id)

    uploaded_path = None
    file_name = None
    file_type = None
    final_cv_url = (cv_url or "").strip() or None

    if cv_file is not None and cv_file.filename:
        file_name, final_cv_url, file_type = await save_cv_file(cv_file)
        uploaded_path = UPLOAD_DIR / final_cv_url.rsplit("/", 1)[-1]
    elif cv_id is None and not final_cv_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng tải lên file CV (cv_file), chọn cv_id hoặc cung cấp cv_url",
        )

    try:
        application = create_application(
            db=db,
            job_id=job_id,
            student_id=student_id,
            cv_id=cv_id,
            cv_url=final_cv_url,
            cv_file_name=file_name,
            cv_file_type=file_type,
            cover_letter=cover_letter,
        )
    except Exception:
        if uploaded_path and uploaded_path.exists():
            uploaded_path.unlink()
        raise

    return {
        "success": True,
        "application": serialize_application(application),
    }


@router.post(
    "/api/applications/json",
    status_code=status.HTTP_201_CREATED,
    tags=["Applications"],
    summary="Nộp đơn ứng tuyển bằng JSON (dùng cv_id hoặc cv_url)",
    dependencies=[Depends(verify_student_or_internal)],
)
def apply_job_json(app_data: ApplicationCreateSchema, db: DbSession):
    if app_data.cv_id is None and not (
        app_data.cv_url and app_data.cv_url.strip()
    ):
        app_data.cv_url = "/uploads/sample_cv_tai.pdf"
    application = create_application(
        db=db,
        job_id=app_data.job_id,
        student_id=app_data.student_id,
        cv_id=app_data.cv_id,
        cv_url=app_data.cv_url,
        cover_letter=app_data.cover_letter,
    )
    return {
        "success": True,
        "application": serialize_application(application),
    }


@router.get(
    "/api/applications",
    tags=["Applications"],
    summary="Danh sách hồ sơ ứng tuyển",
)
def get_applications(
    db: DbSession,
    job_id: int | None = Query(default=None, gt=0),
    student_id: int | None = Query(default=None, gt=0),
    status_name: ApplicationStatusNameEnum | None = Query(
        default=None, alias="status"
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    total, apps = get_applications_service(
        db,
        job_id=job_id,
        student_id=student_id,
        status_name=status_name,
        skip=skip,
        limit=limit,
    )
    return {
        "success": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "applications": [serialize_application(a) for a in apps],
    }


@router.get(
    "/api/applications/{application_id}",
    tags=["Applications"],
    summary="Xem chi tiết hồ sơ ứng tuyển",
)
def get_application_detail(application_id: int, db: DbSession):
    app = get_application_by_id(db, application_id)
    return {
        "success": True,
        "application": serialize_application(app),
    }


@router.get(
    "/api/applications/{application_id}/logs",
    tags=["Applications"],
    summary="Lịch sử thay đổi trạng thái hồ sơ (application_status_logs)",
)
def get_application_status_logs(application_id: int, db: DbSession):
    logs = get_application_logs(db, application_id)
    return {
        "success": True,
        "total": len(logs),
        "logs": [serialize_application_log(log) for log in logs],
    }


@router.patch(
    "/api/applications/{application_id}/status",
    tags=["Applications"],
    summary="Cập nhật trạng thái hồ sơ / đơn ứng tuyển (và ghi log)",
)
def update_application_status(
    application_id: int,
    status_data: StatusUpdateSchema,
    db: DbSession,
):
    app = update_application_status_service(
        db,
        application_id,
        status_data.status,
        changed_by=status_data.changed_by,
        note=status_data.note,
    )
    return {
        "success": True,
        "application": serialize_application(app),
    }
