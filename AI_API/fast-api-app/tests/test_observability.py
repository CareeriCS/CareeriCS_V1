import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from core.observability import (
    finish_request_observation,
    get_query_metrics,
    install_request_timing_middleware,
    install_sqlalchemy_query_observability,
    start_request_observation,
    timed_external_call,
)


def test_request_timing_middleware_adds_safe_headers_and_log(caplog):
    app = FastAPI()
    install_request_timing_middleware(app)

    @app.get("/health")
    def health():
        return {"ok": True}

    caplog.set_level(logging.INFO, logger="careerics.request")

    response = TestClient(app).get(
        "/health",
        headers={
            "X-Request-ID": "test-request-id",
            "Authorization": "Bearer should-not-be-logged",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert response.headers["X-Request-ID"] == "test-request-id"
    assert float(response.headers["X-Process-Time-Ms"]) >= 0

    records = [
        record
        for record in caplog.records
        if getattr(record, "event", None) == "request_completed"
    ]
    assert len(records) == 1
    record = records[0]
    assert record.request_id == "test-request-id"
    assert record.http_method == "GET"
    assert record.http_path == "/health"
    assert record.http_route == "/health"
    assert record.status_code == 200
    assert record.db_query_count == 0
    assert "should-not-be-logged" not in str(record.__dict__)
    assert "authorization" not in str(record.__dict__).lower()


def test_sqlalchemy_query_observability_collects_request_metrics(monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    engine = create_engine("sqlite:///:memory:")

    assert install_sqlalchemy_query_observability(engine) is True

    tokens = start_request_observation("sql-test-request")
    try:
        with engine.connect() as connection:
            assert connection.execute(text("select 1")).scalar_one() == 1
        metrics = get_query_metrics()
    finally:
        finish_request_observation(tokens)

    assert metrics.query_count == 1
    assert metrics.query_duration_ms >= 0


def test_sqlalchemy_query_observability_is_disabled_without_dev_or_test_env(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("FASTAPI_ENV", raising=False)
    monkeypatch.delenv("CAREERICS_SQL_OBSERVABILITY", raising=False)
    engine = create_engine("sqlite:///:memory:")

    assert install_sqlalchemy_query_observability(engine) is False


def test_timed_external_call_logs_only_safe_metadata(caplog):
    logger = logging.getLogger("tests.timing")
    caplog.set_level(logging.INFO, logger="tests.timing")

    with timed_external_call("provider.search", component="roadmap_provider", logger=logger):
        pass

    records = [
        record
        for record in caplog.records
        if getattr(record, "event", None) == "external_call_timing"
    ]
    assert len(records) == 1
    record = records[0]
    assert record.operation == "provider.search"
    assert record.component == "roadmap_provider"
    assert record.success is True
    assert record.duration_ms >= 0
