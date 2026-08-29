"""Typed service errors and public error envelopes."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ServiceError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []
        self.headers = headers or {}


class ErrorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    details: list[dict[str, Any]] = Field(default_factory=list)


class ErrorMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    correlation_id: str


class ErrorEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ErrorBody
    meta: ErrorMeta
