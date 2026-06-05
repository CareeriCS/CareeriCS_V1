import logging
import os
import time
import uuid
from contextlib import contextmanager
from contextvars import Token, ContextVar
from dataclasses import dataclass
from typing import Any, Iterator, Optional

from fastapi import FastAPI, Request
from sqlalchemy import event
from sqlalchemy.engine import Engine


request_logger = logging.getLogger("careerics.request")
timing_logger = logging.getLogger("careerics.timing")


@dataclass
class QueryMetrics:
    query_count: int = 0
    query_duration_ms: float = 0.0


@dataclass(frozen=True)
class RequestObservationTokens:
    request_id_token: Token[Optional[str]]
    query_metrics_token: Token[Optional[QueryMetrics]]


_request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_query_metrics: ContextVar[Optional[QueryMetrics]] = ContextVar("query_metrics", default=None)


def _env_truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _current_environment() -> str:
    return (
        os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("ENV")
        or os.getenv("FASTAPI_ENV")
        or ""
    ).strip().lower()


def is_sql_query_observability_enabled() -> bool:
    """Enable SQL metrics only in explicit development/test contexts."""
    explicit = os.getenv("CAREERICS_SQL_OBSERVABILITY")
    environment = _current_environment()

    if environment in {"production", "prod"}:
        return False

    if explicit is not None:
        return _env_truthy(explicit)

    return environment in {"development", "dev", "test", "testing"}


def start_request_observation(request_id: str) -> RequestObservationTokens:
    return RequestObservationTokens(
        request_id_token=_request_id.set(request_id),
        query_metrics_token=_query_metrics.set(QueryMetrics()),
    )


def finish_request_observation(tokens: RequestObservationTokens) -> None:
    _query_metrics.reset(tokens.query_metrics_token)
    _request_id.reset(tokens.request_id_token)


def get_request_id() -> Optional[str]:
    return _request_id.get()


def get_query_metrics() -> QueryMetrics:
    metrics = _query_metrics.get()
    if metrics is None:
        return QueryMetrics()
    return QueryMetrics(
        query_count=metrics.query_count,
        query_duration_ms=metrics.query_duration_ms,
    )


def record_sql_query(duration_ms: float) -> None:
    metrics = _query_metrics.get()
    if metrics is None:
        return
    metrics.query_count += 1
    metrics.query_duration_ms += max(duration_ms, 0.0)


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", request.url.path)


def _request_id_from_headers(request: Request) -> str:
    request_id = request.headers.get("x-request-id")
    if request_id:
        return request_id[:128]
    return str(uuid.uuid4())


def install_request_timing_middleware(app: FastAPI) -> None:
    if getattr(app.state, "request_timing_middleware_installed", False):
        return

    @app.middleware("http")
    async def request_timing_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = _request_id_from_headers(request)
        tokens = start_request_observation(request_id)
        started_at = time.perf_counter()
        status_code = 500
        response = None

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = (time.perf_counter() - started_at) * 1000
            metrics = get_query_metrics()

            if response is not None:
                response.headers["X-Request-ID"] = request_id
                response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

            request_logger.info(
                "request_completed",
                extra={
                    "event": "request_completed",
                    "request_id": request_id,
                    "http_method": request.method,
                    "http_path": request.url.path,
                    "http_route": _route_template(request),
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                    "db_query_count": metrics.query_count,
                    "db_query_duration_ms": round(metrics.query_duration_ms, 2),
                },
            )
            finish_request_observation(tokens)

    app.state.request_timing_middleware_installed = True


def install_sqlalchemy_query_observability(engine: Engine) -> bool:
    if not is_sql_query_observability_enabled():
        return False

    if getattr(engine, "_careerics_query_observability_installed", False):
        return False

    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        context._careerics_query_started_at = time.perf_counter()

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        started_at = getattr(context, "_careerics_query_started_at", None)
        if started_at is None:
            return
        record_sql_query((time.perf_counter() - started_at) * 1000)

    @event.listens_for(engine, "handle_error")
    def handle_error(exception_context):  # type: ignore[no-untyped-def]
        execution_context = getattr(exception_context, "execution_context", None)
        started_at = getattr(execution_context, "_careerics_query_started_at", None)
        if started_at is None:
            return
        record_sql_query((time.perf_counter() - started_at) * 1000)

    engine._careerics_query_observability_installed = True
    return True


@contextmanager
def timed_external_call(
    operation: str,
    *,
    component: Optional[str] = None,
    logger: Optional[logging.Logger] = None,
) -> Iterator[None]:
    """Log only operation metadata and timing; callers must not pass payloads."""
    active_logger = logger or timing_logger
    started_at = time.perf_counter()

    try:
        yield
    except Exception:
        active_logger.exception(
            "external_call_failed",
            extra={
                "event": "external_call_timing",
                "operation": operation,
                "component": component,
                "success": False,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
        )
        raise
    else:
        active_logger.info(
            "external_call_completed",
            extra={
                "event": "external_call_timing",
                "operation": operation,
                "component": component,
                "success": True,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
        )
