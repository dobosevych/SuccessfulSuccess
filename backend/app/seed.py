"""Insert a few demo meetings for today when the database is still empty."""

import asyncio
import logging
from datetime import datetime, time

from app.config import settings
from app.db import SessionFactory
from app.models import Meeting, Participant
from app.repositories.meeting import MeetingRepository

logger = logging.getLogger("meetings.seed")

DEMO = [
    (
        "Sprint planning",
        "Plan the next two weeks and groom the backlog.",
        "Room 3",
        time(10, 0),
        time(11, 0),
        [("Ostap", "ostap@example.com"), ("Iryna", None), ("Maksym", "maksym@example.com")],
    ),
    (
        "Design review",
        "Walk through the new meetings dashboard.",
        "meet.example.com/design",
        time(14, 0),
        time(14, 30),
        [("Sofia", "sofia@example.com"), ("Ostap", None)],
    ),
    (
        "Daily standup",
        "What we did, what we will do, what blocks us.",
        None,
        time(9, 15),
        time(9, 30),
        [("Ostap", None), ("Iryna", None), ("Sofia", None), ("Maksym", None), ("Andrii", None)],
    ),
]


async def seed_if_empty() -> None:
    async with SessionFactory() as session:
        if await MeetingRepository(session).count():
            logger.info("Database already has meetings; skipping demo seed.")
            return

        today = datetime.now(settings.tz).date()
        for name, description, location, start, end, people in DEMO:
            session.add(
                Meeting(
                    name=name,
                    description=description,
                    location=location,
                    starts_at=datetime.combine(today, start, tzinfo=settings.tz),
                    ends_at=datetime.combine(today, end, tzinfo=settings.tz),
                    participants=[
                        Participant(name=person, email=email, position=index)
                        for index, (person, email) in enumerate(people)
                    ],
                )
            )
        await session.commit()
        logger.info("Seeded %d demo meetings for %s.", len(DEMO), today)


if __name__ == "__main__":
    asyncio.run(seed_if_empty())
