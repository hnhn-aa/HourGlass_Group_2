"""init_hourglass_17_tables

Revision ID: 761599e23f17
Revises: 
Create Date: 2026-11-16 21:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "761599e23f17"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all 17 HourGlass tables."""
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column(
            "role",
            sa.Enum("student", "employer", "recruiter", "admin", name="roleenum"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("active", "inactive", "locked", name="userstatusenum"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 2. password_resets
    op.create_table(
        "password_resets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index(op.f("ix_password_resets_id"), "password_resets", ["id"], unique=False)

    # 3. student_profiles
    op.create_table(
        "student_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("university", sa.String(length=200), nullable=True),
        sa.Column("major", sa.String(length=150), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_student_profiles_id"), "student_profiles", ["id"], unique=False)

    # 4. employer_profiles
    op.create_table(
        "employer_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("representative_name", sa.String(length=150), nullable=True),
        sa.Column("company_address", sa.String(length=255), nullable=True),
        sa.Column("company_phone", sa.String(length=20), nullable=True),
        sa.Column("industry", sa.String(length=150), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, default=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_employer_profiles_id"), "employer_profiles", ["id"], unique=False)

    # 5. admin_profiles
    op.create_table(
        "admin_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.String(length=150), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_admin_profiles_id"), "admin_profiles", ["id"], unique=False)

    # 6. job_categories
    op.create_table(
        "job_categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_job_categories_id"), "job_categories", ["id"], unique=False)

    # 7. job_locations
    op.create_table(
        "job_locations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column(
            "type",
            sa.Enum("city", "district", "ward", "other", name="locationtypeenum"),
            nullable=False,
        ),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["job_locations.id"], ondelete="SET NULL", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_job_locations_id"), "job_locations", ["id"], unique=False)

    # 8. application_statuses
    op.create_table(
        "application_statuses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_application_statuses_id"), "application_statuses", ["id"], unique=False)

    # 9. cvs
    op.create_table(
        "cvs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column(
            "file_type",
            sa.Enum("pdf", "doc", "docx", name="filetypeenum"),
            nullable=False,
        ),
        sa.Column("is_default", sa.Boolean(), nullable=False, default=False),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cvs_id"), "cvs", ["id"], unique=False)

    # 10. jobs
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("employer_id", sa.Integer(), nullable=True),
        sa.Column("recruiter_id", sa.Integer(), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("requirements", sa.Text(), nullable=True),
        sa.Column("salary_min", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("salary_max", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column(
            "job_type",
            sa.Enum("part-time", "full-time", "internship", name="jobtypeenum"),
            nullable=False,
        ),
        sa.Column("work_time", sa.String(length=255), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, default=1),
        sa.Column("experience_level", sa.String(length=100), nullable=True),
        sa.Column("benefits", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", "closed", name="jobstatusenum"),
            nullable=False,
        ),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("rejected_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["employer_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["recruiter_id"], ["employer_profiles.id"], ondelete="RESTRICT", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["job_categories.id"], ondelete="RESTRICT", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["job_locations.id"], ondelete="RESTRICT", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_jobs_id"), "jobs", ["id"], unique=False)
    op.create_index(op.f("ix_jobs_title"), "jobs", ["title"], unique=False)

    # 11. job_saves
    op.create_table(
        "job_saves",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "job_id", name="uq_student_job"),
    )
    op.create_index(op.f("ix_job_saves_id"), "job_saves", ["id"], unique=False)

    # 12. applications
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("cv_id", sa.Integer(), nullable=True),
        sa.Column("status_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "submitted",
                "reviewing",
                "interview",
                "accepted",
                "rejected",
                "withdrawn",
                name="appstatusenum",
            ),
            nullable=False,
        ),
        sa.Column("cover_letter", sa.Text(), nullable=True),
        sa.Column("applied_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["cv_id"], ["cvs.id"], ondelete="SET NULL", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["status_id"], ["application_statuses.id"], ondelete="RESTRICT", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "job_id", name="unique_student_job_application"),
    )
    op.create_index(op.f("ix_applications_id"), "applications", ["id"], unique=False)

    # 13. application_status_logs
    op.create_table(
        "application_status_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("status_id", sa.Integer(), nullable=False),
        sa.Column("changed_by", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["status_id"], ["application_statuses.id"], ondelete="RESTRICT", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="RESTRICT", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_application_status_logs_id"), "application_status_logs", ["id"], unique=False)

    # 14. availabilities
    op.create_table(
        "availabilities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_day_of_week"),
        sa.CheckConstraint("end_time > start_time", name="chk_avail_time"),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_availabilities_id"), "availabilities", ["id"], unique=False)

    # 15. schedules
    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("start_datetime", sa.DateTime(), nullable=False),
        sa.Column("end_datetime", sa.DateTime(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("end_datetime > start_datetime", name="chk_schedule_datetime"),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schedules_id"), "schedules", ["id"], unique=False)

    # 16. reports
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("reporter_id", sa.Integer(), nullable=False),
        sa.Column(
            "report_type",
            sa.Enum("job", "employer", "user", "application", "other", name="reporttypeenum"),
            nullable=False,
        ),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "resolved", "rejected", name="reportstatusenum"),
            nullable=False,
        ),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reports_id"), "reports", ["id"], unique=False)

    # 17. reviews
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["target_id"], ["users.id"], ondelete="CASCADE", onupdate="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL", onupdate="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reviews_id"), "reviews", ["id"], unique=False)


def downgrade() -> None:
    """Drop all 17 HourGlass tables in reverse dependency order."""
    op.drop_table("reviews")
    op.drop_table("reports")
    op.drop_table("schedules")
    op.drop_table("availabilities")
    op.drop_table("application_status_logs")
    op.drop_table("applications")
    op.drop_table("job_saves")
    op.drop_table("jobs")
    op.drop_table("cvs")
    op.drop_table("application_statuses")
    op.drop_table("job_locations")
    op.drop_table("job_categories")
    op.drop_table("admin_profiles")
    op.drop_table("employer_profiles")
    op.drop_table("student_profiles")
    op.drop_table("password_resets")
    op.drop_table("users")
