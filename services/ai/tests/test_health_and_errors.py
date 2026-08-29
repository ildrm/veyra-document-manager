from __future__ import annotations

from fastapi.testclient import TestClient

from conftest import TEST_TOKEN
from knowledge_ai_service.app import create_app
from knowledge_ai_service.config import Settings


def test_liveness_and_readiness(client: TestClient) -> None:
    live = client.get("/health/live", headers={"X-Correlation-ID": "edge-req-42"})
    assert live.status_code == 200
    assert live.json() == {
        "status": "live",
        "service": "knowledge-ai-service",
        "checks": {},
    }
    assert live.headers["x-correlation-id"] == "edge-req-42"

    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert ready.json()["checks"] == {
        "internal_auth": "ready",
        "answer_provider": "ready",
    }


def test_missing_auth_configuration_fails_closed() -> None:
    settings = Settings(environment="test", log_level="WARNING", internal_api_token=None)
    with TestClient(create_app(settings=settings)) as client:
        ready = client.get("/health/ready")
        assert ready.status_code == 503
        assert ready.json()["checks"]["internal_auth"] == "not_configured"

        response = client.post(
            "/v1/ingestion/extract",
            json={"text": "sensitive content", "filename": "test.txt"},
        )
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "INTERNAL_AUTH_NOT_CONFIGURED"


def test_protected_routes_require_valid_internal_token(client: TestClient) -> None:
    missing = client.post(
        "/v1/ingestion/extract",
        json={"text": "sensitive content", "filename": "test.txt"},
    )
    assert missing.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"
    assert missing.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert missing.json()["meta"]["correlation_id"] == missing.headers["x-correlation-id"]

    invalid = client.post(
        "/v1/ingestion/extract",
        headers={"Authorization": "Bearer wrong-token"},
        json={"text": "sensitive content", "filename": "test.txt"},
    )
    assert invalid.status_code == 403
    assert invalid.json()["error"]["code"] == "AUTHENTICATION_FAILED"

    internal_key = client.post(
        "/v1/ingestion/extract",
        headers={"X-Internal-Api-Key": TEST_TOKEN},
        json={"text": "Authorized service content", "filename": "test.txt"},
    )
    assert internal_key.status_code == 200


def test_validation_errors_are_typed_and_do_not_echo_input(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    secret = "do-not-reflect-this-secret"
    response = client.post(
        "/v1/ingestion/extract",
        headers=auth_headers,
        json={"text": "", "filename": secret, "unexpected": secret},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "REQUEST_VALIDATION_FAILED"
    assert secret not in response.text
    assert body["meta"]["correlation_id"] == response.headers["x-correlation-id"]


def test_invalid_correlation_id_is_replaced(client: TestClient) -> None:
    response = client.get("/health/live", headers={"X-Correlation-ID": "bad id\tvalue"})
    assert response.status_code == 200
    assert response.headers["x-correlation-id"] != "bad id\tvalue"
    assert len(response.headers["x-correlation-id"]) == 32
