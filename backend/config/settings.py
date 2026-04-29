from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Resume Intelligence Backend"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"

    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    mongodb_db_name: str = "resume_intelligence"
    redis_url: str = "redis://127.0.0.1:6379/0"
    file_storage_path: str = "uploads/resumes"

    frontend_origins: str = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
    max_resume_upload_size_mb: int = 10
    auth_secret_key: str = "change-this-secret-key"
    access_token_expire_minutes: int = 60 * 24
    demo_admin_email: str = "admin@resumex.com"
    demo_admin_password: str = "Admin@123"
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: int = 15
    email_from_address: str = "noreply@resumex.local"
    email_from_name: str = "ResumeAI Recruitment"
    email_retry_count: int = 2
    email_retry_delay_seconds: int = 3
    send_under_review_emails: bool = True

    default_embedding_model: str = "all-MiniLM-L6-v2"
    enable_transformer_similarity: bool = True
    enable_llm_explanations: bool = False
    llm_provider: str = "gemini"
    llm_model: str = "gemini-1.5-flash"
    llm_api_key: str = ""

    celery_task_always_eager: bool = False
    mlflow_tracking_uri: str = "file:./mlruns"
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket_name: str = "resume-files"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @computed_field
    @property
    def upload_dir(self) -> Path:
        return Path(self.file_storage_path).resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
