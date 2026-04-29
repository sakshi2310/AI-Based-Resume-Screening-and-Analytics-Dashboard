from __future__ import annotations

from config.settings import get_settings
from models.job import JobCreate
from models.resume import ParsedResumeData
from models.screening import ScoreBreakdown


class CandidateExplainer:
    def explain(self, parsed_resume: ParsedResumeData, job: JobCreate, score: ScoreBreakdown) -> str:
        settings = get_settings()
        if settings.enable_llm_explanations and settings.llm_api_key:
            generated = self._llm_explanation(parsed_resume, job, score)
            if generated:
                return generated
        return self._fallback_explanation(parsed_resume, job, score)

    def _llm_explanation(
        self,
        parsed_resume: ParsedResumeData,
        job: JobCreate,
        score: ScoreBreakdown,
    ) -> str | None:
        settings = get_settings()
        if settings.llm_provider.lower() == "gemini":
            return self._gemini_explanation(parsed_resume, job, score)
        if settings.llm_provider.lower() == "openai":
            return self._openai_explanation(parsed_resume, job, score)
        return None

    def _gemini_explanation(
        self,
        parsed_resume: ParsedResumeData,
        job: JobCreate,
        score: ScoreBreakdown,
    ) -> str | None:
        try:
            import google.generativeai as genai
        except Exception:
            return None

        settings = get_settings()
        try:
            genai.configure(api_key=settings.llm_api_key)
            model = genai.GenerativeModel(settings.llm_model)
            response = model.generate_content(
                self._prompt(parsed_resume, job, score),
                generation_config={"temperature": 0.2, "max_output_tokens": 120},
            )
            text = getattr(response, "text", "") or ""
            cleaned = " ".join(text.split()).strip()
            return cleaned or None
        except Exception:
            return None

    def _openai_explanation(
        self,
        parsed_resume: ParsedResumeData,
        job: JobCreate,
        score: ScoreBreakdown,
    ) -> str | None:
        try:
            from openai import OpenAI
        except Exception:
            return None

        settings = get_settings()
        try:
            client = OpenAI(api_key=settings.llm_api_key)
            response = client.responses.create(
                model=settings.llm_model,
                input=self._prompt(parsed_resume, job, score),
            )
            text = getattr(response, "output_text", "") or ""
            cleaned = " ".join(text.split()).strip()
            return cleaned or None
        except Exception:
            return None

    def _prompt(self, parsed_resume: ParsedResumeData, job: JobCreate, score: ScoreBreakdown) -> str:
        return (
            f"Role: {job.title}\n"
            f"Candidate: {parsed_resume.name or 'Unknown candidate'}\n"
            f"Experience years: {parsed_resume.experience_years or 'unknown'}\n"
            f"Matched skills: {', '.join(score.matched_skills[:8]) or 'none'}\n"
            f"Missing skills: {', '.join(score.missing_skills[:8]) or 'none'}\n"
            f"Final score: {score.final_score}\n"
            "Write exactly two plain sentences. "
            "Sentence one should summarize fit. Sentence two should give the next recruiter action."
        )

    def _fallback_explanation(self, parsed_resume: ParsedResumeData, job: JobCreate, score: ScoreBreakdown) -> str:
        fit = "strong" if score.final_score >= 70 else "moderate" if score.final_score >= 50 else "limited"
        matched = ", ".join(score.matched_skills[:4]) or "no high-confidence matches"
        missing = ", ".join(score.missing_skills[:3]) or "no major gaps"
        years = parsed_resume.experience_years if parsed_resume.experience_years is not None else "unclear"
        return (
            f"The candidate shows a {fit} fit for {job.title} with {years} years of detected experience, "
            f"matched skills such as {matched}, and gaps including {missing}. "
            f"Use the score as a ranking aid and confirm the missing items during recruiter review."
        )
