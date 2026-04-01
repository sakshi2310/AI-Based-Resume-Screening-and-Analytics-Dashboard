from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import ReturnDocument

from app.api.deps import get_current_admin, get_current_user, serialize_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.mongodb import get_database
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserPublic

router = APIRouter()


def get_stored_password_hash(document: dict) -> str | None:
    return document.get("password_hash") or document.get("hashed_password")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate) -> TokenResponse:
    db = get_database()
    existing_user = await db.users.find_one({"email": payload.email.lower()})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")

    now = datetime.now(timezone.utc)
    password_hash = get_password_hash(payload.password)
    document = {
        "email": payload.email.lower(),
        "full_name": payload.full_name.strip(),
        "password_hash": password_hash,
        "hashed_password": password_hash,
        "role": payload.role,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(document)
    document["_id"] = result.inserted_id

    user = UserPublic(**serialize_user(document))
    return TokenResponse(access_token=create_access_token(str(result.inserted_id)), user=user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    db = get_database()
    document = await db.users.find_one({"email": payload.email.lower()})
    stored_password_hash = get_stored_password_hash(document) if document else None
    if document is None or stored_password_hash is None or not verify_password(payload.password, stored_password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user = UserPublic(**serialize_user(document))
    return TokenResponse(access_token=create_access_token(str(document["_id"])), user=user)


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: dict = Depends(get_current_user)) -> UserPublic:
    return UserPublic(**current_user)


@router.get("/users", response_model=list[UserPublic])
async def list_users(_: dict = Depends(get_current_admin)) -> list[UserPublic]:
    db = get_database()
    users = []
    async for document in db.users.find().sort("created_at", -1):
        users.append(UserPublic(**serialize_user(document)))
    return users


@router.patch("/users/{user_id}/role", response_model=UserPublic)
async def update_user_role(user_id: str, role: str, _: dict = Depends(get_current_admin)) -> UserPublic:
    if role not in {"admin", "recruiter", "viewer"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    db = get_database()
    try:
        object_id = ObjectId(user_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from exc

    result = await db.users.find_one_and_update(
        {"_id": object_id},
        {"$set": {"role": role, "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(**serialize_user(result))
