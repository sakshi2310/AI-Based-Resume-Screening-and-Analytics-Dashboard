from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    app_name: str = "ResumeAI Backend"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-this-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    mongodb_db_name: str = "resume_ai"
    frontend_origin: str = "http://localhost:5173"
    upload_dir: str = "uploads/resumes"
    max_resume_upload_size_mb: int = 10
    demo_admin_email: str = "admin@resumeai.local"
    demo_admin_password: str = "Admin@123"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("frontend_origin", mode="before")
    @classmethod
    def normalize_frontend_origin(cls, value: Any) -> str:
        if isinstance(value, str):
            return value.strip().strip('"').strip("'")
        return str(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_upload_dir() -> Path:
    settings = get_settings()
    return Path(settings.upload_dir).resolve()
