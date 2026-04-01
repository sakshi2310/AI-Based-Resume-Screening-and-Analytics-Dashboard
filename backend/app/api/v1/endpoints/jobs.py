from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import ReturnDocument

from app.api.deps import get_current_staff, get_current_user
from app.db.mongodb import get_database
from app.schemas.job import JobCreate, JobPublic, JobStatusUpdate, JobUpdate

router = APIRouter()


def clean_text_list(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = value.strip()
        normalized = item.lower()
        if not item or normalized in seen:
            continue
        cleaned.append(item)
        seen.add(normalized)
    return cleaned


def serialize_job(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "title": document["title"],
        "department": document["department"],
        "location": document["location"],
        "employment_type": document["employment_type"],
        "work_mode": document["work_mode"],
        "experience_level": document["experience_level"],
        "min_experience_years": document["min_experience_years"],
        "max_experience_years": document.get("max_experience_years"),
        "openings": document.get("openings", 1),
        "salary_range": document.get("salary_range"),
        "description": document["description"],
        "responsibilities": document.get("responsibilities", []),
        "requirements": document.get("requirements", []),
        "skills": document.get("skills", []),
        "qualifications": document.get("qualifications", []),
        "benefits": document.get("benefits", []),
        "is_active": document.get("is_active", True),
        "created_by": document.get("created_by", "Unknown"),
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }


def parse_object_id(value: str, detail: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc


@router.get("", response_model=list[JobPublic])
async def list_jobs(_: dict = Depends(get_current_user)) -> list[JobPublic]:
    db = get_database()
    jobs: list[JobPublic] = []
    async for document in db.jobs.find().sort([("is_active", -1), ("created_at", -1)]):
        jobs.append(JobPublic(**serialize_job(document)))
    return jobs


@router.get("/{job_id}", response_model=JobPublic)
async def get_job(job_id: str, _: dict = Depends(get_current_user)) -> JobPublic:
    db = get_database()
    object_id = parse_object_id(job_id, "Invalid job id")
    document = await db.jobs.find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobPublic(**serialize_job(document))


@router.post("", response_model=JobPublic, status_code=status.HTTP_201_CREATED)
async def create_job(payload: JobCreate, current_user: dict = Depends(get_current_staff)) -> JobPublic:
    db = get_database()
    if payload.max_experience_years is not None and payload.max_experience_years < payload.min_experience_years:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Max experience must be greater than or equal to min experience")

    now = datetime.now(timezone.utc)
    document = {
        **payload.model_dump(),
        "responsibilities": clean_text_list(payload.responsibilities),
        "requirements": clean_text_list(payload.requirements),
        "skills": clean_text_list(payload.skills),
        "qualifications": clean_text_list(payload.qualifications),
        "benefits": clean_text_list(payload.benefits),
        "created_by": current_user["full_name"],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.jobs.insert_one(document)
    document["_id"] = result.inserted_id
    return JobPublic(**serialize_job(document))


@router.put("/{job_id}", response_model=JobPublic)
async def update_job(job_id: str, payload: JobUpdate, _: dict = Depends(get_current_staff)) -> JobPublic:
    db = get_database()
    object_id = parse_object_id(job_id, "Invalid job id")
    update_fields = payload.model_dump(exclude_unset=True)

    for field in ("responsibilities", "requirements", "skills", "qualifications", "benefits"):
        if field in update_fields and update_fields[field] is not None:
            update_fields[field] = clean_text_list(update_fields[field])

    if "min_experience_years" in update_fields and "max_experience_years" in update_fields:
        min_years = update_fields["min_experience_years"]
        max_years = update_fields["max_experience_years"]
        if max_years is not None and min_years is not None and max_years < min_years:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Max experience must be greater than or equal to min experience")

    if not update_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No job fields provided")

    update_fields["updated_at"] = datetime.now(timezone.utc)
    document = await db.jobs.find_one_and_update(
        {"_id": object_id},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobPublic(**serialize_job(document))


@router.patch("/{job_id}/status", response_model=JobPublic)
async def update_job_status(job_id: str, payload: JobStatusUpdate, _: dict = Depends(get_current_staff)) -> JobPublic:
    db = get_database()
    object_id = parse_object_id(job_id, "Invalid job id")
    document = await db.jobs.find_one_and_update(
        {"_id": object_id},
        {"$set": {"is_active": payload.is_active, "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobPublic(**serialize_job(document))


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str, _: dict = Depends(get_current_staff)) -> None:
    db = get_database()
    object_id = parse_object_id(job_id, "Invalid job id")
    result = await db.jobs.delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
