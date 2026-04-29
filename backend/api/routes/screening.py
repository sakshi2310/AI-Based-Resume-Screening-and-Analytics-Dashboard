from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from config.settings import get_settings
from db.collections import get_screenings_collection
from ml.evaluators.metrics import compute_classification_metrics, compute_ranking_metrics
from ml.pipeline import ResumeScreeningPipeline
from models.job import JobCreate
from models.screening import (
    ClassificationEvaluationRequest,
    ClassificationEvaluationResponse,
    RankingEvaluationRequest,
    RankingEvaluationResponse,
    ResumeTextScreeningRequest,
    ScreeningResponse,
)

router = APIRouter()
pipeline = ResumeScreeningPipeline()
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def _validate_upload(filename: str | None) -> str:
    cleaned = (filename or "").strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A filename is required")

    extension = Path(cleaned).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {allowed}",
        )

    return cleaned


def _safe_storage_name(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return f"{uuid4().hex}{suffix}"


async def _store_screening_result(response: ScreeningResponse, filename: str | None) -> None:
    document = {
        "candidate_name": response.parsed_resume.name,
        "candidate_email": response.parsed_resume.email,
        "source_filename": filename,
        "job_title": response.job.title,
        "job_department": response.job.department,
        "final_score": response.score.final_score,
        "recommendation": response.recommendation,
        "matched_skills": response.score.matched_skills,
        "missing_skills": response.score.missing_skills,
        "method": response.score.method,
        "created_at": datetime.now(timezone.utc),
        "screening_payload": response.model_dump(mode="json"),
    }
    await get_screenings_collection().insert_one(document)


@router.post("/parse-upload")
async def parse_resume_upload(file: UploadFile = File(...)) -> dict:
    filename = _validate_upload(file.filename)
    content = await file.read()
    max_size_bytes = get_settings().max_resume_upload_size_mb * 1024 * 1024
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    if len(content) > max_size_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file exceeds size limit")
    parsed_resume = pipeline.parse_resume_bytes(content, filename)
    return {"filename": filename, "parsed_resume": parsed_resume.model_dump()}


@router.post("/score-upload", response_model=ScreeningResponse)
async def score_resume_upload(
    file: UploadFile = File(...),
    job: str = Form(...),
    persist_result: bool = Form(default=True),
) -> ScreeningResponse:
    filename = _validate_upload(file.filename)
    content = await file.read()
    max_size_bytes = get_settings().max_resume_upload_size_mb * 1024 * 1024
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    if len(content) > max_size_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file exceeds size limit")

    try:
        job_payload = JobCreate.model_validate_json(job)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job payload") from exc

    settings = get_settings()
    stored_filename = _safe_storage_name(filename)
    destination = settings.upload_dir / stored_filename
    destination.write_bytes(content)

    response = pipeline.screen_resume_bytes(content, filename, job_payload)
    if persist_result:
        await _store_screening_result(response, filename)

    return response


@router.post("/score-text", response_model=ScreeningResponse)
async def score_resume_text(payload: ResumeTextScreeningRequest) -> ScreeningResponse:
    return pipeline.screen_resume_text(
        resume_text=payload.resume_text,
        job=payload.job,
        source_name=payload.source_name,
    )


@router.post("/evaluate/classification", response_model=ClassificationEvaluationResponse)
async def evaluate_classification(payload: ClassificationEvaluationRequest) -> ClassificationEvaluationResponse:
    metrics = compute_classification_metrics(
        y_true=payload.y_true,
        y_score=payload.y_score,
        threshold=payload.threshold,
    )
    return ClassificationEvaluationResponse(**metrics)


@router.post("/evaluate/ranking", response_model=RankingEvaluationResponse)
async def evaluate_ranking(payload: RankingEvaluationRequest) -> RankingEvaluationResponse:
    metrics = compute_ranking_metrics(
        queries=[query.model_dump() for query in payload.queries],
        k=payload.k,
    )
    return RankingEvaluationResponse(**metrics)
