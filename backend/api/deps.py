from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.security import decode_access_token
from db.bootstrap import ensure_database_ready
from db.mongodb import get_database

security = HTTPBearer(auto_error=False)


def serialize_user(document: dict) -> dict:
    full_name = document.get("full_name")
    if not isinstance(full_name, str) or not full_name.strip():
        email = str(document.get("email", "")).strip()
        full_name = email.split("@", maxsplit=1)[0] if email else "User"

    created_at = document.get("created_at") or document.get("updated_at") or datetime.now(timezone.utc)

    return {
        "id": str(document["_id"]),
        "email": document["email"],
        "full_name": full_name,
        "role": document.get("role", "recruiter"),
        "is_active": document.get("is_active", True),
        "created_at": created_at,
    }


async def require_database_connection() -> None:
    if await ensure_database_ready():
        return

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Backend is still starting. Please wait a few seconds and try again.",
    )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    await require_database_connection()
    db = get_database()
    try:
        object_id = ObjectId(user_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    document = await db.users.find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not document.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    return serialize_user(document)


async def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def get_current_staff(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in {"admin", "recruiter"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or recruiter access required")
    return current_user
