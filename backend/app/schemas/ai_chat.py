"""Schema cho Trợ lý AI HourGlass (POST /api/ai/chat, GET /api/ai/status)."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator

AIRole = Literal["student", "employer", "admin"]
AISource = Literal["llm", "fallback"]
AILang = Literal["vi", "en"]

# Giới hạn ngữ cảnh: chỉ giữ các lượt gần nhất để AI nhớ mạch hội thoại
# mà không làm phình request / tốn quota.
MAX_HISTORY_ITEMS = 20
MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_CONTENT_LENGTH = 4000

_ROLE_ALIASES = {"recruiter": "employer", "nha_tuyen_dung": "employer", "sinh_vien": "student"}
_SPEAKER_ALIASES = {"model": "assistant", "bot": "assistant", "ai": "assistant", "human": "user"}


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"] = Field(
        ..., description="Người nói: user (người dùng) hoặc assistant (Trợ lý AI)", examples=["user"]
    )
    content: str = Field(..., min_length=1, description="Nội dung tin nhắn", examples=["Mình muốn tìm việc buổi tối"])

    @field_validator("role", mode="before")
    @classmethod
    def normalize_speaker(cls, value):
        if isinstance(value, str):
            value = value.strip().lower()
            return _SPEAKER_ALIASES.get(value, value)
        return value

    @field_validator("content", mode="before")
    @classmethod
    def trim_content(cls, value):
        if isinstance(value, str):
            return value.strip()[:MAX_HISTORY_CONTENT_LENGTH]
        return value


class AIChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=MAX_MESSAGE_LENGTH,
        description="Câu hỏi của người dùng",
        examples=["Gợi ý giúp mình cách viết CV xin việc phục vụ quán cà phê"],
    )
    role: AIRole = Field(
        default="student",
        description="Vai trò người dùng. Nếu request có Bearer Token hợp lệ, hệ thống dùng vai trò thật của tài khoản.",
        examples=["student"],
    )
    history: list[ChatHistoryItem] = Field(
        default_factory=list,
        description=f"Lịch sử hội thoại gần nhất (tối đa {MAX_HISTORY_ITEMS} tin, tự cắt bớt các tin cũ hơn)",
    )
    lang: AILang = Field(
        default="vi",
        description="Ngôn ngữ trả lời ('vi' = Tiếng Việt, 'en' = Tiếng Anh)",
        examples=["vi"],
    )

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Câu hỏi không được để trống")
        return value

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value):
        if value is None or value == "":
            return "student"
        if isinstance(value, str):
            value = value.strip().lower()
            return _ROLE_ALIASES.get(value, value)
        return value

    @field_validator("lang", mode="before")
    @classmethod
    def normalize_lang(cls, value):
        if isinstance(value, str):
            v = value.strip().lower()
            if v.startswith("en"):
                return "en"
        return "vi"

    @field_validator("history", mode="before")
    @classmethod
    def keep_recent_history(cls, value):
        if value is None:
            return []
        if isinstance(value, list):
            # Bỏ các tin rỗng thay vì báo lỗi, rồi chỉ giữ các tin gần nhất
            cleaned = [
                item for item in value
                if not (isinstance(item, dict) and not str(item.get("content") or "").strip())
            ]
            return cleaned[-MAX_HISTORY_ITEMS:]
        return value


class AIChatResponse(BaseModel):
    success: bool = True
    reply: str = Field(..., description="Câu trả lời của Trợ lý AI")
    role: AIRole = Field(..., description="Vai trò thực tế đã dùng để trả lời")
    source: AISource = Field(..., description="llm = trả lời bởi mô hình AI; fallback = trả lời theo kịch bản HourGlass")
    provider: str | None = Field(default=None, description="gemini | openai (khi source = llm)")
    model: str | None = None
    suggestions: list[str] = Field(default_factory=list, description="Gợi ý câu hỏi tiếp theo")
    notice: str | None = Field(default=None, description="Ghi chú khi đang chạy chế độ dự phòng")


class AIStatusResponse(BaseModel):
    success: bool = True
    enabled: bool = Field(..., description="Đã cấu hình AI_API_KEY và đang sẵn sàng gọi LLM")
    mode: AISource
    provider: str | None = None
    model: str | None = None
    message: str
