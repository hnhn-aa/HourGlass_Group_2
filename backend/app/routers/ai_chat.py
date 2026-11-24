from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.middleware import get_current_user, optional_security
from app.models.user import User
from app.schemas.ai_chat import AIChatRequest, AIChatResponse, AIStatusResponse
from app.services.ai_services import generate_ai_reply, get_ai_status

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def get_chat_user(
    cred: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
) -> User | None:
    """Giống get_optional_user nhưng KHÔNG chặn khi token hết hạn/không hợp lệ:
    trợ lý vẫn trả lời như khách (dùng `role` trong body) thay vì báo lỗi 401."""
    if not cred or not cred.credentials:
        return None
    try:
        return get_current_user(cred=cred, db=db)
    except HTTPException:
        return None


ChatUser = Annotated[User | None, Depends(get_chat_user)]


@router.post(
    "/api/ai/chat",
    response_model=AIChatResponse,
    tags=["AI Assistant"],
    summary="Hội thoại với Trợ lý AI HourGlass (tư vấn theo vai trò Sinh viên / Nhà tuyển dụng / Admin)",
)
def chat_with_ai(payload: AIChatRequest, db: DbSession, current_user: ChatUser):
    """
    - Có Bearer Token hợp lệ → dùng vai trò thật của tài khoản (bỏ qua `role` gửi lên).
    - Có cấu hình `AI_API_KEY` → trả lời bằng LLM (`source = "llm"`).
    - Chưa cấu hình / hết quota / lỗi mạng → trả lời theo kịch bản HourGlass (`source = "fallback"`),
      luôn trả HTTP 200.
    """
    return generate_ai_reply(db, payload, current_user)


@router.get(
    "/api/ai/status",
    response_model=AIStatusResponse,
    tags=["AI Assistant"],
    summary="Trạng thái Trợ lý AI (đang dùng LLM hay chế độ kịch bản dự phòng)",
)
def ai_status():
    return get_ai_status()
