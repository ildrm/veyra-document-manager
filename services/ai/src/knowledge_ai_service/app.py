"""FastAPI application factory and HTTP boundary."""

from __future__ import annotations

import logging
import re
import secrets
import time
import uuid
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from pathlib import PurePath
from typing import Any, cast

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException

from knowledge_ai_service.config import Settings
from knowledge_ai_service.context import correlation_id_context
from knowledge_ai_service.errors import ErrorBody, ErrorEnvelope, ErrorMeta, ServiceError
from knowledge_ai_service.extraction import ExtractionInput, extract_document
from knowledge_ai_service.logging_config import configure_logging
from knowledge_ai_service.models import (
    AnswerStatus,
    ExtractionResponse,
    GroundedAnswerRequest,
    GroundedAnswerResponse,
    HealthResponse,
    IngestionTextRequest,
    ProviderAnswer,
)
from knowledge_ai_service.providers import EvidenceOnlyLocalProvider, LLMProvider

logger = logging.getLogger(__name__)
_CORRELATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_MULTIPART_OVERHEAD_ALLOWANCE = 256 * 1024


def _correlation_id(request: Request) -> str:
    return cast(str, request.state.correlation_id)


def _error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    correlation_id: str,
    details: list[dict[str, Any]] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    envelope = ErrorEnvelope(
        error=ErrorBody(code=code, message=message, details=details or []),
        meta=ErrorMeta(correlation_id=correlation_id),
    )
    return JSONResponse(
        status_code=status_code,
        content=envelope.model_dump(mode="json"),
        headers=headers,
    )


async def _require_internal_request(request: Request) -> None:
    settings: Settings = request.app.state.settings
    configured_token = settings.internal_api_token
    if configured_token is None:
        raise ServiceError(
            status_code=503,
            code="INTERNAL_AUTH_NOT_CONFIGURED",
            message="Internal service authentication is not configured.",
        )

    authorization = request.headers.get("authorization")
    alternate_token = request.headers.get("x-internal-api-token") or request.headers.get(
        "x-internal-api-key"
    )
    supplied_token: str | None = None
    if authorization:
        scheme, separator, credentials = authorization.partition(" ")
        if separator and scheme.casefold() == "bearer":
            supplied_token = credentials.strip()
    elif alternate_token:
        supplied_token = alternate_token.strip()

    if not supplied_token:
        raise ServiceError(
            status_code=401,
            code="AUTHENTICATION_REQUIRED",
            message="A valid internal service credential is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not secrets.compare_digest(supplied_token, configured_token):
        raise ServiceError(
            status_code=403,
            code="AUTHENTICATION_FAILED",
            message="The internal service credential was rejected.",
        )


def _safe_filename(value: str | None, fallback: str) -> str:
    candidate = PurePath((value or fallback).replace("\\", "/")).name
    candidate = "".join(character for character in candidate if character.isprintable())
    candidate = candidate.strip()[:255]
    return candidate or fallback


def _declared_content_length(request: Request) -> int | None:
    raw = request.headers.get("content-length")
    if raw is None:
        return None
    try:
        parsed = int(raw)
    except ValueError as exc:
        raise ServiceError(
            status_code=400,
            code="INVALID_CONTENT_LENGTH",
            message="Content-Length must be a non-negative integer.",
        ) from exc
    if parsed < 0:
        raise ServiceError(
            status_code=400,
            code="INVALID_CONTENT_LENGTH",
            message="Content-Length must be a non-negative integer.",
        )
    return parsed


async def _bounded_body(request: Request, maximum: int) -> bytes:
    declared = _declared_content_length(request)
    if declared is not None and declared > maximum:
        raise ServiceError(
            status_code=413,
            code="UPLOAD_TOO_LARGE",
            message=f"The request body may be at most {maximum} bytes.",
        )
    body = bytearray()
    async for part in request.stream():
        body.extend(part)
        if len(body) > maximum:
            raise ServiceError(
                status_code=413,
                code="UPLOAD_TOO_LARGE",
                message=f"The request body may be at most {maximum} bytes.",
            )
    return bytes(body)


async def _read_upload(upload: UploadFile, maximum: int) -> bytes:
    content = bytearray()
    while True:
        part = await upload.read(64 * 1024)
        if not part:
            break
        content.extend(part)
        if len(content) > maximum:
            raise ServiceError(
                status_code=413,
                code="UPLOAD_TOO_LARGE",
                message=f"Documents may be at most {maximum} bytes.",
            )
    return bytes(content)


def _validation_error(exc: ValidationError) -> RequestValidationError:
    return RequestValidationError(exc.errors(include_input=False, include_context=False))


async def _parse_extraction_input(request: Request) -> ExtractionInput:
    settings: Settings = request.app.state.settings
    raw_content_type = request.headers.get("content-type", "")
    media_type = raw_content_type.split(";", 1)[0].strip().lower()

    if media_type == "application/json":
        body = await _bounded_body(request, settings.max_upload_bytes)
        try:
            payload = IngestionTextRequest.model_validate_json(body)
        except ValidationError as exc:
            raise _validation_error(exc) from exc
        return ExtractionInput(
            content=payload.text.encode("utf-8"),
            filename=_safe_filename(payload.filename, "inline.txt"),
            declared_media_type=payload.media_type,
            document_id=payload.document_id,
            document_version_id=payload.document_version_id,
        )

    if media_type in {"multipart/form-data", "application/x-www-form-urlencoded"}:
        declared = _declared_content_length(request)
        maximum_request = settings.max_upload_bytes + _MULTIPART_OVERHEAD_ALLOWANCE
        if declared is not None and declared > maximum_request:
            raise ServiceError(
                status_code=413,
                code="UPLOAD_TOO_LARGE",
                message=f"Documents may be at most {settings.max_upload_bytes} bytes.",
            )
        try:
            form = await request.form(
                max_files=1,
                max_fields=8,
                max_part_size=settings.max_upload_bytes,
            )
        except (ValueError, StarletteHTTPException) as exc:
            raise ServiceError(
                status_code=400,
                code="INVALID_MULTIPART_REQUEST",
                message="The multipart upload could not be parsed.",
            ) from exc
        upload_value = form.get("file")
        inline_text = form.get("text")
        if isinstance(upload_value, UploadFile) and isinstance(inline_text, str):
            raise ServiceError(
                status_code=400,
                code="AMBIGUOUS_INGESTION_INPUT",
                message="Provide either a file or inline text, not both.",
            )
        document_id = form.get("document_id")
        version_id = form.get("document_version_id")
        normalized_document_id = document_id if isinstance(document_id, str) else None
        normalized_version_id = version_id if isinstance(version_id, str) else None
        if isinstance(upload_value, UploadFile):
            return ExtractionInput(
                content=await _read_upload(upload_value, settings.max_upload_bytes),
                filename=_safe_filename(upload_value.filename, "upload.bin"),
                declared_media_type=upload_value.content_type,
                document_id=normalized_document_id,
                document_version_id=normalized_version_id,
            )
        if isinstance(inline_text, str):
            encoded = inline_text.encode("utf-8")
            if len(encoded) > settings.max_upload_bytes:
                raise ServiceError(
                    status_code=413,
                    code="UPLOAD_TOO_LARGE",
                    message=f"Documents may be at most {settings.max_upload_bytes} bytes.",
                )
            filename_value = form.get("filename")
            declared_media_type = form.get("media_type")
            return ExtractionInput(
                content=encoded,
                filename=_safe_filename(
                    filename_value if isinstance(filename_value, str) else None,
                    "inline.txt",
                ),
                declared_media_type=(
                    declared_media_type if isinstance(declared_media_type, str) else "text/plain"
                ),
                document_id=normalized_document_id,
                document_version_id=normalized_version_id,
            )
        raise ServiceError(
            status_code=400,
            code="INGESTION_INPUT_REQUIRED",
            message="A multipart request must contain a file or text field.",
        )

    if media_type in {"text/plain", "text/markdown", "text/csv", "application/pdf"}:
        body = await _bounded_body(request, settings.max_upload_bytes)
        fallback = "upload.pdf" if media_type == "application/pdf" else "inline.txt"
        return ExtractionInput(
            content=body,
            filename=_safe_filename(request.headers.get("x-filename"), fallback),
            declared_media_type=media_type,
            document_id=request.headers.get("x-document-id"),
            document_version_id=request.headers.get("x-document-version-id"),
        )

    raise ServiceError(
        status_code=415,
        code="UNSUPPORTED_REQUEST_CONTENT_TYPE",
        message="Use application/json, multipart/form-data, text, or application/pdf.",
    )


def _validate_provider_answer(
    request: GroundedAnswerRequest,
    answer: ProviderAnswer,
) -> None:
    evidence_by_id = {chunk.chunk_id: chunk for chunk in request.evidence}
    if answer.status == AnswerStatus.INSUFFICIENT_EVIDENCE:
        if answer.citations or answer.conflict:
            raise ServiceError(
                status_code=502,
                code="PROVIDER_OUTPUT_INVALID",
                message="The answer provider returned an invalid insufficient-evidence result.",
            )
        return
    if not answer.citations:
        raise ServiceError(
            status_code=502,
            code="PROVIDER_OUTPUT_INVALID",
            message="A supported answer must contain at least one exact citation.",
        )

    for citation in answer.citations:
        chunk = evidence_by_id.get(citation.chunk_id)
        if chunk is None:
            raise ServiceError(
                status_code=502,
                code="PROVIDER_CITATION_INVALID",
                message="The answer provider cited evidence outside the authorized scope.",
            )
        relative_start = citation.start_offset - chunk.start_offset
        relative_end = citation.end_offset - chunk.start_offset
        identity_matches = (
            citation.document_id == chunk.document_id
            and citation.document_version_id == chunk.document_version_id
            and citation.document_title == chunk.document_title
            and citation.page_number == chunk.page_number
        )
        offsets_valid = 0 <= relative_start < relative_end <= len(chunk.text)
        quote_matches = offsets_valid and chunk.text[relative_start:relative_end] == citation.quote
        if not identity_matches or not quote_matches:
            raise ServiceError(
                status_code=502,
                code="PROVIDER_CITATION_INVALID",
                message=(
                    "The answer provider returned a citation that is not an exact evidence span."
                ),
            )


def create_app(
    settings: Settings | None = None,
    provider: LLMProvider | None = None,
) -> FastAPI:
    runtime_settings = settings or Settings.from_env()
    runtime_settings.validate()
    configure_logging(runtime_settings.log_level)
    answer_provider = provider or EvidenceOnlyLocalProvider()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        logger.info(
            "service_started",
            extra={
                "service": runtime_settings.service_name,
                "environment": runtime_settings.environment,
            },
        )
        yield
        logger.info("service_stopped", extra={"service": runtime_settings.service_name})

    app = FastAPI(
        title="Knowledge AI and Ingestion Service",
        version="0.1.0",
        description=(
            "Internal evidence-oriented extraction and grounded-answer API. "
            "Document content is always treated as untrusted data."
        ),
        lifespan=lifespan,
    )
    app.state.settings = runtime_settings
    app.state.answer_provider = answer_provider

    @app.middleware("http")
    async def correlation_and_access_log(request: Request, call_next: Any) -> JSONResponse:
        incoming = request.headers.get("x-correlation-id", "")
        request_id = incoming if _CORRELATION_ID.fullmatch(incoming) else uuid.uuid4().hex
        request.state.correlation_id = request_id
        context_token = correlation_id_context.set(request_id)
        started = time.perf_counter()
        response: Any = None
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = request_id
            return cast(JSONResponse, response)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1_000, 2)
            logger.info(
                "request_completed",
                extra={
                    "http_method": request.method,
                    "http_path": request.url.path,
                    "http_status": getattr(response, "status_code", 500),
                    "duration_ms": duration_ms,
                },
            )
            correlation_id_context.reset(context_token)

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
        logger.warning(
            "service_error",
            extra={"error_code": exc.code, "http_status": exc.status_code},
        )
        return _error_response(
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            correlation_id=_correlation_id(request),
            details=exc.details,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            {
                "location": [str(part) for part in error.get("loc", ())],
                "message": error.get("msg", "Invalid value"),
                "type": error.get("type", "validation_error"),
            }
            for error in exc.errors()
        ]
        return _error_response(
            status_code=422,
            code="REQUEST_VALIDATION_FAILED",
            message="The request did not satisfy the API contract.",
            correlation_id=_correlation_id(request),
            details=details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "RESOURCE_NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        return _error_response(
            status_code=exc.status_code,
            code=code,
            message=str(exc.detail),
            correlation_id=_correlation_id(request),
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unexpected_service_error", exc_info=exc)
        return _error_response(
            status_code=500,
            code="INTERNAL_SERVICE_ERROR",
            message="The service could not complete the request.",
            correlation_id=_correlation_id(request),
        )

    @app.get("/health/live", response_model=HealthResponse, tags=["health"])
    async def health_live() -> HealthResponse:
        return HealthResponse(status="live", service=runtime_settings.service_name)

    @app.get(
        "/health/ready",
        response_model=HealthResponse,
        responses={503: {"model": HealthResponse}},
        tags=["health"],
    )
    async def health_ready() -> HealthResponse | JSONResponse:
        provider_ready = await answer_provider.is_ready()
        auth_ready = runtime_settings.internal_api_token is not None
        checks = {
            "internal_auth": "ready" if auth_ready else "not_configured",
            "answer_provider": "ready" if provider_ready else "not_ready",
        }
        result = HealthResponse(
            status="ready" if provider_ready and auth_ready else "not_ready",
            service=runtime_settings.service_name,
            checks=checks,
        )
        if result.status != "ready":
            return JSONResponse(status_code=503, content=result.model_dump(mode="json"))
        return result

    @app.post(
        "/v1/ingestion/extract",
        response_model=ExtractionResponse,
        dependencies=[Depends(_require_internal_request)],
        tags=["ingestion"],
    )
    async def ingestion_extract(request: Request) -> ExtractionResponse:
        extraction_input = await _parse_extraction_input(request)
        result = extract_document(
            extraction_input,
            runtime_settings,
            _correlation_id(request),
        )
        logger.info(
            "document_extracted",
            extra={
                "media_type": result.document.media_type,
                "size_bytes": result.document.size_bytes,
                "page_count": result.document.page_count,
                "chunk_count": len(result.chunks),
                "claim_count": len(result.claims),
                "pii_signal_count": len(result.pii_signals),
                "document_sha256": result.document.sha256,
            },
        )
        return result

    @app.post(
        "/v1/answers/grounded",
        response_model=GroundedAnswerResponse,
        dependencies=[Depends(_require_internal_request)],
        tags=["answers"],
    )
    async def grounded_answer(
        request: Request,
        payload: GroundedAnswerRequest,
    ) -> GroundedAnswerResponse:
        if len(payload.evidence) > runtime_settings.max_evidence_chunks:
            raise ServiceError(
                status_code=413,
                code="EVIDENCE_SCOPE_TOO_LARGE",
                message=(
                    f"At most {runtime_settings.max_evidence_chunks} evidence chunks "
                    "may be supplied."
                ),
            )
        evidence_characters = sum(len(chunk.text) for chunk in payload.evidence)
        if evidence_characters > runtime_settings.max_evidence_characters:
            raise ServiceError(
                status_code=413,
                code="EVIDENCE_SCOPE_TOO_LARGE",
                message=(
                    "Authorized evidence exceeds the configured character limit of "
                    f"{runtime_settings.max_evidence_characters}."
                ),
            )
        result = await answer_provider.answer_grounded(payload)
        _validate_provider_answer(payload, result)
        logger.info(
            "grounded_answer_completed",
            extra={
                "answer_status": result.status,
                "evidence_chunk_count": len(payload.evidence),
                "citation_count": len(result.citations),
                "conflict": result.conflict,
                "provider": answer_provider.provider_id,
            },
        )
        return GroundedAnswerResponse(
            correlation_id=_correlation_id(request),
            status=result.status,
            answer=result.answer,
            confidence=result.confidence,
            conflict=result.conflict,
            citations=result.citations,
            conflicting_claims=result.conflicting_claims,
            provider=answer_provider.provider_id,
        )

    return app


app = create_app()
