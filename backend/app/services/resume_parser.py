import re
from io import BytesIO

from docx import Document
from pypdf import PdfReader

COMMON_SKILLS = {
    "python",
    "java",
    "javascript",
    "typescript",
    "react",
    "angular",
    "node.js",
    "nodejs",
    "fastapi",
    "django",
    "flask",
    "spring",
    "sql",
    "mongodb",
    "postgresql",
    "mysql",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "git",
    "html",
    "css",
    "c++",
    "c#",
    "machine learning",
    "data analysis",
    "power bi",
    "tableau",
}

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?)?\d{3,5}[\s\-]?\d{4,6}\b")
EXPERIENCE_PATTERN = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)", re.IGNORECASE)

SECTION_HEADERS = {
    "summary",
    "objective",
    "profile",
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "education",
    "skills",
    "technical skills",
    "projects",
    "certifications",
    "achievements",
}


def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts).strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(BytesIO(file_bytes))
    lines = [paragraph.text for paragraph in doc.paragraphs if paragraph.text and paragraph.text.strip()]
    return "\n".join(lines).strip()


def normalize_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def extract_name(lines: list[str]) -> str | None:
    for line in lines[:8]:
        normalized = line.strip()
        if len(normalized) < 3 or len(normalized) > 80:
            continue
        if EMAIL_PATTERN.search(normalized) or PHONE_PATTERN.search(normalized):
            continue
        lowered = normalized.lower()
        if "resume" in lowered or "curriculum vitae" in lowered:
            continue
        words = normalized.split()
        if not 2 <= len(words) <= 4:
            continue
        if all(word.replace(".", "").replace("-", "").isalpha() for word in words):
            return normalized
    return None


def extract_phone(text: str) -> str | None:
    match = PHONE_PATTERN.search(text)
    return match.group(0).strip() if match else None


def extract_email(text: str) -> str | None:
    match = EMAIL_PATTERN.search(text)
    return match.group(0).lower() if match else None


def extract_experience_years(text: str) -> float | None:
    years: list[float] = []
    for match in EXPERIENCE_PATTERN.finditer(text):
        try:
            years.append(float(match.group(1)))
        except ValueError:
            continue
    return max(years) if years else None


def is_section_header(line: str) -> bool:
    return line.lower().strip(":") in SECTION_HEADERS


def extract_section(lines: list[str], target_headers: set[str]) -> list[str]:
    collecting = False
    section_lines: list[str] = []

    for line in lines:
        lowered = line.lower().strip(":")
        if lowered in target_headers:
            collecting = True
            continue
        if collecting and is_section_header(line):
            break
        if collecting:
            section_lines.append(line)
    return section_lines


def split_items(lines: list[str]) -> list[str]:
    items: list[str] = []
    for line in lines:
        normalized = line.replace("|", ",").replace(";", ",")
        for part in normalized.split(","):
            item = part.strip(" -\t")
            if item:
                items.append(item)
    deduped: list[str] = []
    seen: set[str] = set()
    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped


def extract_skills(lines: list[str], text: str) -> list[str]:
    skills_lines = extract_section(lines, {"skills", "technical skills"})
    parsed_skills = split_items(skills_lines)

    lowered_text = text.lower()
    for skill in COMMON_SKILLS:
        if re.search(rf"\b{re.escape(skill)}\b", lowered_text):
            parsed_skills.append(skill)

    unique_skills: list[str] = []
    seen: set[str] = set()
    for skill in parsed_skills:
        key = skill.lower()
        if key not in seen:
            seen.add(key)
            unique_skills.append(skill)
    return unique_skills[:50]


def extract_education(lines: list[str]) -> list[str]:
    education_lines = extract_section(lines, {"education"})
    return education_lines[:10]


def extract_summary(lines: list[str]) -> str | None:
    summary_lines = extract_section(lines, {"summary", "objective", "profile"})
    if not summary_lines:
        return None
    return " ".join(summary_lines)[:500]


def extract_location(lines: list[str]) -> str | None:
    location_pattern = re.compile(r"\b[A-Za-z .'-]+,\s*[A-Za-z .'-]+\b")
    for line in lines[:12]:
        if EMAIL_PATTERN.search(line) or PHONE_PATTERN.search(line):
            continue
        match = location_pattern.search(line)
        if match:
            return match.group(0).strip()
    return None


def parse_resume(file_bytes: bytes, extension: str) -> dict:
    ext = extension.lower()
    if ext == ".pdf":
        text = extract_text_from_pdf(file_bytes)
    elif ext == ".docx":
        text = extract_text_from_docx(file_bytes)
    else:
        raise ValueError("Unsupported file extension for parsing")

    lines = normalize_lines(text)
    parsed = {
        "name": extract_name(lines),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "location": extract_location(lines),
        "skills": extract_skills(lines, text),
        "education": extract_education(lines),
        "experience_years": extract_experience_years(text),
        "summary": extract_summary(lines),
        "raw_text_excerpt": text[:2500] if text else None,
    }
    return parsed
