"""Test fixtures: a real Postgres schema plus an ASGI client bound to it."""

import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL", "postgresql+asyncpg://app:app@localhost:5432/meetings_test"
    ),
)
os.environ.setdefault("APP_TIMEZONE", "Europe/Kyiv")
os.environ.setdefault("RUN_MIGRATIONS_ON_START", "false")
os.environ.setdefault("SEED_DEMO_DATA", "false")

from app.db import Base, SessionFactory, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
async def schema() -> AsyncIterator[None]:
    """Build the schema once for the whole run, then drop it."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables(schema: None) -> AsyncIterator[None]:
    """Start every test from an empty database."""
    async with SessionFactory() as session:
        await session.execute(text("TRUNCATE meetings RESTART IDENTITY CASCADE"))
        await session.commit()
    yield


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """A session for assertions, independent of the one the app uses."""
    async with SessionFactory() as session:
        yield session


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def meeting_payload() -> dict:
    return {
        "name": "Sprint planning",
        "description": "Plan the next two weeks",
        "location": "Room 3",
        "starts_at": "2026-09-10T10:00:00+03:00",
        "ends_at": "2026-09-10T11:00:00+03:00",
        "participants": [
            {"name": "Ostap", "email": "ostap@example.com"},
            {"name": "Iryna"},
        ],
    }
