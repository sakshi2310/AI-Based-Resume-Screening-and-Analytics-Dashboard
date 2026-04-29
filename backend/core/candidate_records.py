from __future__ import annotations

from models.resume import ResumeAiScore, ResumeParsedDataView, ResumeRecord
from models.screening import ScoreBreakdown
from ml.scorers.status_recommender import ResumeStatusRecommender

status_recommender = ResumeStatusRecommender()


def _score_breakdown_text(score: ScoreBreakdown) -> str:
    strengths = ", ".join(score.strengths[:3]) or "No major strengths detected"
    risks = ", ".join(score.risks[:3]) or "No major risks detected"
    return f"Strengths: {strengths}. Risks: {risks}."


def _parsed_data_view(parsed_data: dict | None) -> ResumeParsedDataView | None:
    if not parsed_data:
        return None
    return ResumeParsedDataView(**parsed_data)


def _ai_score_view(score_payload: dict | None) -> ResumeAiScore | None:
    if not score_payload:
        return None

    score = ScoreBreakdown(**score_payload)
    return ResumeAiScore(
        final_score=score.final_score,
        skill_score=score.skill_score,
        experience_score=score.experience_score,
        education_score=score.education_score,
        profile_score=score.profile_score,
        matched_skills=score.matched_skills,
        missing_skills=score.missing_skills,
        breakdown=_score_breakdown_text(score),
        method=score.method,
    )


def _status_metadata_from_score(score_payload: dict | None) -> tuple[str | None, str | None, str | None]:
    if not score_payload:
        return None, None, None

    recommendation = status_recommender.recommend(ScoreBreakdown(**score_payload))
    return recommendation.status, recommendation.reason, recommendation.fairness_note


def build_resume_record(document: dict) -> ResumeRecord:
    ai_recommended_status, ai_status_reason, ai_fairness_note = _status_metadata_from_score(document.get("ai_score"))
    stored_status = document.get("candidate_status")
    stored_status_source = document.get("status_source")
    final_status = document.get("final_status")
    ml_suggested_status = ai_recommended_status or document.get("ml_suggested_status") or document.get("ai_recommended_status")

    if final_status:
        effective_status = final_status
        effective_status_source = "manual"
    elif stored_status_source == "manual" and stored_status:
        effective_status = stored_status
        effective_status_source = "manual"
    elif ml_suggested_status:
        effective_status = ml_suggested_status
        effective_status_source = "ai"
    elif stored_status:
        effective_status = stored_status
        effective_status_source = stored_status_source or "manual"
    else:
        effective_status = "New"
        effective_status_source = "manual"

    parsed_data = _parsed_data_view(document.get("parsed_data"))
    ai_score = _ai_score_view(document.get("ai_score"))
    candidate_name = document.get("candidate_name") or (parsed_data.name if parsed_data else None)
    created_at = document.get("created_at") or document.get("uploaded_at")
    updated_at = document.get("updated_at") or created_at
    score = ai_score.final_score if ai_score is not None else (
        round(document["predicted_score"] * 100, 2) if document.get("predicted_score") is not None else None
    )
    matched_skills = ai_score.matched_skills if ai_score is not None else []
    missing_skills = ai_score.missing_skills if ai_score is not None else []

    return ResumeRecord(
        id=str(document["_id"]),
        original_filename=document["original_filename"],
        stored_filename=document["stored_filename"],
        file_url=document["file_url"],
        file_size_bytes=document["file_size_bytes"],
        mime_type=document["mime_type"],
        job_id=str(document["job_id"]) if document.get("job_id") else None,
        job_title=document.get("job_title"),
        uploaded_by=document["uploaded_by"],
        uploaded_at=document["uploaded_at"],
        created_at=created_at,
        updated_at=updated_at,
        parse_status=document["parse_status"],
        parse_error=document.get("parse_error"),
        candidate_name=candidate_name,
        score=score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        ml_suggested_status=ml_suggested_status,
        candidate_status=effective_status,
        status_source=effective_status_source,
        final_status=final_status,
        email_status=document.get("email_status"),
        email_error=document.get("email_error"),
        email_sent_at=document.get("email_sent_at"),
        predicted_score=document.get("predicted_score"),
        parsed_data=parsed_data,
        ai_score=ai_score,
        ai_explanation=document.get("ai_explanation"),
        ai_recommended_status=ai_recommended_status or document.get("ai_recommended_status"),
        ai_status_reason=ai_status_reason or document.get("ai_status_reason"),
        ai_fairness_note=ai_fairness_note or document.get("ai_fairness_note"),
    )
