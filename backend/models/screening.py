from __future__ import annotations

from pydantic import BaseModel, Field

from models.job import JobCreate
from models.resume import ParsedResumeData


class ScoreBreakdown(BaseModel):
    final_score: float = 0.0
    skill_score: float = 0.0
    experience_score: float = 0.0
    education_score: float = 0.0
    profile_score: float = 0.0
    semantic_score: float = 0.0
    hard_filter_score: float = 0.0
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    method: str = "hybrid_resume_job_ranker"


class ScreeningResponse(BaseModel):
    job: JobCreate
    parsed_resume: ParsedResumeData
    score: ScoreBreakdown
    recommendation: str
    explanation: str


class ResumeTextScreeningRequest(BaseModel):
    resume_text: str = Field(min_length=30)
    source_name: str = "inline_resume.txt"
    job: JobCreate


class ClassificationEvaluationRequest(BaseModel):
    y_true: list[int] = Field(min_length=1)
    y_score: list[float] = Field(min_length=1)
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class ClassificationEvaluationResponse(BaseModel):
    threshold: float
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    support: int


class RankedCandidate(BaseModel):
    candidate_id: str
    score: float
    relevant: int = Field(ge=0, le=1)


class RankingQuery(BaseModel):
    query_id: str
    candidates: list[RankedCandidate] = Field(min_length=1)


class RankingEvaluationRequest(BaseModel):
    queries: list[RankingQuery] = Field(min_length=1)
    k: int = Field(default=5, ge=1, le=50)


class RankingEvaluationResponse(BaseModel):
    queries: int
    precision_at_k: float
    recall_at_k: float
    mean_reciprocal_rank: float
    mean_average_precision_at_k: float
    ndcg_at_k: float
