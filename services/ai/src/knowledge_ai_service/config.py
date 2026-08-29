"""Runtime configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


@dataclass(frozen=True, slots=True)
class Settings:
    """Configuration for one service process.

    The service deliberately has no built-in credential. A missing internal token
    keeps liveness available while readiness and protected endpoints fail closed.
    """

    service_name: str = "knowledge-ai-service"
    environment: str = "development"
    log_level: str = "INFO"
    internal_api_token: str | None = None
    max_upload_bytes: int = 10 * 1024 * 1024
    max_pdf_pages: int = 500
    max_evidence_chunks: int = 50
    max_evidence_characters: int = 250_000
    chunk_size: int = 1_000
    chunk_overlap: int = 120

    @classmethod
    def from_env(cls) -> Settings:
        token = os.getenv("AI_INTERNAL_API_TOKEN")
        return cls(
            service_name=os.getenv("AI_SERVICE_NAME", "knowledge-ai-service"),
            environment=os.getenv("AI_ENVIRONMENT", "development"),
            log_level=os.getenv("AI_LOG_LEVEL", "INFO").upper(),
            internal_api_token=token if token else None,
            max_upload_bytes=_positive_int("AI_MAX_UPLOAD_BYTES", 10 * 1024 * 1024),
            max_pdf_pages=_positive_int("AI_MAX_PDF_PAGES", 500),
            max_evidence_chunks=_positive_int("AI_MAX_EVIDENCE_CHUNKS", 50),
            max_evidence_characters=_positive_int("AI_MAX_EVIDENCE_CHARACTERS", 250_000),
            chunk_size=_positive_int("AI_CHUNK_SIZE", 1_000),
            chunk_overlap=_positive_int("AI_CHUNK_OVERLAP", 120),
        )

    def validate(self) -> None:
        if self.chunk_overlap >= self.chunk_size:
            raise RuntimeError("AI_CHUNK_OVERLAP must be smaller than AI_CHUNK_SIZE")
        if self.log_level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise RuntimeError("AI_LOG_LEVEL is invalid")
