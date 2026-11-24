import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, status

SECRET_KEY = os.environ.get("SECRET_KEY", "fallback-dev-key")
ALGORITHM = "HS256"
EXPIRE = 60
REFRESH_EXPIRE = 7 * 24 * 60


# bcrypt chỉ dùng 72 byte đầu của mật khẩu. Từ bcrypt 5.0, mật khẩu dài hơn 72 byte (VD tiếng Việt có dấu,
# mỗi ký tự 2–3 byte) gây ValueError → lỗi 500. Cắt về 72 byte ở CẢ lúc băm và lúc kiểm tra – đúng hành vi
# của bcrypt 4.x nên mọi hash cũ vẫn hợp lệ.
BCRYPT_MAX_BYTES = 72


def _bcrypt_secret(password: str) -> bytes:
    return (password or "").encode("utf-8")[:BCRYPT_MAX_BYTES]


def hashed_password(password: str) -> str:
    """Hash mật khẩu bằng bcrypt (chuẩn bảo mật của Nhánh B)."""
    return bcrypt.hashpw(_bcrypt_secret(password), bcrypt.gensalt()).decode("utf-8")


def hash_password_pbkdf2(password: str) -> str:
    """Hash mật khẩu bằng PBKDF2-HMAC-SHA256 kèm salt ngẫu nhiên (tương thích Nhánh A)."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()
    return f"{salt}${digest}"


# Alias tương thích với Nhánh A (services.hash_password)
hash_password = hashed_password


def verify_password(plain: str, stored_hash: str) -> bool:
    """Kiểm tra mật khẩu hỗ trợ đồng thời bcrypt (Nhánh B), PBKDF2 salt$digest (Nhánh A) và plain text."""
    if not stored_hash:
        return False
    if stored_hash.startswith(("$2b$", "$2a$", "$2y$")):
        try:
            return bcrypt.checkpw(_bcrypt_secret(plain), stored_hash.encode("utf-8"))
        except ValueError:
            return False
    if "$" in stored_hash:
        salt, digest = stored_hash.split("$", 1)
        candidate = hashlib.pbkdf2_hmac(
            "sha256", plain.encode("utf-8"), salt.encode("utf-8"), 100_000
        ).hex()
        return hmac.compare_digest(candidate, digest)
    return hmac.compare_digest(plain, stored_hash)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload.update({
        "exp": datetime.now(timezone.utc) + timedelta(minutes=EXPIRE),
        "type": "access",
    })
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    payload.update({
        "exp": datetime.now(timezone.utc) + timedelta(minutes=REFRESH_EXPIRE),
        "type": "refresh",
    })
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise ValueError("TOKEN_EXPIRED")
    except jwt.PyJWTError:
        return None


def refresh_access_token(refresh_token: str) -> dict:
    try:
        payload = decode_access_token(refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token đã hết hạn, vui lòng đăng nhập lại",
        )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token không hợp lệ",
        )
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không phải là refresh token",
        )

    token_data = {"email": payload["email"], "role": payload["role"]}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
    }
