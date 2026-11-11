from fastapi import FastAPI, Depends, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware

# 1. Import Database Engine & Base
from apps.db.database import engine, Base, get_db

# 2. Import TẤT CẢ các Models (bắt buộc để Base ghi nhận metadata trước khi create_all)
from apps.models.user import User

# 3. Import Routers
from apps.routers.users import router as users_router
from apps.routers.jobs import router as jobs_router

Base.metadata.create_all(bind=engine)

# ── Rate limiter ──────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── App ───────────────────────────────────────────────────
app = FastAPI(
    title="HourGlass API",
    description="Hệ thống tuyển dụng & tìm việc làm thêm cho sinh viên – FastAPI & MySQL",
    version="2.0.0",
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# ── Custom Handler trả về lỗi Validation dạng string ───────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Lấy thông báo lỗi đầu tiên hoặc nối các lỗi thành chuỗi đơn giản
    messages = []
    for err in exc.errors():
        field = " -> ".join([str(loc) for loc in err.get("loc", []) if loc != "body"])
        msg = err.get("msg", "Dữ liệu không hợp lệ")
        if field:
            messages.append(f"{field}: {msg}")
        else:
            messages.append(msg)
    error_detail = "; ".join(messages) if messages else "Dữ liệu gửi lên không hợp lệ"
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": error_detail}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────
app.include_router(users_router)
app.include_router(jobs_router)



# ── Health check ─────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "message": "Database kết nối thành công"}