from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.mongodb import get_database


async def ensure_indexes() -> None:
    db = get_database()
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index([("created_at", -1)])
    await db.jobs.create_index([("is_active", -1), ("created_at", -1)])


async def seed_demo_admin() -> None:
    settings = get_settings()
    db = get_database()
    existing = await db.users.find_one({"email": settings.demo_admin_email.lower()})
    now = datetime.now(timezone.utc)
    password_hash = get_password_hash(settings.demo_admin_password)

    if existing:
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
            "email": settings.demo_admin_email.lower(),
            "full_name": "System Admin",
            "password_hash": password_hash,
            "hashed_password": password_hash,
            "role": "admin",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
    )
