from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from knowledge_ai_service.app import create_app
from knowledge_ai_service.config import Settings

TEST_TOKEN = "test-internal-token-with-enough-entropy"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        log_level="WARNING",
        internal_api_token=TEST_TOKEN,
        max_upload_bytes=1024 * 1024,
        max_pdf_pages=20,
        max_evidence_chunks=10,
        max_evidence_characters=100_000,
        chunk_size=120,
        chunk_overlap=20,
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings=settings)) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {TEST_TOKEN}"}
