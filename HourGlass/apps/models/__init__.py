# ── Import all models để Alembic & Base.metadata nhận diện ──
from apps.models.user import User, RoleEnum, UserStatusEnum                       # noqa
from apps.models.profile import (                                                  # noqa
    PasswordReset, StudentProfile, EmployerProfile, AdminProfile,
)
from apps.models.job import (                                                      # noqa
    JobCategory, JobLocation, Job, JobSave,
    JobTypeEnum, JobStatusEnum, LocationTypeEnum,
)
from apps.models.application import (                                              # noqa
    ApplicationStatusRef, CV, Application, ApplicationStatusLog,
    AppStatusEnum, FileTypeEnum,
)
from apps.models.schedule import Availability, Schedule                            # noqa
from apps.models.report import Report, ReportTypeEnum, ReportStatusEnum            # noqa
