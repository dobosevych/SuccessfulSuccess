"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUserDep
from app.db import get_session
from app.services.meeting import MeetingService
from app.services.user import UserService

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_meeting_service(session: SessionDep, user: CurrentUserDep) -> MeetingService:
    return MeetingService(session, user.sub)


MeetingServiceDep = Annotated[MeetingService, Depends(get_meeting_service)]


def get_user_service(session: SessionDep) -> UserService:
    return UserService(session)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]
