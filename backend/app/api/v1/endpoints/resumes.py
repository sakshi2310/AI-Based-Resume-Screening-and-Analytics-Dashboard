from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pymongo import ReturnDocument

from app.api.deps import get_current_staff, get_current_user
from app.core.config import get_settings, get_upload_dir
from app.db.mongodb import get_database
from app.schemas.resume import ResumePublic, ResumeStatusUpdate
from app.services.ai_explainer import explain_candidate
from app.services.ai_scorer import compute_ai_score
from app.services.resume_parser import parse_resume

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def parse_object_id(value: str, detail: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc


def ensure_supported_filename(filename: str | None) -> str:
    cleaned = (filename or "").strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must have a filename")

    extension = Path(cleaned).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed types: {allowed}",
        )
    return cleaned


def sanitize_filename(filename: str) -> str:
    stem = Path(filename).stem.strip() or "resume"
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._-") or "resume"
    return f"{safe_stem}{Path(filename).suffix.lower()}"


def build_storage_name(filename: str) -> str:
    return f"{uuid4().hex}_{sanitize_filename(filename)}"


def coerce_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def build_file_url(document: dict) -> str:
    file_url = document.get("file_url")
    if isinstance(file_url, str) and file_url.strip():
        return file_url

    stored_filename = document.get("stored_filename")
    if isinstance(stored_filename, str) and stored_filename.strip():
        return f"/uploads/resumes/{stored_filename.strip()}"

    return ""


def serialize_resume(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "original_filename": document.get("original_filename") or "resume",
        "stored_filename": document.get("stored_filename") or "",
        "file_url": build_file_url(document),
        "file_size_bytes": coerce_int(document.get("file_size_bytes"), 0),
        "mime_type": document.get("mime_type", "application/octet-stream"),
        "job_id": str(document["job_id"]) if document.get("job_id") else None,
        "job_title": document.get("job_title"),
        "uploaded_by": document.get("uploaded_by", "Unknown"),
        "uploaded_at": document["uploaded_at"],
        "parse_status": document.get("parse_status", "pending"),
        "parse_error": document.get("parse_error"),
        "candidate_status": document.get("candidate_status", "New"),
        "predicted_score": document.get("predicted_score"),
        "parsed_data": document.get("parsed_data"),
        "ai_score": document.get("ai_score"),
        "ai_explanation": document.get("ai_explanation"),
    }


async def get_job_context(job_id: str | None) -> tuple[ObjectId | None, dict | None]:
    if not job_id:
        return None, None

    db = get_database()
    object_id = parse_object_id(job_id, "Invalid job id")
    job = await db.jobs.find_one({"_id": object_id})
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return object_id, job


@router.get("", response_model=list[ResumePublic])
async def list_resumes(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    job_id: str | None = None,
    _: dict = Depends(get_current_user),
) -> list[ResumePublic]:
    db = get_database()
    query: dict = {}

    if status_filter:
        query["candidate_status"] = status_filter
    if job_id:
        query["job_id"] = parse_object_id(job_id, "Invalid job id")

    if search and search.strip():
        term = re.escape(search.strip())
        query["$or"] = [
            {"original_filename": {"$regex": term, "$options": "i"}},
            {"job_title": {"$regex": term, "$options": "i"}},
            {"parsed_data.name": {"$regex": term, "$options": "i"}},
            {"parsed_data.email": {"$regex": term, "$options": "i"}},
            {"parsed_data.skills": {"$regex": term, "$options": "i"}},
        ]

    results: list[ResumePublic] = []
    async for document in db.resumes.find(query).sort([("uploaded_at", -1)]):
        results.append(ResumePublic(**serialize_resume(document)))
    return results


@router.post("/upload", response_model=list[ResumePublic], status_code=status.HTTP_201_CREATED)
async def upload_resumes(
    files: list[UploadFile] = File(...),
    job_id: str | None = Form(default=None),
    current_user: dict = Depends(get_current_staff),
) -> list[ResumePublic]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required")

    settings = get_settings()
    upload_dir = get_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    db = get_database()

    selected_job_id, selected_job = await get_job_context(job_id)

    created_records: list[ResumePublic] = []
    max_size_bytes = settings.max_resume_upload_size_mb * 1024 * 1024

    for file in files:
        original_filename = ensure_supported_filename(file.filename)
        content = await file.read()
        file_size_bytes = len(content)

        if file_size_bytes == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{original_filename} is empty")
        if file_size_bytes > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{original_filename} exceeds the {settings.max_resume_upload_size_mb} MB limit",
            )

        stored_filename = build_storage_name(original_filename)
        destination_path = upload_dir / stored_filename
        destination_path.write_bytes(content)

        now = datetime.now(timezone.utc)
        parse_status = "pending"
        parse_error = None
        parsed_data = None
        predicted_score = None
        ai_score = None
        ai_explanation = None

        try:
            parsed_data = parse_resume(content, Path(original_filename).suffix.lower())
            parse_status = "success"
        except Exception as exc:
            parse_status = "failed"
            parse_error = str(exc)

        if parse_status == "success" and parsed_data and selected_job is not None:
            try:
                ai_score = compute_ai_score(parsed_data, selected_job)
                predicted_score = round((ai_score.get("final_score", 0.0) or 0.0) / 100, 4)
                ai_explanation = explain_candidate(parsed_data, selected_job, ai_score)
            except Exception as exc:
                parse_error = f"Resume parsed, but AI scoring failed: {exc}"

        document = {
            "original_filename": original_filename,
            "stored_filename": stored_filename,
            "file_url": f"/uploads/resumes/{stored_filename}",
            "file_size_bytes": file_size_bytes,
            "mime_type": file.content_type or "application/octet-stream",
            "job_id": selected_job_id,
            "job_title": selected_job.get("title") if selected_job else None,
            "uploaded_by": current_user["full_name"],
            "uploaded_at": now,
            "parse_status": parse_status,
            "parse_error": parse_error,
            "candidate_status": "New",
            "predicted_score": predicted_score,
            "parsed_data": parsed_data,
            "ai_score": ai_score,
            "ai_explanation": ai_explanation,
        }
        result = await db.resumes.insert_one(document)
        document["_id"] = result.inserted_id
        created_records.append(ResumePublic(**serialize_resume(document)))

    return created_records


@router.patch("/{resume_id}/status", response_model=ResumePublic)
async def update_resume_status(
    resume_id: str,
    payload: ResumeStatusUpdate,
    _: dict = Depends(get_current_staff),
) -> ResumePublic:
    db = get_database()
    object_id = parse_object_id(resume_id, "Invalid resume id")
    document = await db.resumes.find_one_and_update(
        {"_id": object_id},
        {"$set": {"candidate_status": payload.candidate_status}},
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return ResumePublic(**serialize_resume(document))


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_resume(resume_id: str, _: dict = Depends(get_current_staff)) -> Response:
    db = get_database()
    object_id = parse_object_id(resume_id, "Invalid resume id")
    document = await db.resumes.find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    stored_filename = document.get("stored_filename")
    if stored_filename:
        file_path = get_upload_dir() / stored_filename
        file_path.unlink(missing_ok=True)

    await db.resumes.delete_one({"_id": object_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
