from app.schemas.users import (  # noqa: F401
    EmployerProfileResponse,
    EmployerProfileUpdate,
    LoginUser,
    RecruiterProfileOutSchema,
    RefreshTokenRequest,
    RegisterForm,
    StudentProfileOutSchema,
    StudentProfileResponse,
    StudentProfileUpdate,
    TokenResponse,
    UserCreateSchema,
    UserOutSchema,
    UserResponse,
)
from app.schemas.jobs import (  # noqa: F401
    JobApproveReject,
    JobCategoryCreate,
    JobCategoryOutSchema,
    JobCategoryResponse,
    JobCreate,
    JobCreateSchema,
    JobLocationOutSchema,
    JobLocationResponse,
    JobOutSchema,
    JobResponse,
    JobReviewSchema,
    JobUpdateSchema,
    PaginatedJobs,
)
from app.schemas.applications import (  # noqa: F401
    ApplicationCreateSchema,
    ApplicationOutSchema,
    ApplicationStatusLogOutSchema,
    ApplicationStatusOutSchema,
    CVOutSchema,
    StatusUpdateSchema,
)
from app.schemas.reviews import (  # noqa: F401
    ReviewCreateSchema,
    ReviewOutSchema,
)
from app.schemas.reports import (  # noqa: F401
    ReportCreateSchema,
    ReportHandleSchema,
    ReportOutSchema,
)
from app.schemas.schedules import (  # noqa: F401
    AvailabilityCreateSchema,
    AvailabilityOutSchema,
    ScheduleCreateSchema,
    ScheduleOutSchema,
)
from app.schemas.ai_chat import (  # noqa: F401
    AIChatRequest,
    AIChatResponse,
    AIStatusResponse,
    ChatHistoryItem,
)
