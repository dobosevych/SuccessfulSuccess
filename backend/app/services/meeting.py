"""Business rules for meetings: the day window and the create/list/delete use cases."""

import uuid
from datetime import date, datetime, time, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Meeting
from app.repositories.meeting import MeetingRepository
from app.schemas import MeetingCreate


class MeetingNotFoundError(Exception):
    def __init__(self, meeting_id: uuid.UUID) -> None:
        super().__init__(f"Meeting {meeting_id} was not found.")
        self.meeting_id = meeting_id


def day_window(day: date) -> tuple[datetime, datetime]:
    """Return [start, end) of a calendar day in the application timezone."""
    tz = settings.tz
    start = datetime.combine(day, time.min, tzinfo=tz)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz)
    return start, end


def today() -> date:
    return datetime.now(settings.tz).date()


class MeetingService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = MeetingRepository(session)

    async def list_for_day(
        self,
        day: date | None = None,
        query: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Meeting], int, date]:
        target = day or today()
        window_start, window_end = day_window(target)
        items, total = await self.repo.list_overlapping(
            window_start, window_end, query, limit, offset
        )
        return items, total, target

    async def get(self, meeting_id: uuid.UUID) -> Meeting:
        meeting = await self.repo.get(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError(meeting_id)
        return meeting

    async def create(self, payload: MeetingCreate) -> Meeting:
        return await self.repo.create(payload)

    async def delete(self, meeting_id: uuid.UUID) -> None:
        if not await self.repo.delete(meeting_id):
            raise MeetingNotFoundError(meeting_id)
