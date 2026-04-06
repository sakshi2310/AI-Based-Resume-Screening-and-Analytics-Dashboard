import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import get_current_staff, get_current_user
from app.core.config import get_settings, get_upload_dir
from app.db.mongodb import get_database
from app.schemas.resume import ResumePublic

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}


def sanitize_filename(filename: str) -> str:
    normalized = filename.strip()
    if not normalized:
        return "resume"
    return re.sub(r"[^a-zA-Z0-9._-]", "_", normalized)


def serialize_resume(document: dict) -> dict:
    job_id = document.get("job_id")
    return {
        "id": str(document["_id"]),
        "original_filename": document["original_filename"],
        "stored_filename": document["stored_filename"],
        "file_url": f"/uploads/resumes/{document['stored_filename']}",
        "file_size_bytes": document["file_size_bytes"],
        "mime_type": document["mime_type"],
        "job_id": str(job_id) if isinstance(job_id, ObjectId) else None,
        "job_title": document.get("job_title"),
        "uploaded_by": document["uploaded_by"],
        "uploaded_at": document["uploaded_at"],
    }


def parse_object_id(value: str, detail: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc


def validate_upload(file: UploadFile, file_size: int) -> None:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are supported",
        )

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type",
        )

    max_size_bytes = get_settings().max_resume_upload_size_mb * 1024 * 1024
    if file_size <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds {get_settings().max_resume_upload_size_mb}MB upload limit",
        )


@router.get("", response_model=list[ResumePublic])
async def list_resumes(_: dict = Depends(get_current_user)) -> list[ResumePublic]:
    db = get_database()
    resumes: list[ResumePublic] = []
    async for document in db.resumes.find().sort("uploaded_at", -1):
        resumes.append(ResumePublic(**serialize_resume(document)))
    return resumes


@router.post("/upload", response_model=list[ResumePublic], status_code=status.HTTP_201_CREATED)
async def upload_resumes(
    files: list[UploadFile] = File(...),
    job_id: str | None = Form(default=None),
    current_user: dict = Depends(get_current_staff),
) -> list[ResumePublic]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required")

    db = get_database()
    upload_dir = get_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    selected_job_id: ObjectId | None = None
    selected_job_title: str | None = None
    if job_id:
        selected_job_id = parse_object_id(job_id, "Invalid job id")
        job_doc = await db.jobs.find_one({"_id": selected_job_id})
        if job_doc is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        selected_job_title = job_doc["title"]

    now = datetime.now(timezone.utc)
    created_records: list[ResumePublic] = []

    for file in files:
        content = await file.read()
        file_size = len(content)
        validate_upload(file, file_size)

        extension = Path(file.filename or "").suffix.lower()
        stored_filename = f"{uuid.uuid4().hex}{extension}"
        safe_original_name = sanitize_filename(file.filename or "resume")
        destination_path = (upload_dir / stored_filename).resolve()

        if upload_dir not in destination_path.parents:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload path")

        destination_path.write_bytes(content)

        document = {
            "original_filename": safe_original_name,
            "stored_filename": stored_filename,
            "file_size_bytes": file_size,
            "mime_type": file.content_type or "application/octet-stream",
            "job_id": selected_job_id,
            "job_title": selected_job_title,
            "uploaded_by": current_user["full_name"],
            "uploader_id": ObjectId(current_user["id"]),
            "uploaded_at": now,
        }

        result = await db.resumes.insert_one(document)
        document["_id"] = result.inserted_id
        created_records.append(ResumePublic(**serialize_resume(document)))

    return created_records


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(resume_id: str, _: dict = Depends(get_current_staff)) -> None:
    db = get_database()
    object_id = parse_object_id(resume_id, "Invalid resume id")
    document = await db.resumes.find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    upload_path = (get_upload_dir() / document["stored_filename"]).resolve()
    upload_root = get_upload_dir()
    if upload_root in upload_path.parents and upload_path.exists():
        upload_path.unlink()

    await db.resumes.delete_one({"_id": object_id})
