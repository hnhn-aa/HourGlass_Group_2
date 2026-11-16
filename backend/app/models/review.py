from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class Review(Base):
    """Bảng reviews: Đánh giá và chấm điểm uy tín (1 - 5 sao) tích hợp từ Nhánh A."""

    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    reviewer_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    target_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    job_id = Column(
        Integer,
        ForeignKey("jobs.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(
        DateTime, default=datetime.now, server_default=func.now(), nullable=False
    )

    reviewer = relationship(
        "User", back_populates="reviews_given", foreign_keys=[reviewer_id]
    )
    target = relationship(
        "User", back_populates="reviews_received", foreign_keys=[target_id]
    )
    job = relationship("Job")


# Alias tương thích với Nhánh A
ReviewModel = Review
