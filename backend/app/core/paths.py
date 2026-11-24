"""Đường dẫn lưu trữ tập trung của Backend HourGlass.

Mọi dữ liệu runtime (database SQLite, file upload, trang static) đều được neo
tuyệt đối vào thư mục ``backend/``, KHÔNG phụ thuộc thư mục hiện hành (CWD)
khi chạy ``uvicorn``. Nhờ vậy dù khởi động từ thư mục gốc dự án hay từ
``backend/`` thì ứng dụng vẫn dùng đúng một bộ dữ liệu duy nhất:

    backend/hourglass.db
    backend/uploads/          (CV: /uploads/cv_*.pdf)
    backend/uploads/jobs/     (ảnh tin tuyển dụng: /uploads/jobs/*.jpg)
    backend/static/
"""

from pathlib import Path

BACKEND_DIR: Path = Path(__file__).resolve().parent.parent.parent
DB_PATH: Path = BACKEND_DIR / "hourglass.db"
UPLOAD_DIR: Path = BACKEND_DIR / "uploads"
JOB_UPLOAD_DIR: Path = UPLOAD_DIR / "jobs"
STATIC_DIR: Path = BACKEND_DIR / "static"
ENV_FILE: Path = BACKEND_DIR / ".env"


def ensure_storage_dirs() -> None:
    """Tạo sẵn các thư mục lưu trữ bên trong backend/ nếu chưa có."""
    for folder in (UPLOAD_DIR, JOB_UPLOAD_DIR, STATIC_DIR):
        folder.mkdir(parents=True, exist_ok=True)


def normalize_sqlite_url(url: str) -> str:
    """Chuyển ``sqlite:///./hourglass.db`` (đường dẫn tương đối) thành đường dẫn
    tuyệt đối bên trong backend/. URL MySQL, SQLite tuyệt đối hoặc :memory:
    được giữ nguyên.
    """
    prefix = "sqlite:///"
    if not url or not url.startswith(prefix):
        return url
    raw_path = url[len(prefix):]
    if not raw_path or raw_path.startswith(":memory:") or raw_path.startswith("file:"):
        return url
    # sqlite:////abs/path (Unix) hoặc sqlite:///C:/path (Windows) => đã tuyệt đối
    if raw_path.startswith("/") or (len(raw_path) > 1 and raw_path[1] == ":"):
        return url
    return f"{prefix}{(BACKEND_DIR / raw_path).resolve().as_posix()}"
