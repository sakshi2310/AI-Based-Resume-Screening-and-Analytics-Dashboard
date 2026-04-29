from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


CandidateStatus = Literal["New", "Under Review", "Shortlisted", "Rejected", "Interviewed"]
FinalCandidateStatus = Literal["Shortlisted", "Under Review", "Rejected"]
StatusSource = Literal["ai", "manual"]
EmailStatus = Literal["pending", "sent", "failed"]


class ParsedResumeData(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    job_titles: list[str] = Field(default_factory=list)
    companies: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    normalized_skills: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    experience_years: float | None = None
    summary: str | None = None
    sections: dict[str, str] = Field(default_factory=dict)
    quality_flags: list[str] = Field(default_factory=list)
    raw_text_excerpt: str | None = None


class ResumeParsedDataView(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    skills: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    experience_years: float | None = None
    experience_text: str | None = None
    summary: str | None = None
    raw_text_excerpt: str | None = None


class ResumeAiScore(BaseModel):
    final_score: float
    skill_score: float
    experience_score: float
    education_score: float
    profile_score: float
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    breakdown: str
    method: str


class ResumeRecord(BaseModel):
    id: str
    original_filename: str
    stored_filename: str
    file_url: str
    file_size_bytes: int
    mime_type: str
    job_id: str | None = None
    job_title: str | None = None
    uploaded_by: str
    uploaded_at: datetime
    created_at: datetime
    updated_at: datetime
    parse_status: Literal["success", "failed", "pending"]
    parse_error: str | None = None
    candidate_name: str | None = None
    score: float | None = None
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    ml_suggested_status: CandidateStatus | None = None
    candidate_status: CandidateStatus = "New"
    status_source: StatusSource = "manual"
    final_status: FinalCandidateStatus | None = None
    email_status: EmailStatus | None = None
    email_error: str | None = None
    email_sent_at: datetime | None = None
    predicted_score: float | None = None
    parsed_data: ResumeParsedDataView | None = None
    ai_score: ResumeAiScore | None = None
    ai_explanation: str | None = None
    ai_recommended_status: CandidateStatus | None = None
    ai_status_reason: str | None = None
    ai_fairness_note: str | None = None


class ResumeStatusUpdate(BaseModel):
    candidate_status: CandidateStatus


class CandidateStatusConfirmationRequest(BaseModel):
    final_status: FinalCandidateStatus
