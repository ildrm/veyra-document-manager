"""Provider-neutral grounded-generation boundary and local implementation."""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Protocol, runtime_checkable

from knowledge_ai_service.extraction import (
    contains_prompt_injection_language,
    extract_sla_matches,
    iter_sentences,
)
from knowledge_ai_service.models import (
    AnswerStatus,
    AuthorizedEvidenceChunk,
    ConflictingClaim,
    EvidenceAuthority,
    EvidenceCitation,
    GroundedAnswerRequest,
    ProviderAnswer,
)

INSUFFICIENT_EVIDENCE_ANSWER = "I don't have enough evidence to answer that question."

_WORD = re.compile(r"[\w'-]+", re.UNICODE)
_SLA_QUESTION = re.compile(
    r"(?i)\b(?:uptime|availability|service\s+level|sla|availability\s+commitment)\b"
)
_STOP_WORDS = frozenset(
    {
        "a",
        "about",
        "and",
        "are",
        "as",
        "at",
        "be",
        "been",
        "by",
        "did",
        "do",
        "does",
        "for",
        "from",
        "have",
        "how",
        "i",
        "in",
        "is",
        "it",
        "of",
        "on",
        "our",
        "that",
        "the",
        "this",
        "to",
        "we",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "with",
    }
)
_AUTHORITY_RANK = {
    EvidenceAuthority.UNKNOWN: 0,
    EvidenceAuthority.DRAFT: 1,
    EvidenceAuthority.PUBLISHED: 2,
    EvidenceAuthority.REVIEWED: 3,
    EvidenceAuthority.APPROVED_POLICY: 4,
    EvidenceAuthority.SIGNED_CONTRACT: 5,
    EvidenceAuthority.REGULATED_RECORD: 6,
}


@runtime_checkable
class LLMProvider(Protocol):
    """Stable boundary for local or remote grounded-generation providers.

    Implementations receive only the evidence the authorization gateway already
    allowed. They must not retrieve additional content or broaden scope.
    """

    @property
    def provider_id(self) -> str: ...

    async def is_ready(self) -> bool: ...

    async def answer_grounded(self, request: GroundedAnswerRequest) -> ProviderAnswer: ...


@dataclass(frozen=True, slots=True)
class _LocatedClaim:
    value: str
    normalized_value: Decimal
    period: str | None
    citation: EvidenceCitation
    authority_rank: int


@dataclass(frozen=True, slots=True)
class _SentenceCandidate:
    score: float
    authority_rank: int
    answer: str
    citation: EvidenceCitation


def _citation(
    chunk: AuthorizedEvidenceChunk,
    local_start: int,
    local_end: int,
) -> EvidenceCitation:
    quote = chunk.text[local_start:local_end]
    return EvidenceCitation(
        chunk_id=chunk.chunk_id,
        document_id=chunk.document_id,
        document_version_id=chunk.document_version_id,
        document_title=chunk.document_title,
        page_number=chunk.page_number,
        section=chunk.section,
        start_offset=chunk.start_offset + local_start,
        end_offset=chunk.start_offset + local_end,
        quote=quote,
    )


def _normalize_decimal(value: str) -> Decimal:
    try:
        return Decimal(value).normalize()
    except InvalidOperation:
        return Decimal("NaN")


def _display_decimal(value: Decimal) -> str:
    formatted = format(value, "f")
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return formatted


def _sla_claims(evidence: Sequence[AuthorizedEvidenceChunk]) -> list[_LocatedClaim]:
    claims: list[_LocatedClaim] = []
    seen: set[tuple[str, int, int, Decimal]] = set()
    for chunk in evidence:
        for match in extract_sla_matches(chunk.text):
            local_start = match.start_offset
            local_end = match.end_offset
            normalized_value = _normalize_decimal(match.value)
            key = (chunk.chunk_id, local_start, local_end, normalized_value)
            if key in seen or normalized_value.is_nan():
                continue
            seen.add(key)
            claims.append(
                _LocatedClaim(
                    value=match.value,
                    normalized_value=normalized_value,
                    period=match.period,
                    citation=_citation(chunk, local_start, local_end),
                    authority_rank=_AUTHORITY_RANK[chunk.authority],
                )
            )
    return claims


def _answer_sla(evidence: Sequence[AuthorizedEvidenceChunk]) -> ProviderAnswer:
    claims = _sla_claims(evidence)
    if not claims:
        return ProviderAnswer(
            status=AnswerStatus.INSUFFICIENT_EVIDENCE,
            answer=INSUFFICIENT_EVIDENCE_ANSWER,
            confidence=0.0,
            conflict=False,
            citations=[],
        )

    by_value: dict[Decimal, list[_LocatedClaim]] = {}
    for claim in claims:
        by_value.setdefault(claim.normalized_value, []).append(claim)

    if len(by_value) > 1:
        representative_claims = [
            max(value_claims, key=lambda item: item.authority_rank)
            for value_claims in by_value.values()
        ]
        representative_claims.sort(key=lambda item: item.citation.start_offset)
        rendered_values = [
            f"{_display_decimal(claim.normalized_value)}%"
            + (" monthly uptime" if claim.period == "month" else " uptime")
            for claim in representative_claims
        ]
        conflicts = [
            ConflictingClaim(
                value=_display_decimal(claim.normalized_value),
                unit="percent",
                period=claim.period,
                citation=claim.citation,
            )
            for claim in representative_claims
        ]
        return ProviderAnswer(
            status=AnswerStatus.ANSWERED,
            answer=f"The authorized evidence conflicts: {'; '.join(rendered_values)}.",
            confidence=0.45,
            conflict=True,
            citations=[claim.citation for claim in representative_claims],
            conflicting_claims=conflicts,
        )

    only_value, same_value_claims = next(iter(by_value.items()))
    chosen = max(same_value_claims, key=lambda item: item.authority_rank)
    display_value = _display_decimal(only_value)
    answer = (
        f"{display_value}% monthly uptime."
        if chosen.period == "month"
        else f"{display_value}% uptime."
    )
    return ProviderAnswer(
        status=AnswerStatus.ANSWERED,
        answer=answer,
        confidence=0.98 if chosen.period == "month" else 0.92,
        conflict=False,
        citations=[chosen.citation],
    )


def _tokens(value: str) -> set[str]:
    return {
        token.casefold()
        for token in _WORD.findall(value)
        if len(token) > 1 and token.casefold() not in _STOP_WORDS
    }


def _answer_extractively(request: GroundedAnswerRequest) -> ProviderAnswer:
    question_tokens = _tokens(request.question)
    if not question_tokens:
        return ProviderAnswer(
            status=AnswerStatus.INSUFFICIENT_EVIDENCE,
            answer=INSUFFICIENT_EVIDENCE_ANSWER,
            confidence=0.0,
            conflict=False,
            citations=[],
        )

    candidates: list[_SentenceCandidate] = []
    for chunk in request.evidence:
        for sentence_start, sentence_end, sentence in iter_sentences(chunk.text):
            if len(sentence) < 12 or contains_prompt_injection_language(sentence):
                continue
            overlap = question_tokens.intersection(_tokens(sentence))
            minimum_overlap = 1 if len(question_tokens) <= 2 else 2
            if len(overlap) < minimum_overlap:
                continue
            lexical_score = len(overlap) / len(question_tokens)
            authority_bonus = _AUTHORITY_RANK[chunk.authority] * 0.015
            candidates.append(
                _SentenceCandidate(
                    score=min(1.0, lexical_score + authority_bonus),
                    authority_rank=_AUTHORITY_RANK[chunk.authority],
                    answer=sentence,
                    citation=_citation(chunk, sentence_start, sentence_end),
                )
            )

    if not candidates:
        return ProviderAnswer(
            status=AnswerStatus.INSUFFICIENT_EVIDENCE,
            answer=INSUFFICIENT_EVIDENCE_ANSWER,
            confidence=0.0,
            conflict=False,
            citations=[],
        )

    best = max(candidates, key=lambda item: (item.score, item.authority_rank))
    return ProviderAnswer(
        status=AnswerStatus.ANSWERED,
        answer=best.answer,
        confidence=min(0.88, max(0.55, best.score)),
        conflict=False,
        citations=[best.citation],
    )


class EvidenceOnlyLocalProvider:
    """A real, deterministic provider for evidence-bound answers.

    It performs structured claim extraction and conservative extractive QA. It is
    intentionally useful without an external model and fails closed when it cannot
    support an answer with an exact span.
    """

    @property
    def provider_id(self) -> str:
        return "evidence-only-local-v1"

    async def is_ready(self) -> bool:
        return True

    async def answer_grounded(self, request: GroundedAnswerRequest) -> ProviderAnswer:
        if _SLA_QUESTION.search(request.question):
            return _answer_sla(request.evidence)
        return _answer_extractively(request)
