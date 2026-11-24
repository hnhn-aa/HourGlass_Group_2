"""add_image_url_to_jobs

Revision ID: a8c4e12f9b03
Revises: 761599e23f17
Create Date: 2026-11-18 15:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a8c4e12f9b03"
down_revision: Union[str, Sequence[str], None] = "761599e23f17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add image_url column to jobs table safely without losing existing data."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    if "jobs" in existing_tables:
        existing_cols = {col["name"] for col in inspector.get_columns("jobs")}
        if "image_url" not in existing_cols:
            op.add_column(
                "jobs",
                sa.Column("image_url", sa.String(length=500), nullable=True),
            )


def downgrade() -> None:
    """Remove image_url column from jobs table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    if "jobs" in existing_tables:
        existing_cols = {col["name"] for col in inspector.get_columns("jobs")}
        if "image_url" in existing_cols:
            with op.batch_alter_table("jobs") as batch_op:
                batch_op.drop_column("image_url")
