from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    "mysql+pymysql://root:060207@127.0.0.1:3306/project_fastapi"
)

Base = declarative_base()
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autoflush = False, bind = engine, autocommit = False, expire_on_commit = False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

