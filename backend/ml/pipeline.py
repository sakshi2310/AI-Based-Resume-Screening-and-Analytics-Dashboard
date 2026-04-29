from __future__ import annotations

from models.job import JobCreate
from models.resume import ParsedResumeData
from models.screening import ScoreBreakdown, ScreeningResponse
from ml.extractors.resume_features import ResumeFeatureExtractor
from ml.parsers.document_parser import ResumeDocumentParser
from ml.scorers.explainer import CandidateExplainer
from ml.scorers.hybrid_scorer import HybridResumeJobScorer


class ResumeScreeningPipeline:
    def __init__(self) -> None:
        self.document_parser = ResumeDocumentParser()
        self.feature_extractor = ResumeFeatureExtractor()
        self.scorer = HybridResumeJobScorer()
        self.explainer = CandidateExplainer()

    def parse_resume_bytes(self, file_bytes: bytes, filename: str) -> ParsedResumeData:
        text = self.document_parser.parse_bytes(file_bytes, filename)
        return self.feature_extractor.extract(text)

    def parse_resume_text(self, resume_text: str) -> ParsedResumeData:
        text = self.document_parser.parse_text(resume_text)
        return self.feature_extractor.extract(text)

    def screen_resume_bytes(self, file_bytes: bytes, filename: str, job: JobCreate) -> ScreeningResponse:
        parsed_resume = self.parse_resume_bytes(file_bytes, filename)
        score = self.scorer.score(parsed_resume, job)
        explanation = self.explainer.explain(parsed_resume, job, score)
        return ScreeningResponse(
            job=job,
            parsed_resume=parsed_resume,
            score=score,
            recommendation=self._recommendation(score),
            explanation=explanation,
        )

    def screen_resume_text(self, resume_text: str, job: JobCreate, source_name: str = "inline_resume.txt") -> ScreeningResponse:
        parsed_resume = self.parse_resume_text(resume_text)
        score = self.scorer.score(parsed_resume, job)
        explanation = self.explainer.explain(parsed_resume, job, score)
        return ScreeningResponse(
            job=job,
            parsed_resume=parsed_resume,
            score=score,
            recommendation=self._recommendation(score),
            explanation=explanation,
        )

    def _recommendation(self, score: ScoreBreakdown) -> str:
        if score.final_score >= 70:
            return "Strong shortlist"
        if score.final_score >= 50:
            return "Recruiter review"
        return "Low priority"
