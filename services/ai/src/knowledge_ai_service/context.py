"""Request-scoped context helpers."""

from contextvars import ContextVar

correlation_id_context: ContextVar[str] = ContextVar("correlation_id", default="outside-request")
