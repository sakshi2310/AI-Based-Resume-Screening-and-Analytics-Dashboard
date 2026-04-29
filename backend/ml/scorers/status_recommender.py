from __future__ import annotations

from pydantic import BaseModel

from models.resume import CandidateStatus
from models.screening import ScoreBreakdown


FAIRNESS_NOTE = (
    "AI recommendation ignores name, email, phone, and location. "
    "It uses only job-match signals such as skills, experience, education, profile quality, and missing JD requirements."
)


class StatusRecommendation(BaseModel):
    status: CandidateStatus
    reason: str
    fairness_note: str = FAIRNESS_NOTE


class ResumeStatusRecommender:
    def recommend(self, score: ScoreBreakdown) -> StatusRecommendation:
        matched_count = len(score.matched_skills)
        missing_count = len(score.missing_skills)

        if score.final_score >= 75.0:
            return StatusRecommendation(
                status="Shortlisted",
                reason=(
                    f"Strong match score ({score.final_score:.0f}%) with {matched_count} matched JD skills "
                    f"and {missing_count} remaining gap(s)."
                ),
            )

        if score.final_score < 65.0:
            return StatusRecommendation(
                status="Rejected",
                reason=(
                    f"Low match score ({score.final_score:.0f}%) with {missing_count} missing JD skills "
                    "and weak overall shortlist readiness."
                ),
            )

        return StatusRecommendation(
            status="Under Review",
            reason=(
                f"Moderate match score ({score.final_score:.0f}%) with {matched_count} matched JD skills. "
                "Recruiter review is recommended before final shortlist or rejection."
            ),
        )
