"""add_skills_to_student_profiles

Revision ID: c3f7a91d2e45
Revises: a8c4e12f9b03
Create Date: 2026-11-23 06:00:00.000000

Cột `student_profiles.skills` (TEXT) lưu danh sách "Kỹ năng & Thế mạnh" dạng chuỗi JSON,
VD: '["Tiếng Anh", "Canva"]'. NULL = sinh viên chưa từng lưu kỹ năng.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3f7a91d2e45"
down_revision: Union[str, Sequence[str], None] = "a8c4e12f9b03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    return column in {col["name"] for col in inspector.get_columns(table)}


def upgrade() -> None:
    """Thêm cột skills (an toàn khi init_db() đã tự thêm trước đó)."""
    inspector = sa.inspect(op.get_bind())
    if "student_profiles" in inspector.get_table_names() and not _has_column("student_profiles", "skills"):
        op.add_column("student_profiles", sa.Column("skills", sa.Text(), nullable=True))


def downgrade() -> None:
    """Xóa cột skills khỏi student_profiles."""
    if _has_column("student_profiles", "skills"):
        op.drop_column("student_profiles", "skills")
