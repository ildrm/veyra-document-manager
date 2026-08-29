"""Deterministic, local document extraction.

Document bytes and text are untrusted input. This module performs no dynamic
evaluation, template rendering, URL fetching, or model prompting.
"""

from __future__ import annotations

import hashlib
import io
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import PurePath
from typing import Final

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from knowledge_ai_service.config import Settings
from knowledge_ai_service.errors import ServiceError
from knowledge_ai_service.models import (
    ContentSecuritySignal,
    DocumentInfo,
    ExtractedClaim,
    ExtractedEntity,
    ExtractedMetadata,
    ExtractionResponse,
    NormalizedChunk,
    NormalizedPage,
    PiiSignal,
)

PDF_MEDIA_TYPE: Final = "application/pdf"
TEXT_MEDIA_TYPES: Final = frozenset({"text/plain", "text/markdown", "text/csv"})
TEXT_EXTENSIONS: Final = frozenset({".txt", ".md", ".markdown", ".csv"})

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HORIZONTAL_SPACE = re.compile(r"[^\S\n]+")
_EXCESS_NEWLINES = re.compile(r"\n{3,}")
_SENTENCE_BOUNDARY = re.compile(r"(?:\n+|(?:(?<!\d)\.|\.(?!\d)|[!?]+)(?=\s|$))")

_EMAIL = re.compile(r"(?<![\w.+-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![\w.-])", re.I)
_PHONE = re.compile(
    r"(?<!\w)(?:\+?[1-9]\d{0,2}[ .-]?)?"
    r"(?:\(?\d{2,4}\)?[ .-]?)\d{3}[ .-]\d{4}(?!\w)"
)
_IBAN = re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b", re.I)
_SSN = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
_CARD = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")
_MONEY = re.compile(
    r"(?<!\w)(?:USD|EUR|GBP|CAD|AUD|\$|€|£)\s?\d[\d,]*(?:\.\d{1,2})?",
    re.I,
)
_DATE = re.compile(
    r"\b(?:"
    r"\d{4}[-/]\d{1,2}[-/]\d{1,2}"
    r"|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}"
    r"|(?:January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2},?\s+\d{4}"
    r")\b",
    re.I,
)
_CUSTOMER = re.compile(r"(?im)^\s*(?:customer|client)\s*:\s*([^\n]{2,120})$")
_BETWEEN_PARTIES = re.compile(
    r"(?is)\bbetween\s+([A-Z][\w&.,'\u2019 -]{1,100}?)\s+and\s+"
    r"([A-Z][\w&.,'\u2019 -]{1,100}?)(?:\s*[,.]|\s+(?:dated|effective|whereas)\b)",
)
_EFFECTIVE_DATE = re.compile(
    r"(?i)\beffective(?:\s+date|\s+as\s+of)?\s*[:\-]?\s*(" + _DATE.pattern + r")"
)
_EXPIRATION_DATE = re.compile(
    r"(?i)\b(?:expiration|expiry|termination)\s+date\s*[:\-]?\s*(" + _DATE.pattern + r")"
)

_INJECTION_LANGUAGE = re.compile(
    r"(?i)(?:"
    r"ignore\s+(?:all\s+)?(?:previous|prior|above|system)\s+instructions?"
    r"|reveal\s+(?:the\s+)?system\s+prompt"
    r"|(?:system|developer)\s+message\s*:"
    r"|you\s+are\s+(?:chatgpt|an?\s+ai|the\s+assistant)"
    r"|answer\s+(?:only\s+)?with"
    r"|do\s+not\s+(?:cite|follow)"
    r"|<\/?(?:system|assistant|developer)>"
    r"|\[/?INST\]"
    r")"
)

_SLA_VALUE_FIRST = re.compile(
    r"(?i)\b(?P<value>\d{1,3}(?:\.\d{1,6})?)\s*%"
    r"(?:\s+(?:monthly|per\s+month|in\s+each\s+calendar\s+month))?"
    r"(?:\s+(?:service\s+)?)?(?:uptime|availability)\b"
)
_SLA_TERM_FIRST = re.compile(
    r"(?i)\b(?:uptime|availability)(?:\s+(?:commitment|target|level|of|shall\s+be|is))?"
    r"[^.;!?\n]{0,64}?\b(?P<value>\d{1,3}(?:\.\d{1,6})?)\s*%"
    r"(?:\s*(?:,?\s*measured)?\s*(?:monthly|per\s+month|in\s+each\s+calendar\s+month))?"
)


@dataclass(frozen=True, slots=True)
class ExtractionInput:
    content: bytes
    filename: str
    declared_media_type: str | None
    document_id: str | None = None
    document_version_id: str | None = None


@dataclass(frozen=True, slots=True)
class SlaMatch:
    value: str
    period: str | None
    evidence: str
    start_offset: int
    end_offset: int


def sha256_hex(value: bytes | str) -> str:
    data = value.encode("utf-8") if isinstance(value, str) else value
    return hashlib.sha256(data).hexdigest()


def normalize_text(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = unicodedata.normalize("NFKC", value)
    value = _CONTROL_CHARACTERS.sub("", value)
    value = _HORIZONTAL_SPACE.sub(" ", value)
    value = "\n".join(line.rstrip() for line in value.split("\n"))
    return _EXCESS_NEWLINES.sub("\n\n", value).strip()


def _clean_media_type(media_type: str | None) -> str | None:
    if not media_type:
        return None
    return media_type.split(";", 1)[0].strip().lower() or None


def _resolve_media_type(item: ExtractionInput) -> str:
    declared = _clean_media_type(item.declared_media_type)
    suffix = PurePath(item.filename).suffix.lower()
    is_pdf = item.content.startswith(b"%PDF-")

    if is_pdf:
        if declared in TEXT_MEDIA_TYPES:
            raise ServiceError(
                status_code=415,
                code="MIME_SIGNATURE_MISMATCH",
                message="The declared text media type does not match the PDF signature.",
            )
        return PDF_MEDIA_TYPE

    if declared == PDF_MEDIA_TYPE or suffix == ".pdf":
        raise ServiceError(
            status_code=415,
            code="INVALID_PDF_SIGNATURE",
            message="A PDF upload must begin with a valid PDF signature.",
        )

    if declared in TEXT_MEDIA_TYPES:
        return declared
    if declared in {None, "application/octet-stream"} and suffix in TEXT_EXTENSIONS:
        return "text/markdown" if suffix in {".md", ".markdown"} else "text/plain"
    raise ServiceError(
        status_code=415,
        code="UNSUPPORTED_MEDIA_TYPE",
        message="Only PDF, plain text, Markdown, and CSV documents are supported.",
        details=[{"declared_media_type": declared or "missing"}],
    )


def _extract_pdf_pages(content: bytes, max_pages: int) -> tuple[list[str], list[str]]:
    try:
        reader = PdfReader(io.BytesIO(content), strict=False)
    except (PdfReadError, ValueError, TypeError) as exc:
        raise ServiceError(
            status_code=422,
            code="PDF_EXTRACTION_FAILED",
            message="The PDF could not be parsed safely.",
        ) from exc

    if reader.is_encrypted:
        try:
            decrypted = reader.decrypt("")
        except Exception as exc:  # pypdf backends expose several encryption errors
            raise ServiceError(
                status_code=422,
                code="ENCRYPTED_PDF_UNSUPPORTED",
                message="Password-protected PDF files cannot be extracted.",
            ) from exc
        if not decrypted:
            raise ServiceError(
                status_code=422,
                code="ENCRYPTED_PDF_UNSUPPORTED",
                message="Password-protected PDF files cannot be extracted.",
            )

    if not reader.pages:
        raise ServiceError(
            status_code=422,
            code="PDF_HAS_NO_PAGES",
            message="The PDF does not contain any pages.",
        )
    if len(reader.pages) > max_pages:
        raise ServiceError(
            status_code=413,
            code="PDF_PAGE_LIMIT_EXCEEDED",
            message=f"PDF documents may contain at most {max_pages} pages.",
        )

    pages: list[str] = []
    warnings: list[str] = []
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as exc:  # isolate a malformed content stream to a typed error
            raise ServiceError(
                status_code=422,
                code="PDF_PAGE_EXTRACTION_FAILED",
                message=f"Text extraction failed for PDF page {page_number}.",
            ) from exc
        normalized = normalize_text(text)
        pages.append(normalized)
        if not normalized:
            warnings.append(f"page_{page_number}_requires_ocr")
    return pages, warnings


def _extract_text_pages(content: bytes) -> list[str]:
    if b"\x00" in content:
        raise ServiceError(
            status_code=415,
            code="BINARY_CONTENT_REJECTED",
            message="The text upload contains binary null bytes.",
        )
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ServiceError(
            status_code=415,
            code="TEXT_ENCODING_UNSUPPORTED",
            message="Text uploads must use UTF-8 encoding.",
        ) from exc
    pages = [normalize_text(page) for page in text.split("\f")]
    if not any(pages):
        raise ServiceError(
            status_code=422,
            code="EMPTY_DOCUMENT_TEXT",
            message="The document contains no extractable text.",
        )
    return pages


def _build_pages(page_texts: list[str]) -> tuple[str, list[NormalizedPage]]:
    normalized_parts: list[str] = []
    pages: list[NormalizedPage] = []
    current_offset = 0
    for index, page_text in enumerate(page_texts):
        if index:
            normalized_parts.append("\n\n")
            current_offset += 2
        start = current_offset
        normalized_parts.append(page_text)
        current_offset += len(page_text)
        pages.append(
            NormalizedPage(
                page_number=index + 1,
                text=page_text,
                start_offset=start,
                end_offset=current_offset,
            )
        )
    return "".join(normalized_parts), pages


def _preferred_boundary(text: str, start: int, target: int) -> int:
    minimum = start + max(1, int((target - start) * 0.6))
    for marker in ("\n\n", "\n", ". ", "; ", " "):
        boundary = text.rfind(marker, minimum, target)
        if boundary >= minimum:
            return boundary + (1 if marker in {". ", "; ", " "} else len(marker))
    return target


def _build_chunks(
    pages: Iterable[NormalizedPage],
    document_sha256: str,
    chunk_size: int,
    overlap: int,
) -> list[NormalizedChunk]:
    chunks: list[NormalizedChunk] = []
    for page in pages:
        local_start = 0
        while local_start < len(page.text):
            while local_start < len(page.text) and page.text[local_start].isspace():
                local_start += 1
            if local_start >= len(page.text):
                break
            target = min(len(page.text), local_start + chunk_size)
            local_end = (
                target
                if target == len(page.text)
                else _preferred_boundary(page.text, local_start, target)
            )
            while local_end > local_start and page.text[local_end - 1].isspace():
                local_end -= 1
            chunk_text = page.text[local_start:local_end]
            start_offset = page.start_offset + local_start
            end_offset = page.start_offset + local_end
            identity = f"{document_sha256}:{start_offset}:{end_offset}:{chunk_text}"
            chunks.append(
                NormalizedChunk(
                    chunk_id=f"chk_{sha256_hex(identity)[:24]}",
                    text=chunk_text,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    page_numbers=[page.page_number],
                    sha256=sha256_hex(chunk_text),
                )
            )
            if local_end == len(page.text):
                break
            next_start = max(local_start + 1, local_end - overlap)
            local_start = next_start
    return chunks


def page_for_offset(pages: list[NormalizedPage], offset: int) -> int:
    for page in pages:
        if page.start_offset <= offset <= page.end_offset:
            return page.page_number
    return pages[-1].page_number


def contains_prompt_injection_language(value: str) -> bool:
    return _INJECTION_LANGUAGE.search(value) is not None


def iter_sentences(value: str) -> Iterable[tuple[int, int, str]]:
    start = 0
    for boundary in _SENTENCE_BOUNDARY.finditer(value):
        end = boundary.end()
        raw = value[start:end]
        leading = len(raw) - len(raw.lstrip())
        trailing = len(raw) - len(raw.rstrip())
        sentence_start = start + leading
        sentence_end = end - trailing
        if sentence_end > sentence_start:
            yield sentence_start, sentence_end, value[sentence_start:sentence_end]
        start = end
    if start < len(value):
        raw = value[start:]
        leading = len(raw) - len(raw.lstrip())
        trailing = len(raw) - len(raw.rstrip())
        sentence_start = start + leading
        sentence_end = len(value) - trailing
        if sentence_end > sentence_start:
            yield sentence_start, sentence_end, value[sentence_start:sentence_end]


def extract_sla_matches(value: str, base_offset: int = 0) -> list[SlaMatch]:
    """Extract uptime claims without interpreting imperative document content."""

    results: list[SlaMatch] = []
    seen: set[tuple[int, int, str]] = set()
    for sentence_start, _, sentence in iter_sentences(value):
        if contains_prompt_injection_language(sentence):
            continue
        for pattern in (_SLA_VALUE_FIRST, _SLA_TERM_FIRST):
            for match in pattern.finditer(sentence):
                start = base_offset + sentence_start + match.start()
                end = base_offset + sentence_start + match.end()
                key = (start, end, match.group("value"))
                if key in seen:
                    continue
                seen.add(key)
                evidence = match.group(0)
                period = "month" if re.search(r"(?i)month|monthly", sentence) else None
                results.append(
                    SlaMatch(
                        value=match.group("value"),
                        period=period,
                        evidence=evidence,
                        start_offset=start,
                        end_offset=end,
                    )
                )
    return sorted(results, key=lambda item: (item.start_offset, item.end_offset))


def _stable_id(prefix: str, *parts: object) -> str:
    return f"{prefix}_{sha256_hex(':'.join(str(part) for part in parts))[:24]}"


def _entities(text: str, pages: list[NormalizedPage]) -> list[ExtractedEntity]:
    candidates: list[tuple[str, re.Match[str], float]] = []
    for entity_type, pattern, confidence in (
        ("EMAIL_ADDRESS", _EMAIL, 0.99),
        ("MONEY", _MONEY, 0.98),
        ("DATE", _DATE, 0.92),
    ):
        candidates.extend((entity_type, match, confidence) for match in pattern.finditer(text))

    for match in _CUSTOMER.finditer(text):
        candidates.append(("ORGANIZATION", match, 0.86))

    entities: list[ExtractedEntity] = []
    seen: set[tuple[str, int, int]] = set()
    for entity_type, match, confidence in candidates:
        if entity_type == "ORGANIZATION":
            raw = match.group(1).strip().rstrip(".,;")
            raw_start = match.start(1) + len(match.group(1)) - len(match.group(1).lstrip())
            raw_end = raw_start + len(raw)
        else:
            raw = match.group(0)
            raw_start = match.start()
            raw_end = match.end()
        key = (entity_type, raw_start, raw_end)
        if key in seen:
            continue
        seen.add(key)
        normalized = raw.casefold() if entity_type in {"EMAIL_ADDRESS", "ORGANIZATION"} else raw
        entities.append(
            ExtractedEntity(
                entity_id=_stable_id("ent", entity_type, raw_start, raw_end, normalized),
                entity_type=entity_type,
                value=raw,
                normalized_value=normalized,
                start_offset=raw_start,
                end_offset=raw_end,
                page_number=page_for_offset(pages, raw_start),
                confidence=confidence,
            )
        )
    return sorted(entities, key=lambda item: (item.start_offset, item.entity_type))


def _redact(value: str) -> str:
    if "@" in value:
        local, _, domain = value.partition("@")
        return f"{local[:1]}***@{domain[:1]}***"
    digits = "".join(character for character in value if character.isdigit())
    suffix = digits[-4:] if len(digits) >= 4 else "****"
    return f"***{suffix}"


def _luhn_valid(value: str) -> bool:
    digits = [int(character) for character in value if character.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        if index % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


def _pii_signals(text: str, pages: list[NormalizedPage]) -> list[PiiSignal]:
    candidates: list[tuple[str, re.Match[str], float]] = []
    for category, pattern, confidence in (
        ("email_address", _EMAIL, 0.99),
        ("phone_number", _PHONE, 0.82),
        ("iban", _IBAN, 0.98),
        ("us_social_security_number", _SSN, 0.98),
    ):
        candidates.extend((category, match, confidence) for match in pattern.finditer(text))
    candidates.extend(
        ("payment_card_number", match, 0.96)
        for match in _CARD.finditer(text)
        if _luhn_valid(match.group(0))
    )

    signals: list[PiiSignal] = []
    seen: set[tuple[str, int, int]] = set()
    for category, match, confidence in candidates:
        key = (category, match.start(), match.end())
        if key in seen:
            continue
        seen.add(key)
        signals.append(
            PiiSignal(
                signal_id=_stable_id("pii", category, match.start(), match.end()),
                category=category,
                redacted_preview=_redact(match.group(0)),
                start_offset=match.start(),
                end_offset=match.end(),
                page_number=page_for_offset(pages, match.start()),
                confidence=confidence,
            )
        )
    return sorted(signals, key=lambda item: (item.start_offset, item.category))


def _security_signals(text: str, pages: list[NormalizedPage]) -> list[ContentSecuritySignal]:
    return [
        ContentSecuritySignal(
            signal_type="prompt_injection_language",
            start_offset=match.start(),
            end_offset=match.end(),
            page_number=page_for_offset(pages, match.start()),
        )
        for match in _INJECTION_LANGUAGE.finditer(text)
    ]


def _metadata(text: str, filename: str) -> ExtractedMetadata:
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), None)
    title = first_line[:240] if first_line else PurePath(filename).stem
    contract_terms = re.search(
        r"(?i)\b(?:agreement|contract|service level|master services|statement of work)\b",
        text,
    )
    document_type = "contract" if contract_terms else "document"
    effective = _EFFECTIVE_DATE.search(text)
    expiration = _EXPIRATION_DATE.search(text)
    customer = _CUSTOMER.search(text)
    parties_match = _BETWEEN_PARTIES.search(text)
    parties: list[str] = []
    if parties_match:
        parties = [
            parties_match.group(1).strip().rstrip(".,;"),
            parties_match.group(2).strip().rstrip(".,;"),
        ]
    customer_value = customer.group(1).strip().rstrip(".,;") if customer else None
    if customer_value and customer_value not in parties:
        parties.append(customer_value)

    if re.search(r"[\u0600-\u06ff]", text):
        language = "fa"
    elif re.search(r"(?i)\b(?:the|and|this|agreement|service)\b", text):
        language = "en"
    else:
        language = "und"

    return ExtractedMetadata(
        title=title,
        document_type=document_type,
        language=language,
        effective_date=effective.group(1) if effective else None,
        expiration_date=expiration.group(1) if expiration else None,
        parties=parties,
        customer=customer_value,
    )


def _claims(text: str, pages: list[NormalizedPage]) -> list[ExtractedClaim]:
    claims: list[ExtractedClaim] = []
    for match in extract_sla_matches(text):
        claims.append(
            ExtractedClaim(
                claim_id=_stable_id("clm", "uptime_commitment", match.start_offset, match.value),
                claim_type="service_level",
                predicate="uptime_commitment",
                value=match.value,
                unit="percent",
                period=match.period,
                evidence=match.evidence,
                start_offset=match.start_offset,
                end_offset=match.end_offset,
                page_number=page_for_offset(pages, match.start_offset),
                confidence=0.98 if match.period else 0.92,
                extraction_method="deterministic_pattern_v1",
            )
        )
    return claims


def extract_document(
    item: ExtractionInput,
    settings: Settings,
    correlation_id: str,
) -> ExtractionResponse:
    if not item.content:
        raise ServiceError(
            status_code=422,
            code="EMPTY_DOCUMENT",
            message="The uploaded document is empty.",
        )
    if len(item.content) > settings.max_upload_bytes:
        raise ServiceError(
            status_code=413,
            code="UPLOAD_TOO_LARGE",
            message=f"Documents may be at most {settings.max_upload_bytes} bytes.",
        )

    media_type = _resolve_media_type(item)
    if media_type == PDF_MEDIA_TYPE:
        page_texts, warnings = _extract_pdf_pages(item.content, settings.max_pdf_pages)
    else:
        page_texts = _extract_text_pages(item.content)
        warnings = []

    normalized_text_value, pages = _build_pages(page_texts)
    document_hash = sha256_hex(item.content)
    normalized_hash = sha256_hex(normalized_text_value)
    chunks = _build_chunks(
        pages,
        document_hash,
        settings.chunk_size,
        settings.chunk_overlap,
    )
    if not chunks:
        warnings.append("document_requires_ocr")

    return ExtractionResponse(
        correlation_id=correlation_id,
        document=DocumentInfo(
            document_id=item.document_id,
            document_version_id=item.document_version_id,
            filename=item.filename,
            media_type=media_type,
            size_bytes=len(item.content),
            sha256=document_hash,
            normalized_text_sha256=normalized_hash,
            page_count=len(pages),
            character_count=len(normalized_text_value),
        ),
        normalized_text=normalized_text_value,
        pages=pages,
        chunks=chunks,
        metadata=_metadata(normalized_text_value, item.filename),
        entities=_entities(normalized_text_value, pages),
        claims=_claims(normalized_text_value, pages),
        pii_signals=_pii_signals(normalized_text_value, pages),
        content_security_signals=_security_signals(normalized_text_value, pages),
        warnings=sorted(set(warnings)),
    )
