"""Meetings endpoints. HTTP only: parse, delegate to the service, serialize."""

import uuid
from datetime import date

from fastapi import APIRouter, Query, Response, status

from app.api.deps import MeetingServiceDep
from app.schemas import MeetingCreate, MeetingList, MeetingRead

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get(
    "",
    response_model=MeetingList,
    summary="List meetings overlapping a calendar day (today by default)",
)
async def list_meetings(
    service: MeetingServiceDep,
    date_: date | None = Query(
        default=None,
        alias="date",
        description="Calendar day (YYYY-MM-DD) in the application timezone. Defaults to today.",
    ),
    q: str | None = Query(default=None, max_length=200, description="Search name/description"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> MeetingList:
    items, total, day = await service.list_for_day(date_, q, limit, offset)
    return MeetingList(
        items=[MeetingRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        date=day.isoformat(),
    )


@router.get(
    "/{meeting_id}",
    response_model=MeetingRead,
    summary="Get a single meeting",
    responses={404: {"description": "Meeting not found"}},
)
async def get_meeting(meeting_id: uuid.UUID, service: MeetingServiceDep) -> MeetingRead:
    return MeetingRead.model_validate(await service.get(meeting_id))


@router.post(
    "",
    response_model=MeetingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a meeting",
    responses={422: {"description": "Validation error"}},
)
async def create_meeting(
    payload: MeetingCreate, service: MeetingServiceDep, response: Response
) -> MeetingRead:
    meeting = await service.create(payload)
    response.headers["Location"] = f"/api/v1/meetings/{meeting.id}"
    return MeetingRead.model_validate(meeting)


@router.delete(
    "/{meeting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a meeting and its participants",
    responses={404: {"description": "Meeting not found"}},
)
async def delete_meeting(meeting_id: uuid.UUID, service: MeetingServiceDep) -> Response:
    await service.delete(meeting_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
