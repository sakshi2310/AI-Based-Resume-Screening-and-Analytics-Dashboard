from __future__ import annotations

import os


def explain_candidate(parsed_resume: dict, job: dict, ai_scores: dict) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        explanation = _gemini_explanation(api_key, parsed_resume, job, ai_scores)
        if explanation:
            return explanation
    return _fallback_explanation(parsed_resume, job, ai_scores)


def _gemini_explanation(api_key: str, parsed_resume: dict, job: dict, scores: dict) -> str | None:
    try:
        import google.generativeai as genai
    except Exception:
        return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(
            _build_prompt(parsed_resume, job, scores),
            generation_config={"temperature": 0.3, "max_output_tokens": 90},
        )
        text = getattr(response, "text", "") or ""
        return " ".join(text.split()).strip() or None
    except Exception:
        return None


def _build_prompt(parsed_resume: dict, job: dict, scores: dict) -> str:
    candidate_name = parsed_resume.get("name") or "The candidate"
    experience_years = parsed_resume.get("experience_years")
    experience_label = f"{experience_years} years" if experience_years is not None else "experience unclear"
    candidate_skills = ", ".join((parsed_resume.get("skills") or [])[:8]) or "not clearly listed"
    job_skills = ", ".join((job.get("skills") or [])[:8]) or "not clearly listed"
    matched = ", ".join((scores.get("matched_skills") or [])[:5]) or "none"
    missing = ", ".join((scores.get("missing_skills") or [])[:5]) or "none"

    return f"""You are a recruiter assistant.
Role: {job.get("title", "Open role")}
Candidate: {candidate_name}
Experience: {experience_label}
Candidate skills: {candidate_skills}
Required skills: {job_skills}
Matched skills: {matched}
Missing skills: {missing}
Final score: {scores.get("final_score", 0):.0f}%

Write exactly 2 plain sentences.
Sentence 1: overall fit and main reason.
Sentence 2: next recruiter action.
No bullets. No markdown. Keep it under 55 words."""


def _fallback_explanation(parsed_resume: dict, job: dict, scores: dict) -> str:
    final_score = float(scores.get("final_score", 0) or 0)
    matched = scores.get("matched_skills") or []
    missing = scores.get("missing_skills") or []
    experience_years = parsed_resume.get("experience_years")
    role = job.get("title", "this role")

    if final_score >= 80:
        fit_label = "strong fit"
        action = "Prioritize this profile for an interview round."
    elif final_score >= 60:
        fit_label = "moderate fit"
        action = "Shortlist for recruiter screening if the missing areas are coachable."
    else:
        fit_label = "limited fit"
        action = "Keep as backup unless the role is open to training or fresher candidates."

    if experience_years is None:
        experience_label = "experience could not be extracted clearly"
    else:
        experience_label = f"{experience_years} years of experience"

    match_label = f"{len(matched)} matched skill(s)"
    if missing:
        gap_label = f"{len(missing)} major gap(s): {', '.join(missing[:3])}"
    else:
        gap_label = "no major skill gaps detected"

    return (
        f"The candidate is a {fit_label} for {role} with {match_label}, {experience_label}, and {gap_label}. "
        f"{action}"
    )
