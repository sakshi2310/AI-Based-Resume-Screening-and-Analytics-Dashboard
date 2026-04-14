from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings, get_upload_dir
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.db.seed import ensure_indexes, normalize_legacy_resumes, seed_demo_admin

settings = get_settings()
upload_dir = get_upload_dir()
upload_dir.mkdir(parents=True, exist_ok=True)


def get_allowed_origins() -> list[str]:
    configured = [origin.strip() for origin in settings.frontend_origin.split(",") if origin.strip()]
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8083",
        "http://127.0.0.1:8083",
    ]

    unique_origins: list[str] = []
    for origin in [*configured, *defaults]:
        if origin not in unique_origins:
            unique_origins.append(origin)
    return unique_origins


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    await ensure_indexes()
    await normalize_legacy_resumes()
    await seed_demo_admin()
    yield
    await close_mongo_connection()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
app.mount("/uploads/resumes", StaticFiles(directory=str(upload_dir)), name="uploaded-resumes")


@app.get("/")
async def root() -> dict:
    return {"message": settings.app_name, "docs": "/docs"}
