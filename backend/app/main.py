"""FastAPI application factory."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1 import api_router
from app.config import settings
from app.db import SessionFactory
from app.errors import error_response, register_exception_handlers

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger("meetings")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.seed_demo_data:
        from app.seed import seed_if_empty

        await seed_if_empty()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="SuccessfulSuccess Meetings API",
        version=settings.version,
        summary="Meetings for today: list them, create them, delete them.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Location"],
    )

    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/health", tags=["health"], summary="Liveness and database check")
    async def health():
        try:
            async with SessionFactory() as session:
                await session.execute(text("SELECT 1"))
        except Exception:
            logger.exception("Health check failed: database unreachable")
            return error_response(
                status.HTTP_503_SERVICE_UNAVAILABLE, "The database is unreachable."
            )
        return {"status": "ok", "database": "ok", "version": settings.version}

    return app


app = create_app()
