from __future__ import annotations

from datetime import date
import re

from models.resume import ParsedResumeData

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?)?\d{3,5}[\s\-]?\d{4,6}\b")
EXPERIENCE_PATTERN = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)", re.IGNORECASE)
DATE_RANGE_PATTERN = re.compile(
    r"(?P<start>(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,/-]+\d{4}|\d{1,2}[/-]\d{4}|\d{4})"
    r"\s*(?:to|-|–|—)\s*"
    r"(?P<end>present|current|now|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,/-]+\d{4}|\d{1,2}[/-]\d{4}|\d{4})",
    re.IGNORECASE,
)

MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

SKILL_LEXICON = {
    "python",
    "java",
    "c",
    "c++",
    "c#",
    "r",
    "javascript",
    "typescript",
    "react",
    "node.js",
    "nodejs",
    "fastapi",
    "django",
    "flask",
    "spring boot",
    "sql",
    "mongodb",
    "postgresql",
    "mysql",
    "snowflake",
    "databricks",
    "redis",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "azure data factory",
    "adf",
    "adls",
    "adls gen2",
    "delta lake",
    "event hub",
    "event hubs",
    "jinja",
    "airflow",
    "dbt",
    "apache airflow",
    "apache spark",
    "spark",
    "pyspark",
    "structured streaming",
    "etl",
    "elt",
    "data warehouse",
    "data warehousing",
    "data modeling",
    "medallion architecture",
    "pandas",
    "numpy",
    "excel",
    "power bi",
    "tableau",
    "matplotlib",
    "seaborn",
    "jupyter notebook",
    "scikit-learn",
    "tensorflow",
    "pytorch",
    "machine learning",
    "deep learning",
    "nlp",
    "data analysis",
    "data visualization",
    "statistics",
    "eda",
    "exploratory data analysis",
    "llm",
    "rag",
    "git",
    "github",
}

SKILL_SYNONYMS = {
    "nodejs": "node.js",
    "js": "javascript",
    "ts": "typescript",
    "postgres": "postgresql",
    "sklearn": "scikit-learn",
    "powerbi": "power bi",
    "jupyter": "jupyter notebook",
    "ms excel": "excel",
    "microsoft excel": "excel",
    "py spark": "pyspark",
    "apache air flow": "apache airflow",
    "air flow": "airflow",
    "event hubs": "event hub",
    "adls gen 2": "adls gen2",
    "ml": "machine learning",
    "dl": "deep learning",
    "exploratory data analysis": "eda",
    "structured streaming": "spark structured streaming",
    "apache spark (pyspark": "pyspark",
    "apache spark pyspark": "pyspark",
}

SKILL_SECTION_LABELS = {
    "programming",
    "programming",
    "languages",
    "frameworks & libraries",
    "frameworks and libraries",
    "tools and technologies",
    "tools & technologies",
    "data analysis",
    "data engineering",
    "data visualization",
    "databases",
    "database",
    "big data",
    "cloud",
    "concepts",
    "devops",
    "visualization",
    "data science fundamentals",
    "tools",
    "libraries",
    "frameworks",
    "technologies",
    "technical skills",
    "core skills",
    "skills",
}

SECTION_ALIASES = {
    "summary": "summary",
    "profile": "profile",
    "profile summary": "profile",
    "professional summary": "profile",
    "objective": "objective",
    "about": "profile",
    "about me": "profile",
    "education": "education",
    "experience": "experience",
    "work experience": "work experience",
    "employment history": "employment history",
    "technical skills": "technical skills",
    "technical skill": "technical skills",
    "skills": "skills",
    "core skills": "core skills",
    "soft skill": "soft skills",
    "soft skills": "soft skills",
    "projects": "projects",
    "project": "projects",
    "certification": "certifications",
    "certifications": "certifications",
    "position of responsibility": "position of responsibility",
    "positions of responsibility": "position of responsibility",
}


class ResumeFeatureExtractor:
    def extract(self, text: str) -> ParsedResumeData:
        lines = self._normalize_lines(text)
        sections = self._extract_sections(lines)
        skills = self._extract_skills(text, self._skills_section_text(sections))
        normalized_skills = [self._normalize_skill(skill) for skill in skills]
        education_lines = self._split_bullets(sections.get("education", ""))
        experience_lines = self._split_bullets(sections.get("experience", ""))

        quality_flags: list[str] = []
        if len(text.strip()) < 300:
            quality_flags.append("very_short_resume_text")
        if not skills:
            quality_flags.append("no_skills_detected")
        if not education_lines:
            quality_flags.append("no_education_section_detected")

        return ParsedResumeData(
            name=self._extract_name(lines),
            email=self._first_match(EMAIL_PATTERN, text),
            phone=self._first_match(PHONE_PATTERN, text),
            location=self._extract_location(lines),
            job_titles=self._extract_job_titles(experience_lines),
            companies=self._extract_companies(experience_lines),
            skills=skills,
            normalized_skills=self._dedupe(normalized_skills),
            education=education_lines,
            certifications=self._split_bullets(sections.get("certifications", "")),
            experience_years=self._extract_experience_years(text, sections),
            summary=self._extract_summary(sections),
            sections=sections,
            quality_flags=quality_flags,
            raw_text_excerpt=text[:3000] if text else None,
        )

    def _normalize_lines(self, text: str) -> list[str]:
        return [line.strip() for line in text.splitlines() if line.strip()]

    def _first_match(self, pattern: re.Pattern[str], text: str) -> str | None:
        match = pattern.search(text)
        return match.group(0).strip() if match else None

    def _extract_name(self, lines: list[str]) -> str | None:
        for line in lines[:8]:
            if EMAIL_PATTERN.search(line) or PHONE_PATTERN.search(line):
                continue
            words = [word for word in line.split() if word]
            if 2 <= len(words) <= 4 and all(word.replace(".", "").replace("-", "").isalpha() for word in words):
                return line
        return None

    def _extract_location(self, lines: list[str]) -> str | None:
        location_pattern = re.compile(r"\b[A-Za-z .'-]+,\s*[A-Za-z .'-]+\b")
        for line in lines[:12]:
            if EMAIL_PATTERN.search(line) or PHONE_PATTERN.search(line):
                continue
            match = location_pattern.search(line)
            if match:
                return match.group(0).strip()
        return None

    def _extract_experience_years(self, text: str, sections: dict[str, str]) -> float | None:
        values: list[float] = []
        for match in EXPERIENCE_PATTERN.finditer(text):
            try:
                values.append(float(match.group(1)))
            except ValueError:
                continue
        if values:
            return max(values)

        experience_scope = "\n".join(
            part
            for part in (
                sections.get("experience"),
                sections.get("work experience"),
                sections.get("employment history"),
            )
            if part
        ).strip()
        if not experience_scope:
            return None
        return self._estimate_experience_from_dates(experience_scope)

    def _extract_sections(self, lines: list[str]) -> dict[str, str]:
        sections: dict[str, list[str]] = {}
        current = "header"
        sections[current] = []

        for line in lines:
            normalized_header = self._normalize_section_header(line)
            if normalized_header:
                current = normalized_header
                sections.setdefault(current, [])
                continue
            sections.setdefault(current, []).append(line)

        return {name: "\n".join(values).strip() for name, values in sections.items() if values}

    def _normalize_section_header(self, line: str) -> str | None:
        candidate = re.sub(r"[^a-zA-Z ]+", " ", line).strip().lower()
        candidate = " ".join(candidate.split())
        if not candidate:
            return None

        if candidate in SECTION_ALIASES:
            return SECTION_ALIASES[candidate]

        for alias, normalized in SECTION_ALIASES.items():
            if candidate.startswith(alias):
                return normalized

        return None

    def _skills_section_text(self, sections: dict[str, str]) -> str:
        return "\n".join(
            part
            for part in (
                sections.get("skills"),
                sections.get("technical skills"),
                sections.get("core skills"),
                sections.get("soft skills"),
            )
            if part
        ).strip()

    def _split_bullets(self, value: str) -> list[str]:
        if not value:
            return []
        items: list[str] = []
        for raw_line in value.replace("|", "\n").splitlines():
            for piece in raw_line.split("•"):
                normalized = piece.strip(" -\t")
                if normalized:
                    items.append(normalized)
        return self._dedupe(items)

    def _extract_skills(self, text: str, skills_section: str) -> list[str]:
        detected: list[str] = []
        lowered = text.lower()

        for skill in SKILL_LEXICON:
            if re.search(rf"\b{re.escape(skill)}\b", lowered):
                detected.append(skill)

        detected.extend(self._extract_skills_from_section(skills_section))
        normalized = [self._normalize_skill(skill) for skill in detected if skill.strip()]
        return self._dedupe(normalized)

    def _extract_skills_from_section(self, skills_section: str) -> list[str]:
        if not skills_section:
            return []

        extracted: list[str] = []
        for raw_line in skills_section.replace("|", "\n").splitlines():
            line = raw_line.strip(" -\t")
            if not line:
                continue

            lowered = line.lower().strip(":")
            if lowered in SKILL_SECTION_LABELS:
                continue

            # Handle labeled rows like "Programming: Python, SQL"
            if ":" in line:
                _, line = line.split(":", maxsplit=1)
                line = line.strip()
                if not line:
                    continue

            chunks = re.split(r"[,\u2022;/]+", line)
            for chunk in chunks:
                candidate = chunk.strip(" -\t")
                if not candidate:
                    continue
                normalized = self._normalize_skill(candidate)
                if normalized in SKILL_SECTION_LABELS:
                    continue
                extracted.append(candidate)

        return extracted

    def _normalize_skill(self, value: str) -> str:
        skill = re.sub(r"\s+", " ", value.lower()).strip(" -\t")
        return SKILL_SYNONYMS.get(skill, skill)

    def _extract_summary(self, sections: dict[str, str]) -> str | None:
        for key in ("summary", "objective", "profile"):
            if sections.get(key):
                return sections[key][:700]
        header = sections.get("header")
        return header[:300] if header else None

    def _extract_job_titles(self, experience_lines: list[str]) -> list[str]:
        titles: list[str] = []
        known_markers = ("engineer", "developer", "scientist", "analyst", "manager", "intern", "architect")
        for line in experience_lines[:12]:
            lowered = line.lower()
            if any(marker in lowered for marker in known_markers):
                titles.append(line)
        return self._dedupe(titles[:8])

    def _extract_companies(self, experience_lines: list[str]) -> list[str]:
        companies: list[str] = []
        for line in experience_lines[:12]:
            if " at " in line.lower():
                companies.append(line.split(" at ", maxsplit=1)[-1].strip())
        return self._dedupe(companies[:8])

    def _estimate_experience_from_dates(self, text: str) -> float | None:
        ranges: list[tuple[date, date]] = []
        for match in DATE_RANGE_PATTERN.finditer(text):
            start = self._parse_partial_date(match.group("start"))
            end = self._parse_partial_date(match.group("end"))
            if start is None or end is None or end < start:
                continue
            if (end.year - start.year) > 50:
                continue
            ranges.append((start, end))

        if not ranges:
            return None

        merged: list[tuple[date, date]] = []
        for start, end in sorted(ranges, key=lambda item: item[0]):
            if not merged:
                merged.append((start, end))
                continue

            previous_start, previous_end = merged[-1]
            if (start.year, start.month) <= self._next_month(previous_end):
                if end > previous_end:
                    merged[-1] = (previous_start, end)
                continue
            merged.append((start, end))

        total_months = sum(self._month_span(start, end) for start, end in merged)
        return round(total_months / 12.0, 1) if total_months > 0 else None

    def _parse_partial_date(self, value: str) -> date | None:
        cleaned = re.sub(r"\s+", " ", value.strip().lower().replace(",", " "))
        if cleaned in {"present", "current", "now"}:
            today = date.today()
            return date(today.year, today.month, 1)

        month_year_match = re.fullmatch(r"(\d{1,2})[/-](\d{4})", cleaned)
        if month_year_match:
            month = int(month_year_match.group(1))
            year = int(month_year_match.group(2))
            if 1 <= month <= 12:
                return date(year, month, 1)
            return None

        year_match = re.fullmatch(r"\d{4}", cleaned)
        if year_match:
            return date(int(cleaned), 1, 1)

        named_month_match = re.fullmatch(r"([a-z]+)\s+(\d{4})", cleaned)
        if named_month_match:
            month = MONTHS.get(named_month_match.group(1))
            if month is None:
                return None
            return date(int(named_month_match.group(2)), month, 1)

        return None

    def _next_month(self, value: date) -> tuple[int, int]:
        if value.month == 12:
            return (value.year + 1, 1)
        return (value.year, value.month + 1)

    def _month_span(self, start: date, end: date) -> int:
        return ((end.year - start.year) * 12) + (end.month - start.month) + 1

    def _dedupe(self, values: list[str]) -> list[str]:
        deduped: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = value.strip()
            if not normalized:
                continue
            key = normalized.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(normalized)
        return deduped
