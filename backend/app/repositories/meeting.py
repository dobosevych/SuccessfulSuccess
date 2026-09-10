"""Database access for meetings. No HTTP concerns live here."""

import uuid
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Meeting, Participant
from app.schemas import MeetingCreate


class MeetingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _overlap_filters(self, window_start: datetime, window_end: datetime):
        """A meeting overlaps the window when it starts before it ends and ends after it starts."""
        return (Meeting.starts_at < window_end, Meeting.ends_at > window_start)

    async def list_overlapping(
        self,
        window_start: datetime,
        window_end: datetime,
        query: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Meeting], int]:
        filters = list(self._overlap_filters(window_start, window_end))
        if query:
            pattern = f"%{query.strip()}%"
            filters.append(Meeting.name.ilike(pattern) | Meeting.description.ilike(pattern))

        total = await self.session.scalar(select(func.count()).select_from(Meeting).where(*filters))
        result = await self.session.scalars(
            select(Meeting)
            .where(*filters)
            .order_by(Meeting.starts_at.asc(), Meeting.name.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(result), int(total or 0)

    async def get(self, meeting_id: uuid.UUID) -> Meeting | None:
        return await self.session.get(Meeting, meeting_id)

    async def create(self, payload: MeetingCreate) -> Meeting:
        meeting = Meeting(
            name=payload.name,
            description=payload.description,
            location=payload.location,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            participants=[
                Participant(name=p.name, email=p.email, position=index)
                for index, p in enumerate(payload.participants)
            ],
        )
        self.session.add(meeting)
        await self.session.commit()
        await self.session.refresh(meeting)
        return meeting

    async def delete(self, meeting_id: uuid.UUID) -> bool:
        result = await self.session.execute(delete(Meeting).where(Meeting.id == meeting_id))
        await self.session.commit()
        return bool(result.rowcount)

    async def count(self) -> int:
        return int(await self.session.scalar(select(func.count()).select_from(Meeting)) or 0)
