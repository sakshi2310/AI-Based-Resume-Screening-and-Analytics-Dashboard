from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.middleware.request_context import RequestContextMiddleware
from api.routes import api_router
from config.settings import get_settings
from db.bootstrap import ensure_database_ready, reset_database_bootstrap_state
from db.mongodb import close_mongo_connection

settings = get_settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_database_ready()
    yield
    reset_database_bootstrap_state()
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
app.include_router(api_router, prefix=settings.api_v1_prefix)
app.mount("/uploads/resumes", StaticFiles(directory=settings.upload_dir), name="uploaded_resumes")


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }
