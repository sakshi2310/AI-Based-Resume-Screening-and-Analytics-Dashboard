from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ResumeAI Backend"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-this-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    mongodb_db_name: str = "resume_ai"
    frontend_origin: str = "http://localhost:5173"
    demo_admin_email: str = "admin@resumeai.local"
    demo_admin_password: str = "Admin@123"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
