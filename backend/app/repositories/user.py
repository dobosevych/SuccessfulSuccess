"""Database access for users."""

from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: str) -> User | None:
        return await self.session.get(User, user_id)

    async def ensure(self, user_id: str) -> None:
        """Make sure a row exists (meetings reference it); leaves an existing one alone."""
        await self.session.execute(insert(User).values(id=user_id).on_conflict_do_nothing())

    async def upsert(self, user_id: str, profile: dict[str, Any], login_at: datetime) -> User:
        """Create the user or overwrite their profile with the latest from Cognito."""
        values = profile | {"last_login_at": login_at}
        statement = insert(User).values(id=user_id, **values)
        await self.session.execute(
            statement.on_conflict_do_update(
                index_elements=[User.id],
                set_=values | {"updated_at": func.now()},
            )
        )
        await self.session.commit()
        user = await self.get(user_id)
        assert user is not None
        await self.session.refresh(user)
        return user
