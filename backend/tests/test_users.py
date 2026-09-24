"""The users table: created on demand, filled from the ID token, and owning meetings."""

from sqlalchemy import select

from app.models import User
from tests.tokens import make_id_token


async def test_me_creates_a_bare_row_on_first_call(client):
    response = await client.get("/api/v1/me")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == "user-a"
    assert body["email"] is None
    assert body["auth_provider"] == "cognito"
    assert body["last_login_at"] is None


async def test_sync_stores_the_profile_from_the_id_token(client, private_key):
    id_token = make_id_token(
        private_key,
        sub="user-a",
        email="ostap@example.com",
        email_verified="true",
        name="Ostap Dobosevych",
        given_name="Ostap",
        family_name="Dobosevych",
        picture="https://example.com/ostap.png",
        identities=[{"providerName": "Google", "userId": "123"}],
    )

    response = await client.post("/api/v1/me/sync", json={"id_token": id_token})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == "ostap@example.com"
    assert body["email_verified"] is True
    assert body["name"] == "Ostap Dobosevych"
    assert body["given_name"] == "Ostap"
    assert body["picture_url"] == "https://example.com/ostap.png"
    assert body["auth_provider"] == "google"
    assert body["last_login_at"] is not None
    assert (await client.get("/api/v1/me")).json()["email"] == "ostap@example.com"


async def test_sync_again_updates_the_profile(client, private_key):
    first = make_id_token(private_key, sub="user-a", email="old@example.com")
    second = make_id_token(private_key, sub="user-a", email="new@example.com", email_verified=True)

    await client.post("/api/v1/me/sync", json={"id_token": first})
    body = (await client.post("/api/v1/me/sync", json={"id_token": second})).json()

    assert body["email"] == "new@example.com"
    assert body["email_verified"] is True
    assert body["auth_provider"] == "cognito"


async def test_sync_rejects_another_users_id_token(client, private_key):
    id_token = make_id_token(private_key, sub="user-b", email="intruder@example.com")

    response = await client.post("/api/v1/me/sync", json={"id_token": id_token})

    assert response.status_code == 401
    assert "another user" in response.json()["error"]["message"]


async def test_sync_rejects_an_access_token(client, private_key):
    from tests.tokens import make_token

    response = await client.post(
        "/api/v1/me/sync", json={"id_token": make_token(private_key, sub="user-a")}
    )

    assert response.status_code == 401


async def test_creating_a_meeting_creates_its_owner(client, session, meeting_payload):
    await client.post("/api/v1/meetings", json=meeting_payload)

    users = (await session.scalars(select(User))).all()
    assert [user.id for user in users] == ["user-a"]


async def test_me_needs_a_token(anonymous_client):
    assert (await anonymous_client.get("/api/v1/me")).status_code == 401
