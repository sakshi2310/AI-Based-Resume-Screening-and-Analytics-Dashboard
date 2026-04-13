from __future__ import annotations

import math
import re
from collections import Counter
from functools import lru_cache


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


@lru_cache(maxsize=1)
def _load_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer
    except Exception:
        return None

    try:
        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#.\-/ ]+", " ", value.lower())).strip()


def _tokenize(value: str) -> list[str]:
    normalized = _normalize_text(value)
    return [token for token in normalized.split() if token and token not in STOP_WORDS]


def _phrase_key(value: str) -> str:
    return " ".join(_tokenize(value))


def _char_ngrams(value: str, n: int = 3) -> Counter[str]:
    compact = re.sub(r"\s+", "", _normalize_text(value))
    if not compact:
        return Counter()
    if len(compact) <= n:
        return Counter({compact: 1})
    return Counter(compact[idx : idx + n] for idx in range(len(compact) - n + 1))


def _counter_cosine(a: Counter[str], b: Counter[str]) -> float:
    if not a or not b:
        return 0.0
    overlap = set(a) & set(b)
    numerator = sum(a[key] * b[key] for key in overlap)
    norm_a = math.sqrt(sum(value * value for value in a.values()))
    norm_b = math.sqrt(sum(value * value for value in b.values()))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return numerator / (norm_a * norm_b)


def _tfidf_cosine(text_a: str, text_b: str) -> float:
    tokens_a = _tokenize(text_a)
    tokens_b = _tokenize(text_b)
    if not tokens_a or not tokens_b:
        return 0.0

    tf_a = Counter(tokens_a)
    tf_b = Counter(tokens_b)
    vocabulary = set(tf_a) | set(tf_b)
    docs = (set(tf_a), set(tf_b))

    vec_a: dict[str, float] = {}
    vec_b: dict[str, float] = {}
    for term in vocabulary:
        doc_freq = sum(1 for doc in docs if term in doc)
        idf = math.log((1 + len(docs)) / (1 + doc_freq)) + 1.0
        vec_a[term] = tf_a.get(term, 0) * idf
        vec_b[term] = tf_b.get(term, 0) * idf

    numerator = sum(vec_a[term] * vec_b[term] for term in vocabulary)
    norm_a = math.sqrt(sum(value * value for value in vec_a.values()))
    norm_b = math.sqrt(sum(value * value for value in vec_b.values()))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return numerator / (norm_a * norm_b)


def _embedding_cosine(text_a: str, text_b: str) -> float | None:
    model = _load_embedding_model()
    if model is None:
        return None

    try:
        vectors = model.encode([text_a[:2000], text_b[:2000]])
    except Exception:
        return None

    a = [float(value) for value in vectors[0]]
    b = [float(value) for value in vectors[1]]
    numerator = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return numerator / (norm_a * norm_b)


def _semantic_score(text_a: str, text_b: str) -> float:
    if not text_a or not text_a.strip() or not text_b or not text_b.strip():
        return 0.0

    embedding_similarity = _embedding_cosine(text_a, text_b)
    lexical_similarity = _tfidf_cosine(text_a, text_b)
    ngram_similarity = _counter_cosine(_char_ngrams(text_a), _char_ngrams(text_b))

    if embedding_similarity is not None:
        similarity = (embedding_similarity * 0.7) + (lexical_similarity * 0.2) + (ngram_similarity * 0.1)
    else:
        similarity = (lexical_similarity * 0.75) + (ngram_similarity * 0.25)

    return round(max(0.0, min(1.0, similarity)) * 100, 2)


def _build_job_text(job: dict) -> str:
    parts = [
        job.get("title", ""),
        job.get("description", ""),
        " ".join(job.get("responsibilities", []) or []),
        " ".join(job.get("requirements", []) or []),
        " ".join(job.get("skills", []) or []),
        " ".join(job.get("qualifications", []) or []),
    ]
    return " ".join(part for part in parts if part).strip()


def _build_resume_text(parsed_resume: dict) -> str:
    parts = [
        parsed_resume.get("summary", ""),
        " ".join(parsed_resume.get("skills") or []),
        " ".join(parsed_resume.get("education") or []),
        parsed_resume.get("raw_text_excerpt", "") or "",
    ]
    return " ".join(part for part in parts if part).strip()


def _phrase_match_score(job_skill: str, resume_skill: str) -> float:
    left = _phrase_key(job_skill)
    right = _phrase_key(resume_skill)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    if left in right or right in left:
        return 0.92

    token_overlap = _counter_cosine(Counter(left.split()), Counter(right.split()))
    char_overlap = _counter_cosine(_char_ngrams(left), _char_ngrams(right))
    return max(token_overlap, char_overlap)


def _match_skills(job_skills: list[str], resume_skills: list[str]) -> tuple[list[str], list[str], float]:
    if not job_skills:
        return [], [], 0.0

    matched: list[str] = []
    missing: list[str] = []

    for job_skill in job_skills:
        best_match = max((_phrase_match_score(job_skill, resume_skill) for resume_skill in resume_skills), default=0.0)
        if best_match >= 0.7:
            matched.append(job_skill)
        else:
            missing.append(job_skill)

    coverage = (len(matched) / len(job_skills)) * 100 if job_skills else 0.0
    return matched, missing, round(coverage, 2)


def _experience_alignment(parsed_resume: dict, job: dict) -> float:
    candidate_years = parsed_resume.get("experience_years")
    if candidate_years is None:
        return 35.0

    min_years = job.get("min_experience_years")
    max_years = job.get("max_experience_years")

    if min_years is None and max_years is None:
        return 70.0
    if min_years is not None and candidate_years < min_years:
        gap = min_years - candidate_years
        return max(15.0, 80.0 - (gap * 20.0))
    if max_years is not None and candidate_years > max_years:
        gap = candidate_years - max_years
        return max(55.0, 95.0 - (gap * 7.5))
    return 100.0


def _education_alignment(parsed_resume: dict, job: dict) -> float:
    education_text = " ".join(parsed_resume.get("education") or [])
    qualification_text = " ".join(job.get("qualifications") or [])
    if not education_text.strip():
        return 20.0 if qualification_text.strip() else 50.0

    semantic = _semantic_score(education_text, qualification_text or job.get("description", ""))
    degrees_found = {_phrase_key(item) for item in DEGREE_KEYWORDS if item in _normalize_text(education_text)}
    bonus = 10.0 if degrees_found else 0.0
    return min(100.0, round((semantic * 0.85) + bonus, 2))


def _profile_alignment(parsed_resume: dict, job: dict, resume_text: str, job_text: str) -> float:
    profile_text = " ".join(
        filter(
            None,
            [
                parsed_resume.get("name") or "",
                parsed_resume.get("location") or "",
                parsed_resume.get("summary") or "",
                resume_text,
            ],
        )
    ).strip()
    return _semantic_score(profile_text, job_text)


def _score_method() -> str:
    return "transformer_hybrid_ml" if _load_embedding_model() is not None else "tfidf_hybrid_ml"


def compute_ai_score(parsed_resume: dict, job: dict) -> dict:
    job_text = _build_job_text(job)
    if not job_text:
        return _zero_score("Job description is empty, so the candidate could not be scored.")

    resume_text = _build_resume_text(parsed_resume)
    job_skills = [skill.strip() for skill in (job.get("skills") or []) if skill and skill.strip()]
    resume_skills = [skill.strip() for skill in (parsed_resume.get("skills") or []) if skill and skill.strip()]

    matched_skills, missing_skills, skill_coverage = _match_skills(job_skills, resume_skills)

    skill_text = " ".join(resume_skills) or resume_text
    job_skill_text = " ".join(job_skills) or job_text
    semantic_skill_score = _semantic_score(skill_text, job_skill_text)
    skill_score = round((semantic_skill_score * 0.7) + (skill_coverage * 0.3), 2)

    experience_text = " ".join(
        filter(
            None,
            [
                f"{parsed_resume.get('experience_years') or 0} years of experience",
                parsed_resume.get("summary") or "",
                resume_text,
            ],
        )
    )
    experience_similarity = _semantic_score(experience_text, job_text)
    experience_range_score = _experience_alignment(parsed_resume, job)
    experience_score = round((experience_similarity * 0.7) + (experience_range_score * 0.3), 2)

    education_score = _education_alignment(parsed_resume, job)
    profile_score = _profile_alignment(parsed_resume, job, resume_text, job_text)

    final_score = round(
        (skill_score * 0.4)
        + (experience_score * 0.25)
        + (education_score * 0.15)
        + (profile_score * 0.2),
        2,
    )

    experience_years = parsed_resume.get("experience_years")
    if experience_years is None:
        experience_label = "experience not clearly extracted"
    else:
        experience_label = f"{experience_years} years detected"

    breakdown = (
        f"Method: {_score_method()} | "
        f"Skills {skill_score:.1f}% (semantic {semantic_skill_score:.1f}%, coverage {skill_coverage:.1f}%) | "
        f"Experience {experience_score:.1f}% ({experience_label}) | "
        f"Education {education_score:.1f}% | "
        f"Profile {profile_score:.1f}%"
    )

    return {
        "final_score": final_score,
        "skill_score": skill_score,
        "experience_score": experience_score,
        "education_score": education_score,
        "profile_score": profile_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "breakdown": breakdown,
        "method": _score_method(),
    }


def _zero_score(reason: str) -> dict:
    return {
        "final_score": 0.0,
        "skill_score": 0.0,
        "experience_score": 0.0,
        "education_score": 0.0,
        "profile_score": 0.0,
        "matched_skills": [],
        "missing_skills": [],
        "breakdown": reason,
        "method": _score_method(),
    }
