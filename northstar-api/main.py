import asyncio
import os
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

from console import console_api
from store import StoreError, db
from web import web_api

# Mock-only affordances (failure injection, latency, reset) exist only in explicit mock mode.
NORTHSTAR_MOCK = os.environ.get("NORTHSTAR_MOCK") == "1"
MOCK_LATENCY_MS = int(os.environ.get("MOCK_LATENCY_MS", "0"))

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5174,http://localhost:5175").split(
    ","
)


async def _store_error_handler(_request: Request, exc: StoreError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


for _surface in (console_api, web_api):
    _surface.add_exception_handler(StoreError, _store_error_handler)  # type: ignore[arg-type]


app = FastAPI(title="northstar-api")


async def mock_faithfulness(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    fail = request.headers.get("x-mock-fail")
    if fail is not None:
        status = int(fail) if fail.isdigit() else 500
        return JSONResponse(
            status_code=status, content={"detail": f"Mock failure (X-Mock-Fail: {fail})"}
        )
    if MOCK_LATENCY_MS:
        await asyncio.sleep(MOCK_LATENCY_MS / 1000)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount("/console", console_api)
app.mount("/web", web_api)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def reset_mock() -> dict[str, str]:
    db.reset()
    return {"status": "reset"}


if NORTHSTAR_MOCK:
    app.middleware("http")(mock_faithfulness)
    app.post("/__mock/reset")(reset_mock)
