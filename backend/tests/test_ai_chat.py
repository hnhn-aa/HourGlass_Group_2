"""Kiểm thử Trợ lý AI HourGlass: POST /api/ai/chat và GET /api/ai/status.

Chạy:  python -m pytest tests/test_ai_chat.py -v
Không gọi mạng thật: lời gọi LLM được giả lập bằng monkeypatch.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

_TMP = tempfile.TemporaryDirectory()
# Luôn ép dùng SQLite tạm – kể cả khi shell đang export DATABASE_URL (không ghi vào backend/hourglass.db thật)
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP.name) / 'test_ai_chat.db'}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app as fastapi_app  # noqa: E402
from app.services import ai_services  # noqa: E402

AI_ENV_KEYS = ("AI_API_KEY", "AI_PROVIDER", "AI_MODEL", "AI_BASE_URL", "AI_TIMEOUT")


@pytest.fixture()
def client(monkeypatch):
    for key in AI_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    ai_services.reset_ai_cooldown()
    with TestClient(fastapi_app) as c:
        yield c
    ai_services.reset_ai_cooldown()


def _chat(client, message, role="student", history=None, headers=None):
    return client.post(
        "/api/ai/chat",
        json={"message": message, "role": role, "history": history or []},
        headers=headers or {},
    )


def test_fallback_without_api_key_for_each_role(client):
    expectations = {
        "student": ("Mình cần viết CV xin việc phục vụ", "CV"),
        "employer": ("Gợi ý cách viết tin tuyển dụng", "tin tuyển dụng"),
        "admin": ("Quy trình kiểm duyệt tin đăng?", "kiểm duyệt"),
    }
    for role, (message, keyword) in expectations.items():
        res = _chat(client, message, role)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert data["source"] == "fallback"
        assert data["role"] == role
        assert keyword.lower() in data["reply"].lower()
        assert data["suggestions"]
        assert data["notice"]


def test_fallback_uses_history_for_follow_up(client):
    history = [
        {"role": "user", "content": "cách viết cv khi chưa có kinh nghiệm"},
        {"role": "assistant", "content": "..."},
    ]
    data = _chat(client, "chi tiết hơn được không?", "student", history).json()
    assert "CV" in data["reply"]


def test_validation_errors_are_vietnamese_422(client):
    res = _chat(client, "   ")
    assert res.status_code == 422
    assert "Câu hỏi không được để trống" in res.json()["detail"]
    assert _chat(client, "xin chào", role="hacker").status_code == 422


def test_invalid_token_is_treated_as_guest(client):
    res = _chat(client, "xin chào", "employer", headers={"Authorization": "Bearer token-sai"})
    assert res.status_code == 200
    assert res.json()["role"] == "employer"


def test_llm_success_with_mocked_gemini(client, monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "AIza-test-key")
    captured = {}

    def fake_post(url, payload, headers, timeout):
        captured.update(url=url, payload=payload, headers=headers)
        return {"candidates": [{"content": {"parts": [{"text": "Chào bạn, mình là trợ lý HourGlass!"}]}}]}

    monkeypatch.setattr(ai_services, "_post_json", fake_post)
    history = [{"role": "user", "content": "mình học năm 2"}, {"role": "assistant", "content": "Chào bạn"}]
    data = _chat(client, "gợi ý việc buổi tối", "student", history).json()
    assert data["source"] == "llm"
    assert data["provider"] == "gemini"
    assert data["reply"].startswith("Chào bạn")
    assert captured["url"].endswith(":generateContent")
    assert [c["role"] for c in captured["payload"]["contents"]] == ["user", "model", "user"]
    assert "HourGlass" in captured["payload"]["system_instruction"]["parts"][0]["text"]


def test_quota_error_falls_back_and_never_500(client, monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "sk-test")
    calls = {"n": 0}

    def quota_error(*_args, **_kwargs):
        calls["n"] += 1
        raise ai_services.AIProviderError("quota", "HTTP 429")

    monkeypatch.setattr(ai_services, "_post_json", quota_error)
    first = _chat(client, "cách viết cv")
    second = _chat(client, "cách viết cv")
    assert first.status_code == second.status_code == 200
    assert first.json()["source"] == "fallback"
    assert first.json()["notice"] == ai_services.NOTICE_QUOTA
    assert calls["n"] == 1  # đang tạm ngưng sau lỗi quota → không gọi lại LLM

    status = client.get("/api/ai/status").json()
    assert status["enabled"] is True and status["mode"] == "fallback"


def test_status_without_key(client):
    res = client.get("/api/ai/status")
    assert res.status_code == 200
    assert res.json()["enabled"] is False
    assert res.json()["mode"] == "fallback"


def test_logged_in_role_cannot_be_overridden():
    class FakeUser:
        role = type("R", (), {"value": "student"})()

    assert ai_services.resolve_role("admin", FakeUser()) == "student"
    assert ai_services.resolve_role("admin", None) == "admin"
