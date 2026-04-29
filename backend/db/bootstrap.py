from __future__ import annotations

from datetime import datetime, timezone

from config.settings import get_settings
from core.security import get_password_hash
from db.mongodb import connect_to_mongo, get_database

_database_bootstrapped = False


async def ensure_database_ready() -> bool:
    global _database_bootstrapped

    if not await connect_to_mongo():
        return False

    if _database_bootstrapped:
        return True

    db = get_database()
    await db["users"].create_index("email", unique=True)
    await db["jobs"].create_index([("created_at", -1)])
    await db["jobs"].create_index([("is_active", -1), ("created_at", -1)])
    await db["resumes"].create_index([("uploaded_at", -1)])
    await db["resumes"].create_index([("job_id", 1), ("candidate_status", 1)])
    await db["screenings"].create_index([("job_title", 1), ("final_score", -1)])
    await db["screenings"].create_index([("candidate_email", 1)])
    await db["evaluation_runs"].create_index([("created_at", -1)])

    await seed_demo_admin()
    _database_bootstrapped = True
    return True


def reset_database_bootstrap_state() -> None:
    global _database_bootstrapped
    _database_bootstrapped = False


async def seed_demo_admin() -> None:
    settings = get_settings()
    db = get_database()
    email = settings.demo_admin_email.strip().lower()
    now = datetime.now(timezone.utc)
    password_hash = get_password_hash(settings.demo_admin_password)
    existing = await db.users.find_one({"email": email})

    if existing is not None:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "full_name": existing.get("full_name", "System Admin"),
                    "password_hash": password_hash,
                    "hashed_password": password_hash,
                    "role": existing.get("role", "admin"),
                    "is_active": existing.get("is_active", True),
                    "updated_at": now,
                }
            },
        )
        return

    await db.users.insert_one(
        {
            "email": email,
            "full_name": "System Admin",
            "password_hash": password_hash,
            "hashed_password": password_hash,
            "role": "admin",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
    )
