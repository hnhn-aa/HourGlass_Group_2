import os
from collections.abc import Generator
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.paths import BACKEND_DIR, DB_PATH, ENV_FILE, normalize_sqlite_url

# Giữ tên BASE_DIR để tương thích ngược với các module cũ (trỏ tới thư mục backend/)
BASE_DIR = BACKEND_DIR
load_dotenv(ENV_FILE)

# Mặc định & mọi URL SQLite tương đối (vd: sqlite:///./hourglass.db) đều được neo
# vào backend/hourglass.db -> không còn sinh thêm file DB ở thư mục gốc dự án
# khi chạy uvicorn từ một thư mục khác.
SQLITE_FALLBACK_URL = f"sqlite:///{DB_PATH.as_posix()}"
DEFAULT_DATABASE_URL = os.environ.get("DATABASE_URL") or SQLITE_FALLBACK_URL
DATABASE_URL = normalize_sqlite_url(DEFAULT_DATABASE_URL)

_engine_kwargs: dict = {}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_recycle"] = 3600

Base = declarative_base()
engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(
    autoflush=False,
    bind=engine,
    autocommit=False,
    expire_on_commit=False,
)


def init_db() -> None:
    """Tạo tự động tất cả các bảng trong database và bổ sung cột mới nếu chưa tồn tại."""
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    try:
        inspector = inspect(engine)
        if "jobs" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("jobs")}
            if "image_url" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE jobs ADD COLUMN image_url VARCHAR(500) NULL"))
    except Exception:
        pass
    try:
        inspector = inspect(engine)
        if "student_profiles" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("student_profiles")}
            if "skills" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE student_profiles ADD COLUMN skills TEXT NULL"))
    except Exception:
        pass


def get_db() -> Generator[Session, None, None]:
    """Dependency cung cấp SQLAlchemy Session cho mỗi request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
