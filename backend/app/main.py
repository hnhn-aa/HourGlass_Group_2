import os
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

# 1. Import Database Engine & Base
from app.db.database import Base, SessionLocal, engine, get_db, init_db

# 2. Import TẤT CẢ các Models (17 bảng đầy đủ)
import app.models as models  # noqa: F401

# 3. Import Routers
from app.routers import (
    ai_chat_router,
    applications_router,
    jobs_router,
    reports_router,
    reviews_router,
    schedules_router,
    users_router,
)

# Luôn dùng duy nhất backend/static và backend/uploads (đường dẫn tuyệt đối,
# không phụ thuộc thư mục chạy lệnh uvicorn) – xem app/core/paths.py
from app.core.paths import JOB_UPLOAD_DIR, STATIC_DIR, UPLOAD_DIR, ensure_storage_dirs  # noqa: E402
from app.core.skills import load_skills  # noqa: E402

ensure_storage_dirs()

_DEFAULT_INDEX_HTML = STATIC_DIR / "index.html"
if not _DEFAULT_INDEX_HTML.exists():
    _DEFAULT_INDEX_HTML.write_text(
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Hourglass API</title></head>"
        "<body><h1>Hourglass API Portal</h1><p>Swagger UI: <a href='/docs'>/docs</a></p></body></html>",
        encoding="utf-8",
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Khởi tạo các bảng dữ liệu và tự động nạp seed data nếu database đang trống."""
    init_db()
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            from seed_data import seed_database

            seed_database(db)
    except Exception:
        pass
    finally:
        db.close()
    yield


app = FastAPI(
    title="HourGlass API",
    description="Hệ thống Cổng việc làm thêm cho sinh viên — Tuyển dụng, Ứng tuyển, Đánh giá uy tín, Lịch làm việc & Quản trị",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS: cho phép Frontend (Live Server :5500 / Vercel) gọi API từ trình duyệt ──
# Mặc định mở cho mọi origin (phát triển local). Khi deploy, khai báo trong backend/.env:
#   CORS_ORIGINS=https://hourglass.vercel.app,http://127.0.0.1:5500
#   CORS_ORIGIN_REGEX=https://hourglass-.*\.vercel\.app      (tùy chọn: cho các bản Preview của Vercel)
_cors_origins = [o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
# Luôn cho phép frontend chạy local (Live Server :5500, Vite :5173, React :3000, http.server :8080…)
# kể cả khi CORS_ORIGINS chỉ khai báo domain deploy → thành viên clone về không bị chặn CORS.
_LOCAL_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"
_custom_regex = os.environ.get("CORS_ORIGIN_REGEX", "").strip()
_cors_regex = f"(?:{_LOCAL_ORIGIN_REGEX})|(?:{_custom_regex})" if _custom_regex else _LOCAL_ORIGIN_REGEX
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["*"],
    allow_origin_regex=_cors_regex,
    allow_credentials="*" not in _cors_origins,   # Frontend dùng Bearer token, không cần cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiter (tùy chọn nếu cài đặt slowapi) ──────────
try:
    from slowapi import Limiter
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
except ImportError:
    pass


# ═══════════════════════ BỘ XỬ LÝ LỖI TẬP TRUNG (VIỆT HÓA 100%) ═══════════════════════
_EN_TO_VI_ERRORS = {
    "Not authenticated": "Bạn chưa đăng nhập hoặc thiếu thông tin xác thực (Bearer Token).",
    "Could not validate credentials": "Thông tin xác thực không hợp lệ hoặc đã hết hạn.",
    "Not Found": "Không tìm thấy đường dẫn hoặc tài nguyên yêu cầu.",
    "Method Not Allowed": "Phương thức HTTP không được phép cho đường dẫn này.",
    "Internal Server Error": "Lỗi máy chủ nội bộ, vui lòng thử lại sau.",
}


def _translate_validation_msg(msg: str) -> str:
    if msg.startswith("Value error, "):
        return msg.replace("Value error, ", "", 1)
    if "Field required" in msg:
        return "Trường thông tin bắt buộc không được để trống"
    if "Input should be a valid integer" in msg:
        return "Giá trị phải là một số nguyên hợp lệ"
    if "Input should be a valid number" in msg:
        return "Giá trị phải là một số hợp lệ"
    if "Input should be greater than 0" in msg:
        return "Giá trị phải lớn hơn 0"
    if "Input should be greater than or equal to" in msg:
        return "Giá trị nhỏ hơn mức tối thiểu cho phép"
    if "String should have at least" in msg:
        return "Chuỗi ký tự quá ngắn so với quy định"
    if "String should have at most" in msg:
        return "Chuỗi ký tự vượt quá độ dài tối đa cho phép"
    if "Input should be" in msg and "enum" in msg.lower():
        return "Giá trị lựa chọn không nằm trong danh mục hợp lệ"
    return msg


@app.exception_handler(StarletteHTTPException)
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(
    _request: Request, exc: HTTPException
):
    """Chuẩn hóa mọi lỗi HTTPException về cấu trúc JSON thống nhất kèm tiếng Việt rõ ràng."""
    raw_detail = str(exc.detail) if exc.detail else "Yêu cầu không hợp lệ."
    vi_detail = _EN_TO_VI_ERRORS.get(raw_detail, raw_detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "status_code": exc.status_code,
            "detail": vi_detail,
            "message": vi_detail,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
):
    """Chuẩn hóa lỗi kiểm tra dữ liệu đầu vào (Pydantic) sang tiếng Việt."""
    messages = []
    for err in exc.errors():
        field = " -> ".join(
            [str(loc) for loc in err.get("loc", []) if loc != "body"]
        )
        raw_msg = err.get("msg", "Dữ liệu không hợp lệ")
        vi_msg = _translate_validation_msg(raw_msg)
        if field:
            messages.append(f"{field}: {vi_msg}")
        else:
            messages.append(vi_msg)
    error_detail = (
        "; ".join(messages) if messages else "Dữ liệu gửi lên không hợp lệ."
    )

    status_code = (
        status.HTTP_422_UNPROCESSABLE_ENTITY
        if request.url.path.startswith("/api/")
        else status.HTTP_400_BAD_REQUEST
    )
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "status_code": status_code,
            "detail": error_detail,
            "message": error_detail,
            "errors": messages,
        },
    )


@app.exception_handler(IntegrityError)
async def sqlalchemy_integrity_error_handler(
    _request: Request, exc: IntegrityError
):
    """Bắt lỗi ràng buộc dữ liệu từ DB để trả về mã lỗi HTTP 409 chuẩn thay vì 500."""
    msg = "Dữ liệu bị trùng lặp hoặc vi phạm ràng buộc khóa ngoại trong cơ sở dữ liệu."
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "success": False,
            "status_code": status.HTTP_409_CONFLICT,
            "detail": msg,
            "message": msg,
            "error": str(exc.orig) if exc.orig else str(exc),
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_general_error_handler(
    _request: Request, exc: SQLAlchemyError
):
    """Bắt mọi lỗi truy vấn SQLAlchemy để không bao giờ crash lỗi 500."""
    msg = "Không thể thực hiện thao tác cơ sở dữ liệu, vui lòng kiểm tra lại dữ liệu gửi lên."
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "status_code": status.HTTP_400_BAD_REQUEST,
            "detail": msg,
            "message": msg,
            "error": str(exc),
        },
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(
    _request: Request, exc: Exception
):
    """Bộ chắn lỗi toàn cục đảm bảo API luôn trả về JSON tiếng Việt an toàn."""
    msg = "Hệ thống gặp sự cố ngoài ý muốn khi xử lý yêu cầu. Vui lòng thử lại sau."
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "detail": msg,
            "message": msg,
            "error": str(exc),
        },
    )


# ── Phục vụ giao diện kiểm thử tĩnh và các file CV đã upload ──
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ── Gắn toàn bộ Routers nghiệp vụ ─────────────────────────
app.include_router(users_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(reviews_router)
app.include_router(reports_router)
app.include_router(schedules_router)
app.include_router(ai_chat_router)


def _fmt_dt(val) -> str | None:
    if val is None:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d %H:%M:%S")
    return str(val)


def _fmt_date(val) -> str | None:
    if val is None:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    return str(val)


def _fmt_time(val) -> str | None:
    if val is None:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%H:%M:%S")
    return str(val)


@app.get(
    "/api/bootstrap",
    tags=["System"],
    summary="Đồng bộ toàn bộ dữ liệu hệ thống cho Frontend",
)
def bootstrap_frontend_data(db: Session = Depends(get_db)):
    """Trả về toàn bộ các bảng dữ liệu đã chuẩn hóa khớp 100% cấu trúc Frontend."""
    users_rows = db.query(models.User).order_by(models.User.id.asc()).all()
    student_rows = (
        db.query(models.StudentProfile)
        .order_by(models.StudentProfile.id.asc())
        .all()
    )
    employer_rows = (
        db.query(models.EmployerProfile)
        .order_by(models.EmployerProfile.id.asc())
        .all()
    )
    admin_rows = (
        db.query(models.AdminProfile)
        .order_by(models.AdminProfile.id.asc())
        .all()
    )
    cat_rows = (
        db.query(models.JobCategory)
        .order_by(models.JobCategory.id.asc())
        .all()
    )
    loc_rows = (
        db.query(models.JobLocation)
        .order_by(models.JobLocation.id.asc())
        .all()
    )
    job_rows = db.query(models.Job).order_by(models.Job.id.asc()).all()
    save_rows = (
        db.query(models.JobSave).order_by(models.JobSave.id.asc()).all()
    )
    status_rows = (
        db.query(models.ApplicationStatusRef)
        .order_by(models.ApplicationStatusRef.display_order.asc())
        .all()
    )
    cv_rows = db.query(models.CV).order_by(models.CV.id.asc()).all()
    app_rows = (
        db.query(models.Application)
        .order_by(models.Application.id.asc())
        .all()
    )
    log_rows = (
        db.query(models.ApplicationStatusLog)
        .order_by(models.ApplicationStatusLog.id.asc())
        .all()
    )
    avail_rows = (
        db.query(models.Availability)
        .order_by(models.Availability.id.asc())
        .all()
    )
    sched_rows = (
        db.query(models.Schedule).order_by(models.Schedule.id.asc()).all()
    )
    report_rows = (
        db.query(models.Report).order_by(models.Report.id.asc()).all()
    )
    review_rows = (
        db.query(models.Review).order_by(models.Review.id.asc()).all()
    )

    return {
        "success": True,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "password": "123456",
                "full_name": u.full_name,
                "phone": u.phone or "",
                "role": "employer"
                if u.role.value in ("employer", "recruiter")
                else u.role.value,
                "status": u.status.value,
                "created_at": _fmt_dt(u.created_at),
                "updated_at": _fmt_dt(u.updated_at),
            }
            for u in users_rows
        ],
        "student_profiles": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "university": s.university or "",
                "major": s.major or "",
                "bio": s.bio or "",
                "address": s.address or "",
                "date_of_birth": _fmt_date(s.date_of_birth),
                "avatar_url": s.avatar_url or "",
                "skills": load_skills(s.skills),  # mảng chuỗi; null = chưa từng lưu
                "created_at": _fmt_dt(s.created_at),
                "updated_at": _fmt_dt(s.updated_at),
            }
            for s in student_rows
        ],
        "employer_profiles": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "company_name": e.company_name,
                "representative_name": e.representative_name or "",
                "company_address": e.company_address or "",
                "company_phone": e.company_phone or "",
                "industry": e.industry or "",
                "description": e.description or "",
                "logo_url": e.logo_url or "",
                "verified": bool(e.verified),
                "created_at": _fmt_dt(e.created_at),
                "updated_at": _fmt_dt(e.updated_at),
            }
            for e in employer_rows
        ],
        "admin_profiles": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "position": a.position or "",
                "created_at": _fmt_dt(a.created_at),
                "updated_at": _fmt_dt(a.updated_at),
            }
            for a in admin_rows
        ],
        "job_categories": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description or "",
                "created_at": _fmt_dt(c.created_at),
                "updated_at": _fmt_dt(c.updated_at),
            }
            for c in cat_rows
        ],
        "job_locations": [
            {
                "id": loc.id,
                "name": loc.name,
                "type": loc.type.value
                if hasattr(loc.type, "value")
                else str(loc.type),
                "parent_id": loc.parent_id,
                "created_at": _fmt_dt(loc.created_at),
                "updated_at": _fmt_dt(loc.updated_at),
            }
            for loc in loc_rows
        ],
        "jobs": [
            {
                "id": j.id,
                "employer_id": j.recruiter_id or j.employer_id or 1,
                "recruiter_id": j.recruiter_id or 1,
                "category_id": j.category_id,
                "location_id": j.location_id,
                "approved_by": j.approved_by,
                "title": j.title,
                "description": j.description,
                "requirements": j.requirements or "",
                "salary_min": float(j.salary_min)
                if j.salary_min is not None
                else 0,
                "salary_max": float(j.salary_max)
                if j.salary_max is not None
                else 0,
                "job_type": j.job_type.value
                if hasattr(j.job_type, "value")
                else str(j.job_type),
                "work_time": j.work_time or "",
                "quantity": j.quantity or 1,
                "experience_level": j.experience_level or "Không yêu cầu",
                "benefits": j.benefits or "",
                "start_date": _fmt_date(j.start_date),
                "end_date": _fmt_date(j.end_date),
                "image_url": j.image_url or "",
                "status": j.status.value
                if hasattr(j.status, "value")
                else str(j.status),
                "approved_at": _fmt_dt(j.approved_at),
                "rejected_reason": j.rejected_reason,
                "created_at": _fmt_dt(j.created_at),
                "updated_at": _fmt_dt(j.updated_at),
            }
            for j in job_rows
        ],
        "job_saves": [
            {
                "id": js.id,
                "student_id": js.student_id,
                "job_id": js.job_id,
                "created_at": _fmt_dt(js.created_at),
            }
            for js in save_rows
        ],
        "application_statuses": [
            {
                "id": st.id,
                "name": st.name,
                "description": st.description or "",
                "display_order": st.display_order,
                "created_at": _fmt_dt(st.created_at),
                "updated_at": _fmt_dt(st.updated_at),
            }
            for st in status_rows
        ],
        "cvs": [
            {
                "id": cv.id,
                "student_id": cv.student_id,
                "file_name": cv.file_name,
                "file_url": cv.file_url,
                "file_type": cv.file_type.value
                if hasattr(cv.file_type, "value")
                else str(cv.file_type),
                "is_default": bool(cv.is_default),
                "uploaded_at": _fmt_dt(cv.uploaded_at),
            }
            for cv in cv_rows
        ],
        "applications": [
            {
                "id": ap.id,
                "student_id": ap.student_id,
                "job_id": ap.job_id,
                "cv_id": ap.cv_id,
                "status_id": ap.status_id,
                "cover_letter": ap.cover_letter or "",
                "applied_at": _fmt_dt(ap.applied_at),
                "reviewed_at": _fmt_dt(ap.reviewed_at),
                "created_at": _fmt_dt(ap.created_at),
                "updated_at": _fmt_dt(ap.updated_at),
            }
            for ap in app_rows
        ],
        "application_status_logs": [
            {
                "id": lg.id,
                "application_id": lg.application_id,
                "status_id": lg.status_id,
                "note": lg.note or "",
                "changed_by": lg.changed_by,
                "changed_at": _fmt_dt(lg.changed_at),
            }
            for lg in log_rows
        ],
        "availabilities": [
            {
                "id": av.id,
                "student_id": av.student_id,
                "day_of_week": av.day_of_week,
                "start_time": _fmt_time(av.start_time),
                "end_time": _fmt_time(av.end_time),
                "is_available": bool(av.is_available),
                "created_at": _fmt_dt(av.created_at),
                "updated_at": _fmt_dt(av.updated_at),
            }
            for av in avail_rows
        ],
        "schedules": [
            {
                "id": sc.id,
                "student_id": sc.student_id,
                "job_id": sc.job_id,
                "title": sc.title,
                "start_datetime": _fmt_dt(sc.start_datetime),
                "end_datetime": _fmt_dt(sc.end_datetime),
                "note": sc.note or "",
                "created_at": _fmt_dt(sc.created_at),
                "updated_at": _fmt_dt(sc.updated_at),
            }
            for sc in sched_rows
        ],
        "reports": [
            {
                "id": rp.id,
                "reporter_id": rp.reporter_id,
                "report_type": rp.report_type.value
                if hasattr(rp.report_type, "value")
                else str(rp.report_type),
                "target_id": rp.target_id,
                "reason": rp.reason,
                "status": rp.status.value
                if hasattr(rp.status, "value")
                else str(rp.status),
                "admin_note": rp.admin_note,
                "created_at": _fmt_dt(rp.created_at),
                "updated_at": _fmt_dt(rp.updated_at),
            }
            for rp in report_rows
        ],
        "reviews": [
            {
                "id": rv.id,
                "reviewer_id": rv.reviewer_id,
                "target_id": rv.target_id,
                "job_id": rv.job_id,
                "rating": rv.rating,
                "comment": rv.comment or "",
                "created_at": _fmt_dt(rv.created_at),
            }
            for rv in review_rows
        ],
    }


# ── Health check & Root ───────────────────────────────────
@app.get("/", tags=["System"])
def root():
    return {
        "success": True,
        "message": "HourGlass Student Job Portal API is running successfully!",
        "docs_url": "/docs",
        "test_ui_url": "/static/index.html",
    }


@app.get("/health", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {
        "success": True,
        "status": "ok",
        "message": "Database kết nối thành công",
    }
