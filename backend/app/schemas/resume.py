from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ResumePublic(BaseModel):
    id: str
    original_filename: str
    stored_filename: str
    file_url: str
    file_size_bytes: int = Field(ge=0)
    mime_type: str
    job_id: str | None = None
    job_title: str | None = None
    uploaded_by: str
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)
