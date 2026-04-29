from __future__ import annotations

import math
import re
from collections import Counter
from functools import lru_cache

from config.settings import get_settings
from models.job import JobCreate
from models.resume import ParsedResumeData
from models.screening import ScoreBreakdown

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "with",
}

DEGREE_KEYWORDS = {
    "b.tech",
    "bachelor",
    "bachelors",
    "b.e",
    "m.tech",
    "master",
    "masters",
    "mca",
    "bca",
    "bsc",
    "msc",
    "mba",
    "phd",
}

SKILL_SYNONYMS = {
    "nodejs": "node.js",
    "js": "javascript",
    "ts": "typescript",
    "postgres": "postgresql",
    "sklearn": "scikit-learn",
}

FINAL_SCORE_WEIGHTS = {
    "skills": 0.40,
    "experience": 0.30,
    "education": 0.20,
    "profile": 0.10,
}


@lru_cache(maxsize=1)
def _load_embedding_model():
    settings = get_settings()
    if not settings.enable_transformer_similarity:
        return None

    try:
        from sentence_transformers import SentenceTransformer
    except Exception:
        return None

    try:
        return SentenceTransformer(settings.default_embedding_model)
    except Exception:
        return None


class HybridResumeJobScorer:
    def score(self, parsed_resume: ParsedResumeData, job: JobCreate) -> ScoreBreakdown:
        job_text = self._build_job_text(job)
        resume_text = self._build_resume_text(parsed_resume)

        matched_skills, missing_skills, skill_coverage = self._match_skills(job.skills, parsed_resume.normalized_skills)
        skill_semantic_score = self._semantic_score(" ".join(parsed_resume.normalized_skills), " ".join(job.skills))
        skill_score = self._skill_alignment(skill_coverage, skill_semantic_score, len(matched_skills))
        experience_score = self._experience_alignment(parsed_resume.experience_years, job.min_experience_years, job.max_experience_years)
        education_score = self._education_alignment(parsed_resume.education, job.qualifications, job.description)
        semantic_score = self._semantic_score(resume_text, job_text)
        hard_filter_score = self._hard_filter_score(parsed_resume, job)
        profile_score = self._profile_alignment(semantic_score, hard_filter_score)

        strengths: list[str] = []
        risks: list[str] = []

        if matched_skills:
            strengths.append(f"Matched {len(matched_skills)} required skills")
        if parsed_resume.experience_years is not None:
            strengths.append(f"Detected {parsed_resume.experience_years} years of experience")
        else:
            risks.append("Experience duration was not clearly detected")
        if missing_skills:
            risks.append(f"Missing skills: {', '.join(missing_skills[:5])}")
        if parsed_resume.quality_flags:
            risks.append(f"Parsing quality flags: {', '.join(parsed_resume.quality_flags[:3])}")

        final_score = round(
            (skill_score * FINAL_SCORE_WEIGHTS["skills"])
            + (experience_score * FINAL_SCORE_WEIGHTS["experience"])
            + (education_score * FINAL_SCORE_WEIGHTS["education"])
            + (profile_score * FINAL_SCORE_WEIGHTS["profile"]),
            2,
        )

        return ScoreBreakdown(
            final_score=final_score,
            skill_score=round(skill_score, 2),
            experience_score=round(experience_score, 2),
            education_score=round(education_score, 2),
            profile_score=round(profile_score, 2),
            semantic_score=round(semantic_score, 2),
            hard_filter_score=round(hard_filter_score, 2),
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            strengths=strengths,
            risks=risks,
            method=self._score_method(),
        )

    def _build_job_text(self, job: JobCreate) -> str:
        parts = [
            job.title,
            job.department,
            job.description,
            " ".join(job.skills),
            " ".join(job.requirements),
            " ".join(job.responsibilities),
            " ".join(job.qualifications),
        ]
        return " ".join(part for part in parts if part).strip()

    def _build_resume_text(self, parsed_resume: ParsedResumeData) -> str:
        parts = [
            parsed_resume.summary or "",
            " ".join(parsed_resume.skills),
            " ".join(parsed_resume.education),
            parsed_resume.raw_text_excerpt or "",
        ]
        return " ".join(part for part in parts if part).strip()

    def _normalize_text(self, value: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#.\-/ ]+", " ", value.lower())).strip()

    def _tokenize(self, value: str) -> list[str]:
        normalized = self._normalize_text(value)
        return [token for token in normalized.split() if token and token not in STOP_WORDS]

    def _char_ngrams(self, value: str, n: int = 3) -> Counter[str]:
        compact = re.sub(r"\s+", "", self._normalize_text(value))
        if not compact:
            return Counter()
        if len(compact) <= n:
            return Counter({compact: 1})
        return Counter(compact[index : index + n] for index in range(len(compact) - n + 1))

    def _counter_cosine(self, left: Counter[str], right: Counter[str]) -> float:
        if not left or not right:
            return 0.0
        overlap = set(left) & set(right)
        numerator = sum(left[key] * right[key] for key in overlap)
        left_norm = math.sqrt(sum(value * value for value in left.values()))
        right_norm = math.sqrt(sum(value * value for value in right.values()))
        if left_norm == 0.0 or right_norm == 0.0:
            return 0.0
        return numerator / (left_norm * right_norm)

    def _tfidf_cosine(self, text_a: str, text_b: str) -> float:
        tokens_a = self._tokenize(text_a)
        tokens_b = self._tokenize(text_b)
        if not tokens_a or not tokens_b:
            return 0.0

        tf_a = Counter(tokens_a)
        tf_b = Counter(tokens_b)
        vocabulary = set(tf_a) | set(tf_b)
        docs = (set(tf_a), set(tf_b))

        vector_a: dict[str, float] = {}
        vector_b: dict[str, float] = {}
        for term in vocabulary:
            doc_freq = sum(1 for doc in docs if term in doc)
            idf = math.log((1 + len(docs)) / (1 + doc_freq)) + 1.0
            vector_a[term] = tf_a.get(term, 0) * idf
            vector_b[term] = tf_b.get(term, 0) * idf

        numerator = sum(vector_a[term] * vector_b[term] for term in vocabulary)
        norm_a = math.sqrt(sum(value * value for value in vector_a.values()))
        norm_b = math.sqrt(sum(value * value for value in vector_b.values()))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return numerator / (norm_a * norm_b)

    def _embedding_cosine(self, text_a: str, text_b: str) -> float | None:
        model = _load_embedding_model()
        if model is None:
            return None

        try:
            vectors = model.encode([text_a[:2000], text_b[:2000]])
        except Exception:
            return None

        vector_a = [float(value) for value in vectors[0]]
        vector_b = [float(value) for value in vectors[1]]
        numerator = sum(x * y for x, y in zip(vector_a, vector_b))
        norm_a = math.sqrt(sum(x * x for x in vector_a))
        norm_b = math.sqrt(sum(y * y for y in vector_b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return numerator / (norm_a * norm_b)

    def _semantic_score(self, text_a: str, text_b: str) -> float:
        if not text_a.strip() or not text_b.strip():
            return 0.0

        embedding_similarity = self._embedding_cosine(text_a, text_b)
        lexical_similarity = self._tfidf_cosine(text_a, text_b)
        ngram_similarity = self._counter_cosine(self._char_ngrams(text_a), self._char_ngrams(text_b))

        if embedding_similarity is not None:
            similarity = (embedding_similarity * 0.7) + (lexical_similarity * 0.2) + (ngram_similarity * 0.1)
        else:
            similarity = (lexical_similarity * 0.75) + (ngram_similarity * 0.25)

        return max(0.0, min(100.0, similarity * 100.0))

    def _normalize_skill(self, value: str) -> str:
        normalized = re.sub(r"\s+", " ", value.lower()).strip()
        return SKILL_SYNONYMS.get(normalized, normalized)

    def _skill_alignment(self, coverage: float, semantic_score: float, matched_count: int) -> float:
        boost = 0.0
        if coverage >= 85.0:
            boost = 6.0
        elif coverage >= 70.0:
            boost = 4.0
        elif coverage >= 50.0:
            boost = 2.0

        score = (coverage * 0.8) + (semantic_score * 0.2) + boost
        if matched_count == 0:
            score = min(score, 25.0)
        return min(100.0, score)

    def _phrase_match_score(self, left: str, right: str) -> float:
        normalized_left = self._normalize_skill(left)
        normalized_right = self._normalize_skill(right)
        if normalized_left == normalized_right:
            return 1.0
        if normalized_left in normalized_right or normalized_right in normalized_left:
            return 0.9
        token_overlap = self._counter_cosine(Counter(normalized_left.split()), Counter(normalized_right.split()))
        char_overlap = self._counter_cosine(self._char_ngrams(normalized_left), self._char_ngrams(normalized_right))
        return max(token_overlap, char_overlap)

    def _match_skills(self, job_skills: list[str], resume_skills: list[str]) -> tuple[list[str], list[str], float]:
        normalized_resume_skills = [self._normalize_skill(skill) for skill in resume_skills]
        matched: list[str] = []
        missing: list[str] = []

        if not job_skills:
            return matched, missing, 0.0

        for job_skill in job_skills:
            best_match = max((self._phrase_match_score(job_skill, resume_skill) for resume_skill in normalized_resume_skills), default=0.0)
            if best_match >= 0.7:
                matched.append(job_skill)
            else:
                missing.append(job_skill)

        coverage = (len(matched) / len(job_skills)) * 100.0
        return matched, missing, coverage

    def _experience_alignment(self, candidate_years: float | None, min_years: int, max_years: int | None) -> float:
        if candidate_years is None:
            if min_years <= 0:
                return 70.0
            return max(45.0, 72.0 - (min_years * 8.0))
        if candidate_years < min_years:
            gap = min_years - candidate_years
            return max(25.0, 90.0 - (gap * 18.0))
        if max_years is not None and candidate_years > max_years:
            gap = candidate_years - max_years
            return max(55.0, 95.0 - (gap * 5.0))
        return 100.0

    def _education_alignment(self, education: list[str], qualifications: list[str], description: str) -> float:
        education_text = " ".join(education)
        target_text = " ".join(qualifications) or description
        if not education_text.strip():
            return 25.0 if target_text.strip() else 50.0
        semantic = self._semantic_score(education_text, target_text)
        normalized_education = self._normalize_text(education_text)
        normalized_target = self._normalize_text(target_text)
        education_degrees = {keyword for keyword in DEGREE_KEYWORDS if keyword in normalized_education}
        target_degrees = {keyword for keyword in DEGREE_KEYWORDS if keyword in normalized_target}

        degree_bonus = 10.0 if education_degrees else 0.0
        overlap_bonus = 15.0 if education_degrees & target_degrees else 0.0
        base_score = (semantic * 0.75) + degree_bonus + overlap_bonus
        if education_degrees:
            base_score = max(base_score, 55.0)
        return min(100.0, base_score)

    def _hard_filter_score(self, parsed_resume: ParsedResumeData, job: JobCreate) -> float:
        score = 100.0
        if parsed_resume.experience_years is not None and parsed_resume.experience_years + 0.5 < job.min_experience_years:
            score -= 35.0
        if not parsed_resume.skills:
            score -= 20.0
        if parsed_resume.quality_flags:
            score -= min(20.0, len(parsed_resume.quality_flags) * 5.0)
        return max(0.0, score)

    def _profile_alignment(self, semantic_score: float, hard_filter_score: float) -> float:
        return min(100.0, (semantic_score * 0.65) + (hard_filter_score * 0.35))

    def _score_method(self) -> str:
        return "hybrid_transformer_ranker" if _load_embedding_model() is not None else "hybrid_lexical_ranker"
