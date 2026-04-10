from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CandidateStatus = Literal["New", "Under Review", "Shortlisted", "Rejected", "Interviewed"]


class ParsedResumeData(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    skills: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    experience_years: float | None = None
    summary: str | None = None
    raw_text_excerpt: str | None = None


class ResumeStatusUpdate(BaseModel):
    candidate_status: CandidateStatus


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
    parse_status: str = "pending"
    parse_error: str | None = None
    candidate_status: CandidateStatus = "New"
    parsed_data: ParsedResumeData | None = None

    model_config = ConfigDict(from_attributes=True)
