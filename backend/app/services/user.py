"""The signed-in user's profile, kept in step with their Cognito ID token."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.repositories.user import UserRepository


def _text(claims: dict[str, Any], key: str) -> str | None:
    value = claims.get(key)
    return value.strip() or None if isinstance(value, str) else None


def _provider(claims: dict[str, Any]) -> str:
    """Federated sign-ins list their provider in "identities"; none means email + password."""
    identities = claims.get("identities") or []
    for identity in identities if isinstance(identities, list) else []:
        if isinstance(identity, dict) and identity.get("providerName"):
            return str(identity["providerName"]).lower()
    return "cognito"


def profile_from_claims(claims: dict[str, Any]) -> dict[str, Any]:
    verified = claims.get("email_verified")
    return {
        "email": _text(claims, "email"),
        # Cognito sends a boolean; Google-federated users may get the string "true".
        "email_verified": verified is True or verified == "true",
        "name": _text(claims, "name"),
        "given_name": _text(claims, "given_name"),
        "family_name": _text(claims, "family_name"),
        "picture_url": _text(claims, "picture"),
        "auth_provider": _provider(claims),
    }


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)
        self.session = session

    async def get_or_create(self, user_id: str) -> User:
        user = await self.repo.get(user_id)
        if user is None:
            await self.repo.ensure(user_id)
            await self.session.commit()
            user = await self.repo.get(user_id)
            assert user is not None
        return user

    async def sync(self, user_id: str, id_token_claims: dict[str, Any]) -> User:
        return await self.repo.upsert(
            user_id, profile_from_claims(id_token_claims), datetime.now(UTC)
        )
