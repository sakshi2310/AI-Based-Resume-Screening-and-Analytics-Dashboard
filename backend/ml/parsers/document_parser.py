from __future__ import annotations

from io import BytesIO
from pathlib import Path

from docx import Document
from pypdf import PdfReader


class ResumeDocumentParser:
    def parse_bytes(self, file_bytes: bytes, filename: str) -> str:
        extension = Path(filename).suffix.lower()

        if extension == ".pdf":
            return self._extract_text_from_pdf(file_bytes)
        if extension == ".docx":
            return self._extract_text_from_docx(file_bytes)
        if extension == ".txt":
            return file_bytes.decode("utf-8", errors="ignore").strip()

        raise ValueError("Unsupported file extension")

    def parse_text(self, text: str) -> str:
        normalized = text.strip()
        if not normalized:
            raise ValueError("Resume text is empty")
        return normalized

    def _extract_text_from_pdf(self, file_bytes: bytes) -> str:
        extracted = self._extract_text_with_pdfplumber(file_bytes)
        if extracted:
            return extracted

        reader = PdfReader(BytesIO(file_bytes))
        text_parts = [page.extract_text() or "" for page in reader.pages]
        return self._normalize_extracted_text("\n".join(text_parts))

    def _extract_text_from_docx(self, file_bytes: bytes) -> str:
        document = Document(BytesIO(file_bytes))
        lines = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
        return "\n".join(lines).strip()

    def _extract_text_with_pdfplumber(self, file_bytes: bytes) -> str:
        try:
            import pdfplumber
        except Exception:
            return ""

        try:
            with pdfplumber.open(BytesIO(file_bytes)) as document:
                pages: list[str] = []
                for page in document.pages:
                    text = page.extract_text(
                        x_tolerance=2,
                        y_tolerance=3,
                        x_density=7.25,
                        y_density=13,
                        layout=False,
                    ) or ""

                    if not text.strip():
                        words = page.extract_words(use_text_flow=True, keep_blank_chars=False)
                        text = "\n".join(word["text"] for word in words if word.get("text"))

                    normalized = self._normalize_extracted_text(text)
                    if normalized:
                        pages.append(normalized)

                return "\n".join(pages).strip()
        except Exception:
            return ""

    def _normalize_extracted_text(self, text: str) -> str:
        lines = [line.strip() for line in text.splitlines()]
        compact: list[str] = []
        for line in lines:
            if not line:
                if compact and compact[-1] != "":
                    compact.append("")
                continue
            compact.append(" ".join(line.split()))

        return "\n".join(line for line in compact if line != "").strip()
