# -*- coding: utf-8 -*-
"""
main.py — VayuDrishti FastAPI application entry point.

Wires together:
  - FastAPI app with CORS middleware
  - /reports router (submit, fetch, list, nearby)
  - /health liveness probe
  - Startup logging

Run locally:
    cd backend
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import reports as reports_router

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

def _configure_logging(level: str) -> None:
    logging.basicConfig(
        stream=sys.stdout,
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


settings = get_settings()
_configure_logging(settings.LOG_LEVEL)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "VayuDrishti — Urban dust-pollution reporting API. "
        "Residents submit photo reports; AI analyses images and builds investigation dossiers."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS middleware  (allows the Vite / React dev server to reach the API)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(reports_router.router, prefix="/api/v1")

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"], summary="Liveness probe")
def health_check() -> dict:
    """Simple liveness probe — returns app name, version, and active config."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "vision_provider": settings.VISION_PROVIDER,
        "use_localstack": settings.USE_LOCALSTACK,
    }


# ---------------------------------------------------------------------------
# Startup event
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup() -> None:
    logger.info(
        "VayuDrishti %s starting up | vision=%s | localstack=%s",
        settings.APP_VERSION,
        settings.VISION_PROVIDER,
        settings.USE_LOCALSTACK,
    )
    logger.info(
        "API docs available at http://127.0.0.1:8000/docs"
    )
