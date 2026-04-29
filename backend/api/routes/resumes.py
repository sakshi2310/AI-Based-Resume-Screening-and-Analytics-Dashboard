from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status

from api.deps import get_current_staff, get_current_user
from config.settings import get_settings
from core.candidate_records import build_resume_record
from db.collections import get_jobs_collection, get_resumes_collection
from ml.pipeline import ResumeScreeningPipeline
from ml.scorers.status_recommender import ResumeStatusRecommender
from models.job import JobCreate
from models.resume import ResumeRecord, ResumeStatusUpdate

router = APIRouter()
pipeline = ResumeScreeningPipeline()
status_recommender = ResumeStatusRecommender()
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
CONFIRMABLE_STATUSES = {"Shortlisted", "Under Review", "Rejected"}


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
    return f"{uuid4().hex}{Path(filename).suffix.lower()}"


def _build_job_payload(document: dict) -> JobCreate:
    return JobCreate(
        title=document["title"],
        department=document["department"],
        location=document["location"],
        employment_type=document["employment_type"],
        work_mode=document["work_mode"],
        experience_level=document["experience_level"],
        min_experience_years=document["min_experience_years"],
        max_experience_years=document.get("max_experience_years"),
        openings=document.get("openings", 1),
        salary_range=document.get("salary_range"),
        description=document["description"],
        responsibilities=document.get("responsibilities", []),
        requirements=document.get("requirements", []),
        skills=document.get("skills", []),
        qualifications=document.get("qualifications", []),
        benefits=document.get("benefits", []),
        is_active=document.get("is_active", True),
    )


def _serialize_parsed_resume(parsed_resume) -> dict:
    projects_raw = parsed_resume.sections.get("projects", "")
    projects = [item.strip(" -\t") for item in projects_raw.replace("|", "\n").splitlines() if item.strip(" -\t")]
    experience_text = parsed_resume.sections.get("experience")
    if not experience_text and (parsed_resume.job_titles or parsed_resume.companies):
        experience_text = "\n".join([*parsed_resume.job_titles, *parsed_resume.companies]).strip()

    return {
        "name": parsed_resume.name,
        "email": parsed_resume.email,
        "phone": parsed_resume.phone,
        "location": parsed_resume.location,
        "skills": parsed_resume.skills,
        "education": parsed_resume.education,
        "projects": projects,
        "experience_years": parsed_resume.experience_years,
        "experience_text": experience_text,
        "summary": parsed_resume.summary,
        "raw_text_excerpt": parsed_resume.raw_text_excerpt,
    }

async def _find_job(job_id: str | None) -> tuple[ObjectId | None, dict | None]:
    if not job_id:
        return None, None

    try:
        object_id = ObjectId(job_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job id") from exc

    document = await get_jobs_collection().find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return object_id, document


@router.get("", response_model=list[ResumeRecord])
async def list_resumes(
    search: str | None = None,
    candidate_status: str | None = Query(default=None, alias="status"),
    job_id: str | None = None,
    _: dict = Depends(get_current_user),
) -> list[ResumeRecord]:
    query: dict = {}
    if job_id:
        try:
            query["job_id"] = ObjectId(job_id)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job id") from exc

    if search and search.strip():
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"original_filename": {"$regex": pattern, "$options": "i"}},
            {"job_title": {"$regex": pattern, "$options": "i"}},
            {"parsed_data.name": {"$regex": pattern, "$options": "i"}},
            {"parsed_data.email": {"$regex": pattern, "$options": "i"}},
            {"parsed_data.skills": {"$elemMatch": {"$regex": pattern, "$options": "i"}}},
        ]

    records: list[ResumeRecord] = []
    async for document in get_resumes_collection().find(query).sort([("uploaded_at", -1)]):
        record = build_resume_record(document)
        if candidate_status and record.candidate_status != candidate_status:
            continue
        records.append(record)
    return records


@router.post("/upload", response_model=list[ResumeRecord], status_code=status.HTTP_201_CREATED)
async def upload_resumes(
    files: list[UploadFile] = File(...),
    job_id: str | None = Form(default=None),
    current_user: dict = Depends(get_current_staff),
) -> list[ResumeRecord]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required")

    settings = get_settings()
    max_size_bytes = settings.max_resume_upload_size_mb * 1024 * 1024
    job_object_id, job_document = await _find_job(job_id)
    job_payload = _build_job_payload(job_document) if job_document else None
    collection = get_resumes_collection()
    saved_records: list[ResumeRecord] = []

    for upload in files:
        filename = _validate_upload(upload.filename)
        content = await upload.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{filename} is empty")
        if len(content) > max_size_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{filename} exceeds size limit")

        stored_filename = _safe_storage_name(filename)
        destination = settings.upload_dir / stored_filename
        destination.write_bytes(content)

        now = datetime.now(timezone.utc)
        document = {
            "original_filename": filename,
            "stored_filename": stored_filename,
            "file_url": f"/uploads/resumes/{stored_filename}",
            "file_size_bytes": len(content),
            "mime_type": upload.content_type or "application/octet-stream",
            "job_id": job_object_id,
            "job_title": job_document["title"] if job_document else None,
            "uploaded_by": current_user["full_name"],
            "uploaded_at": now,
            "created_at": now,
            "updated_at": now,
            "parse_status": "pending",
            "parse_error": None,
            "candidate_status": "New",
            "status_source": "manual",
            "candidate_name": None,
            "predicted_score": None,
            "parsed_data": None,
            "ai_score": None,
            "ai_explanation": None,
            "ml_suggested_status": None,
            "ai_recommended_status": None,
            "ai_status_reason": None,
            "ai_fairness_note": None,
            "final_status": None,
            "email_status": None,
            "email_error": None,
            "email_sent_at": None,
            "email_attempts": 0,
        }

        try:
            parsed_resume = pipeline.parse_resume_bytes(content, filename)
            document["parsed_data"] = _serialize_parsed_resume(parsed_resume)
            document["candidate_name"] = parsed_resume.name
            document["parse_status"] = "success"
            if job_payload is not None:
                score = pipeline.scorer.score(parsed_resume, job_payload)
                explanation = pipeline.explainer.explain(parsed_resume, job_payload, score)
                recommendation = status_recommender.recommend(score)
                document["predicted_score"] = round(score.final_score / 100.0, 4)
                document["ai_score"] = score.model_dump(mode="json")
                document["ai_explanation"] = explanation
                document["candidate_status"] = recommendation.status
                document["status_source"] = "ai"
                document["ml_suggested_status"] = recommendation.status
                document["ai_recommended_status"] = recommendation.status
                document["ai_status_reason"] = recommendation.reason
                document["ai_fairness_note"] = recommendation.fairness_note
        except Exception as exc:
            document["parse_status"] = "failed"
            document["parse_error"] = str(exc)

        result = await collection.insert_one(document)
        document["_id"] = result.inserted_id
        saved_records.append(build_resume_record(document))

    return saved_records


@router.patch("/{resume_id}/status", response_model=ResumeRecord)
async def update_resume_status(
    resume_id: str,
    payload: ResumeStatusUpdate,
    _: dict = Depends(get_current_staff),
) -> ResumeRecord:
    try:
        object_id = ObjectId(resume_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resume id") from exc

    from pymongo import ReturnDocument

    document = await get_resumes_collection().find_one_and_update(
        {"_id": object_id},
        {
            "$set": {
                "candidate_status": payload.candidate_status,
                "final_status": payload.candidate_status if payload.candidate_status in CONFIRMABLE_STATUSES else None,
                "status_source": "manual",
                "updated_at": datetime.now(timezone.utc),
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return build_resume_record(document)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_resume(resume_id: str, _: dict = Depends(get_current_staff)) -> Response:
    try:
        object_id = ObjectId(resume_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resume id") from exc

    document = await get_resumes_collection().find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    stored_filename = document.get("stored_filename")
    if stored_filename:
        file_path = get_settings().upload_dir / stored_filename
        if file_path.exists():
            file_path.unlink()

    await get_resumes_collection().delete_one({"_id": object_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
