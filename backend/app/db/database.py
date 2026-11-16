import os
from collections.abc import Generator
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

load_dotenv()

DEFAULT_DATABASE_URL = "mysql+pymysql://root:060207@127.0.0.1:3306/project_fastapi"
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)

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
    """Tạo tự động tất cả các bảng trong database nếu chưa tồn tại."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency cung cấp SQLAlchemy Session cho mỗi request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
