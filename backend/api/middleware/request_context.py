from __future__ import annotations

from time import perf_counter
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or uuid4().hex
        started_at = perf_counter()

        response = await call_next(request)

        response.headers["x-request-id"] = request_id
        response.headers["x-process-time-ms"] = f"{(perf_counter() - started_at) * 1000:.2f}"
        return response
