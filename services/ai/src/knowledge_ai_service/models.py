"""Public API and provider-neutral domain models."""

from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

Identifier = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=256),
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IngestionTextRequest(StrictModel):
    text: str = Field(min_length=1)
    filename: str = Field(default="inline.txt", min_length=1, max_length=255)
    media_type: Literal["text/plain", "text/markdown", "text/csv"] = "text/plain"
    document_id: Identifier | None = None
    document_version_id: Identifier | None = None


class DocumentInfo(StrictModel):
    document_id: str | None = None
    document_version_id: str | None = None
    filename: str
    media_type: str
    size_bytes: int = Field(ge=0)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    normalized_text_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    page_count: int = Field(ge=1)
    character_count: int = Field(ge=0)


class NormalizedPage(StrictModel):
    page_number: int = Field(ge=1)
    text: str
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=0)


class NormalizedChunk(StrictModel):
    chunk_id: str
    text: str
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    page_numbers: list[int] = Field(min_length=1)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class ExtractedMetadata(StrictModel):
    title: str | None = None
    document_type: str
    language: str = "und"
    effective_date: str | None = None
    expiration_date: str | None = None
    parties: list[str] = Field(default_factory=list)
    customer: str | None = None


class ExtractedEntity(StrictModel):
    entity_id: str
    entity_type: str
    value: str
    normalized_value: str
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    page_number: int = Field(ge=1)
    confidence: float = Field(ge=0, le=1)


class ExtractedClaim(StrictModel):
    claim_id: str
    claim_type: str
    subject: str | None = None
    predicate: str
    value: str
    unit: str | None = None
    period: str | None = None
    evidence: str
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    page_number: int = Field(ge=1)
    confidence: float = Field(ge=0, le=1)
    extraction_method: str


class PiiSignal(StrictModel):
    signal_id: str
    category: str
    redacted_preview: str
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    page_number: int = Field(ge=1)
    confidence: float = Field(ge=0, le=1)


class ContentSecuritySignal(StrictModel):
    signal_type: Literal["prompt_injection_language"]
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    page_number: int = Field(ge=1)
    action: Literal["treated_as_untrusted_content"] = "treated_as_untrusted_content"


class ExtractionResponse(StrictModel):
    schema_version: Literal["1.0"] = "1.0"
    correlation_id: str
    document: DocumentInfo
    normalized_text: str
    pages: list[NormalizedPage]
    chunks: list[NormalizedChunk]
    metadata: ExtractedMetadata
    entities: list[ExtractedEntity]
    claims: list[ExtractedClaim]
    pii_signals: list[PiiSignal]
    content_security_signals: list[ContentSecuritySignal]
    warnings: list[str] = Field(default_factory=list)


class EvidenceAuthority(StrEnum):
    UNKNOWN = "unknown"
    DRAFT = "draft"
    PUBLISHED = "published"
    REVIEWED = "reviewed"
    APPROVED_POLICY = "approved_policy"
    SIGNED_CONTRACT = "signed_contract"
    REGULATED_RECORD = "regulated_record"


class AuthorizedEvidenceChunk(StrictModel):
    """An evidence chunk already authorized by the upstream policy gateway."""

    chunk_id: Identifier
    document_id: Identifier
    document_version_id: Identifier
    document_title: str = Field(min_length=1, max_length=512)
    text: str = Field(min_length=1, max_length=100_000)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    page_number: int = Field(ge=1)
    section: str | None = Field(default=None, max_length=512)
    authority: EvidenceAuthority = EvidenceAuthority.UNKNOWN
    effective_from: date | None = None
    effective_to: date | None = None
    authorized: Literal[True]
    authorization_decision_id: Identifier

    @model_validator(mode="after")
    def validate_offsets(self) -> AuthorizedEvidenceChunk:
        if self.end_offset - self.start_offset != len(self.text):
            raise ValueError("end_offset - start_offset must equal the evidence text length")
        if self.effective_to and self.effective_from and self.effective_to < self.effective_from:
            raise ValueError("effective_to must not precede effective_from")
        return self


class GroundedAnswerRequest(StrictModel):
    question: str = Field(min_length=1, max_length=2_000)
    evidence: list[AuthorizedEvidenceChunk] = Field(min_length=1)

    @model_validator(mode="after")
    def require_unique_chunks(self) -> GroundedAnswerRequest:
        chunk_ids = [chunk.chunk_id for chunk in self.evidence]
        if len(chunk_ids) != len(set(chunk_ids)):
            raise ValueError("evidence chunk_id values must be unique")
        return self


class AnswerStatus(StrEnum):
    ANSWERED = "answered"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class EvidenceCitation(StrictModel):
    chunk_id: str
    document_id: str
    document_version_id: str
    document_title: str
    page_number: int = Field(ge=1)
    section: str | None = None
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    quote: str


class ConflictingClaim(StrictModel):
    value: str
    unit: str | None = None
    period: str | None = None
    citation: EvidenceCitation


class GroundedAnswerResponse(StrictModel):
    schema_version: Literal["1.0"] = "1.0"
    correlation_id: str
    status: AnswerStatus
    answer: str
    confidence: float = Field(ge=0, le=1)
    conflict: bool
    citations: list[EvidenceCitation]
    conflicting_claims: list[ConflictingClaim] = Field(default_factory=list)
    provider: str


class ProviderAnswer(StrictModel):
    status: AnswerStatus
    answer: str
    confidence: float = Field(ge=0, le=1)
    conflict: bool
    citations: list[EvidenceCitation]
    conflicting_claims: list[ConflictingClaim] = Field(default_factory=list)


class HealthResponse(StrictModel):
    status: str
    service: str
    checks: dict[str, str] = Field(default_factory=dict)
