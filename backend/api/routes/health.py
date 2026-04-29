from fastapi import APIRouter

from config.settings import get_settings
from db.mongodb import get_database_status

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, object]:
    settings = get_settings()
    database_status = get_database_status()
    return {
        "status": "ok" if database_status["connected"] else "starting",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "database": database_status["state"],
        "database_connected": database_status["connected"],
        "database_error": database_status["error"],
    }
