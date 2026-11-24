# ── Import all models để Alembic & Base.metadata nhận diện (17 bảng đầy đủ) ──
from app.models.user import (  # noqa: F401
    RoleEnum,
    User,
    UserModel,
    UserStatusEnum,
)
from app.models.profile import (  # noqa: F401
    AdminProfile,
    AdminProfileModel,
    EmployerProfile,
    EmployerProfileModel,
    PasswordReset,
    PasswordResetModel,
    RecruiterProfile,
    RecruiterProfileModel,
    StudentProfile,
    StudentProfileModel,
)
from app.models.job import (  # noqa: F401
    Job,
    JobCategory,
    JobCategoryModel,
    JobLocation,
    JobLocationModel,
    JobModel,
    JobPost,
    JobSave,
    JobSaveModel,
    JobStatusEnum,
    JobTypeEnum,
    LocationTypeEnum,
)
from app.models.application import (  # noqa: F401
    Application,
    ApplicationModel,
    ApplicationStatusLog,
    ApplicationStatusLogModel,
    ApplicationStatusModel,
    ApplicationStatusNameEnum,
    ApplicationStatusRef,
    AppStatusEnum,
    CV,
    CVFileTypeEnum,
    CVModel,
    FileTypeEnum,
)
from app.models.schedule import (  # noqa: F401
    Availability,
    AvailabilityModel,
    Schedule,
    ScheduleModel,
)
from app.models.report import (  # noqa: F401
    Report,
    ReportModel,
    ReportStatusEnum,
    ReportTypeEnum,
)
from app.models.review import (  # noqa: F401
    Review,
    ReviewModel,
)
