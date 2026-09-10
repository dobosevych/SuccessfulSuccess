"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.services.meeting import MeetingService

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_meeting_service(session: SessionDep) -> MeetingService:
    return MeetingService(session)


MeetingServiceDep = Annotated[MeetingService, Depends(get_meeting_service)]
