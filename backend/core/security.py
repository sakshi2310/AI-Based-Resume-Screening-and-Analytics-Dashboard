from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from config.settings import get_settings

PBKDF2_ITERATIONS = 100_000


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _urlsafe_b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def get_password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{_urlsafe_b64encode(salt)}.{_urlsafe_b64encode(derived)}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt_b64, digest_b64 = hashed_password.split(".", maxsplit=1)
        salt = _urlsafe_b64decode(salt_b64)
        expected = _urlsafe_b64decode(digest_b64)
    except ValueError:
        return False

    derived = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(derived, expected)


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "exp": int(expires_at.timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _urlsafe_b64encode(payload_bytes)
    signature = hmac.new(settings.auth_secret_key.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_urlsafe_b64encode(signature)}"


def decode_access_token(token: str) -> dict[str, object]:
    settings = get_settings()
    try:
        payload_b64, signature_b64 = token.split(".", maxsplit=1)
    except ValueError as exc:
        raise ValueError("Invalid token") from exc

    expected_signature = hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    signature = _urlsafe_b64decode(signature_b64)
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("Invalid token")

    try:
        payload = json.loads(_urlsafe_b64decode(payload_b64).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Invalid token") from exc

    exp = payload.get("exp")
    if not isinstance(exp, int) or datetime.now(timezone.utc).timestamp() >= exp:
        raise ValueError("Token expired")

    return payload
