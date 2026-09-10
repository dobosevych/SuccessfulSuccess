"""Tests for the "today" day window, including meetings that cross midnight."""

from datetime import datetime, timedelta

from app.config import settings
from app.services.meeting import day_window, today


def _iso(moment: datetime) -> str:
    return moment.isoformat()


async def test_list_without_date_returns_only_todays_meetings(client, meeting_payload):
    start, _ = day_window(today())
    today_meeting = meeting_payload | {
        "name": "Today meeting",
        "starts_at": _iso(start + timedelta(hours=10)),
        "ends_at": _iso(start + timedelta(hours=11)),
    }
    tomorrow_meeting = meeting_payload | {
        "name": "Tomorrow meeting",
        "starts_at": _iso(start + timedelta(days=1, hours=10)),
        "ends_at": _iso(start + timedelta(days=1, hours=11)),
        "participants": [],
    }
    await client.post("/api/v1/meetings", json=today_meeting)
    await client.post("/api/v1/meetings", json=tomorrow_meeting)

    body = (await client.get("/api/v1/meetings")).json()

    assert body["date"] == today().isoformat()
    assert [item["name"] for item in body["items"]] == ["Today meeting"]
    assert body["total"] == 1


async def test_meeting_across_midnight_appears_on_both_days(client, meeting_payload):
    start, _ = day_window(today())
    await client.post(
        "/api/v1/meetings",
        json=meeting_payload
        | {
            "name": "Late night sync",
            "starts_at": _iso(start + timedelta(hours=23)),
            "ends_at": _iso(start + timedelta(hours=24, minutes=30)),
        },
    )

    today_body = (await client.get("/api/v1/meetings")).json()
    tomorrow = (today() + timedelta(days=1)).isoformat()
    tomorrow_body = (await client.get("/api/v1/meetings", params={"date": tomorrow})).json()

    assert "Late night sync" in [item["name"] for item in today_body["items"]]
    assert "Late night sync" in [item["name"] for item in tomorrow_body["items"]]


async def test_results_are_sorted_by_start_time(client, meeting_payload):
    start, _ = day_window(today())
    for name, hour in [("Late", 16), ("Early", 9), ("Midday", 12)]:
        await client.post(
            "/api/v1/meetings",
            json=meeting_payload
            | {
                "name": name,
                "starts_at": _iso(start + timedelta(hours=hour)),
                "ends_at": _iso(start + timedelta(hours=hour + 1)),
                "participants": [],
            },
        )

    body = (await client.get("/api/v1/meetings")).json()

    assert [item["name"] for item in body["items"]] == ["Early", "Midday", "Late"]


async def test_search_filters_by_name_and_description(client, meeting_payload):
    start, _ = day_window(today())
    await client.post(
        "/api/v1/meetings",
        json=meeting_payload | {"name": "Retrospective", "description": "Look back at the sprint"},
    )
    await client.post(
        "/api/v1/meetings",
        json=meeting_payload
        | {
            "name": "Budget call",
            "description": "Numbers",
            "starts_at": _iso(start + timedelta(hours=15)),
            "ends_at": _iso(start + timedelta(hours=16)),
            "participants": [],
        },
    )

    body = (await client.get("/api/v1/meetings", params={"q": "retro"})).json()

    assert [item["name"] for item in body["items"]] == ["Retrospective"]


def test_day_window_spans_exactly_one_day_in_app_timezone():
    start, end = day_window(today())

    assert start.tzinfo is not None
    assert str(start.tzinfo) == settings.app_timezone
    assert end - start == timedelta(days=1)
    assert start.hour == 0 and start.minute == 0
