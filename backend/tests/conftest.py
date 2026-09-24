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

from fastapi import Request  # noqa: E402

from app.auth import CurrentUser, get_current_user, get_verifier  # noqa: E402
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
        await session.execute(text("TRUNCATE users, meetings RESTART IDENTITY CASCADE"))
        await session.commit()
    yield


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """A session for assertions, independent of the one the app uses."""
    async with SessionFactory() as session:
        yield session


@pytest.fixture(scope="session")
def private_key():
    from cryptography.hazmat.primitives.asymmetric import rsa

    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="session")
def verifier(private_key):
    """Checks tokens signed with `private_key`; the app uses it too (see `client`)."""
    from tests.tokens import make_verifier

    return make_verifier(private_key)


TEST_USER_HEADER = "X-Test-User"


def _test_user(request: Request) -> CurrentUser:
    """Stands in for Cognito: the caller is whoever the test header names."""
    return CurrentUser(sub=request.headers.get(TEST_USER_HEADER, "user-a"))


@pytest.fixture
async def anonymous_client(verifier) -> AsyncIterator[AsyncClient]:
    """A client that goes through the real token check (against the test pool)."""
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    fastapi_app.dependency_overrides[get_verifier] = lambda: verifier
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    fastapi_app.dependency_overrides.pop(get_verifier, None)


async def _signed_in_client(sub: str, verifier) -> AsyncIterator[AsyncClient]:
    fastapi_app.dependency_overrides[get_current_user] = _test_user
    fastapi_app.dependency_overrides[get_verifier] = lambda: verifier
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers={TEST_USER_HEADER: sub}
    ) as client:
        yield client
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    fastapi_app.dependency_overrides.pop(get_verifier, None)


@pytest.fixture
async def client(verifier) -> AsyncIterator[AsyncClient]:
    """Signed in as user-a."""
    async for client in _signed_in_client("user-a", verifier):
        yield client


@pytest.fixture
async def other_client(verifier) -> AsyncIterator[AsyncClient]:
    """Signed in as user-b, alongside `client`."""
    async for client in _signed_in_client("user-b", verifier):
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
