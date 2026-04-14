from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.mongodb import get_database


async def ensure_indexes() -> None:
    db = get_database()
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index([("created_at", -1)])
    await db.jobs.create_index([("is_active", -1), ("created_at", -1)])
    await db.resumes.create_index([("uploaded_at", -1)])
    await db.resumes.create_index([("job_id", 1), ("uploaded_at", -1)])


async def normalize_legacy_resumes() -> None:
    db = get_database()

    async for document in db.resumes.find():
        updates: dict[str, object] = {}

        stored_filename = document.get("stored_filename")
        if (not document.get("file_url")) and isinstance(stored_filename, str) and stored_filename.strip():
            updates["file_url"] = f"/uploads/resumes/{stored_filename.strip()}"

        if "file_size_bytes" in document:
            try:
                normalized_size = int(document.get("file_size_bytes") or 0)
            except (TypeError, ValueError):
                normalized_size = 0
            if document.get("file_size_bytes") != normalized_size:
                updates["file_size_bytes"] = normalized_size

        if "mime_type" not in document or not document.get("mime_type"):
            updates["mime_type"] = "application/octet-stream"

        if "candidate_status" not in document or not document.get("candidate_status"):
            updates["candidate_status"] = "New"

        if updates:
            await db.resumes.update_one({"_id": document["_id"]}, {"$set": updates})


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
