from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo import ReturnDocument

from api.deps import get_current_staff, get_current_user
from db.collections import get_jobs_collection
from models.job import JobCreate, JobPublic, JobStatusUpdate, JobUpdate

router = APIRouter()


def _serialize_job(document: dict) -> JobPublic:
    return JobPublic(
        id=str(document["_id"]),
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
        created_by=document.get("created_by", "System"),
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )


def _normalize_items(items: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()

    for item in items:
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(normalized)

    return cleaned


@router.get("", response_model=list[JobPublic])
async def list_jobs(_: dict = Depends(get_current_user)) -> list[JobPublic]:
    collection = get_jobs_collection()
    jobs: list[JobPublic] = []

    async for document in collection.find().sort([("is_active", -1), ("created_at", -1)]):
        jobs.append(_serialize_job(document))

    return jobs


@router.post("", response_model=JobPublic, status_code=status.HTTP_201_CREATED)
async def create_job(payload: JobCreate, current_user: dict = Depends(get_current_staff)) -> JobPublic:
    if payload.max_experience_years is not None and payload.max_experience_years < payload.min_experience_years:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_experience_years must be greater than or equal to min_experience_years",
        )

    now = datetime.now(timezone.utc)
    document = {
        **payload.model_dump(),
        "responsibilities": _normalize_items(payload.responsibilities),
        "requirements": _normalize_items(payload.requirements),
        "skills": _normalize_items(payload.skills),
        "qualifications": _normalize_items(payload.qualifications),
        "benefits": _normalize_items(payload.benefits),
        "is_active": payload.is_active,
        "created_by": current_user["full_name"],
        "created_at": now,
        "updated_at": now,
    }

    collection = get_jobs_collection()
    result = await collection.insert_one(document)
    document["_id"] = result.inserted_id
    return _serialize_job(document)


@router.get("/{job_id}", response_model=JobPublic)
async def get_job(job_id: str, _: dict = Depends(get_current_user)) -> JobPublic:
    try:
        object_id = ObjectId(job_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job id") from exc

    document = await get_jobs_collection().find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return _serialize_job(document)


@router.put("/{job_id}", response_model=JobPublic)
async def update_job(job_id: str, payload: JobUpdate, _: dict = Depends(get_current_staff)) -> JobPublic:
    try:
        object_id = ObjectId(job_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job id") from exc

    updates = payload.model_dump(exclude_unset=True)
    min_years = updates.get("min_experience_years")
    max_years = updates.get("max_experience_years")
    if min_years is not None and max_years is not None and max_years < min_years:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_experience_years must be greater than or equal to min_experience_years",
        )

    for field in ("responsibilities", "requirements", "skills", "qualifications", "benefits"):
        if field in updates and updates[field] is not None:
            updates[field] = _normalize_items(updates[field])

    updates["updated_at"] = datetime.now(timezone.utc)
    document = await get_jobs_collection().find_one_and_update(
        {"_id": object_id},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _serialize_job(document)


@router.patch("/{job_id}/status", response_model=JobPublic)
async def update_job_status(job_id: str, payload: JobStatusUpdate, _: dict = Depends(get_current_staff)) -> JobPublic:
    try:
        object_id = ObjectId(job_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job id") from exc

    document = await get_jobs_collection().find_one_and_update(
        {"_id": object_id},
        {"$set": {"is_active": payload.is_active, "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _serialize_job(document)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_job(job_id: str, _: dict = Depends(get_current_staff)) -> Response:
    try:
        object_id = ObjectId(job_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job id") from exc

    result = await get_jobs_collection().delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
