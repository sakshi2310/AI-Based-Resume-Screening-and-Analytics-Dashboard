from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pymongo import ReturnDocument

from api.deps import get_current_staff
from core.candidate_records import build_resume_record
from core.recruitment_email import process_candidate_confirmation_email
from db.collections import get_resumes_collection
from models.resume import CandidateStatusConfirmationRequest, ResumeRecord

router = APIRouter()


@router.post("/{candidate_id}/confirm-status", response_model=ResumeRecord)
async def confirm_candidate_status(
    candidate_id: str,
    payload: CandidateStatusConfirmationRequest,
    background_tasks: BackgroundTasks,
    _: dict = Depends(get_current_staff),
) -> ResumeRecord:
    try:
        object_id = ObjectId(candidate_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid candidate id") from exc

    collection = get_resumes_collection()
    existing = await collection.find_one({"_id": object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if existing.get("final_status"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Candidate status has already been confirmed")

    now = datetime.now(timezone.utc)
    document = await collection.find_one_and_update(
        {"_id": object_id},
        {
            "$set": {
                "final_status": payload.final_status,
                "candidate_status": payload.final_status,
                "status_source": "manual",
                "email_status": "pending",
                "email_error": None,
                "email_sent_at": None,
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    background_tasks.add_task(process_candidate_confirmation_email, candidate_id)
    return build_resume_record(document)


@router.post("/{candidate_id}/resend-email", response_model=ResumeRecord)
async def resend_candidate_email(
    candidate_id: str,
    background_tasks: BackgroundTasks,
    _: dict = Depends(get_current_staff),
) -> ResumeRecord:
    try:
        object_id = ObjectId(candidate_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid candidate id") from exc

    collection = get_resumes_collection()
    existing = await collection.find_one({"_id": object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if not existing.get("final_status"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Final status must be confirmed before sending email")

    now = datetime.now(timezone.utc)
    document = await collection.find_one_and_update(
        {"_id": object_id},
        {
            "$set": {
                "email_status": "pending",
                "email_error": None,
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    background_tasks.add_task(process_candidate_confirmation_email, candidate_id)
    return build_resume_record(document)
