"""Token verification and per-user isolation of meetings."""

import time
import uuid

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth import AuthError
from tests.tokens import make_id_token, make_token


def _token(private_key, **overrides) -> str:
    return make_token(private_key, **overrides)


async def test_valid_access_token_yields_the_user(verifier, private_key):
    user = await verifier.verify(_token(private_key))

    assert user.sub == "user-123"
    assert user.username == "someone"


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"exp": int(time.time()) - 10}, "expired"),
        ({"token_use": "id"}, "access token is required"),
        ({"client_id": "someone-else"}, "another client"),
        ({"iss": "https://cognito-idp.us-east-1.amazonaws.com/other"}, "invalid"),
    ],
)
async def test_rejects_bad_claims(verifier, private_key, overrides, message):
    with pytest.raises(AuthError, match=message):
        await verifier.verify(_token(private_key, **overrides))


async def test_rejects_token_signed_by_another_key(verifier):
    stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with pytest.raises(AuthError, match="invalid"):
        await verifier.verify(_token(stranger))


async def test_rejects_unknown_key_id(verifier, private_key):
    with pytest.raises(AuthError, match="unknown key"):
        await verifier.verify(_token(private_key, kid="rotated-away"))


async def test_id_token_is_not_an_access_token(verifier, private_key):
    # Its "aud" claim already fails the check, before the token_use one.
    with pytest.raises(AuthError, match="invalid"):
        await verifier.verify(make_id_token(private_key))


async def test_id_token_for_another_client_is_rejected(verifier, private_key):
    with pytest.raises(AuthError, match="invalid"):
        await verifier.verify_id_token(make_id_token(private_key, aud="someone-else"))


async def test_rejects_garbage(verifier):
    with pytest.raises(AuthError, match="malformed"):
        await verifier.verify("not-a-jwt")


async def test_request_without_token_is_401(anonymous_client):
    response = await anonymous_client.get("/api/v1/meetings")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
    assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_valid_token_reaches_the_api(anonymous_client, private_key):
    headers = {"Authorization": f"Bearer {make_token(private_key, sub='user-z')}"}

    response = await anonymous_client.get("/api/v1/me", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["id"] == "user-z"


async def test_health_needs_no_token(anonymous_client):
    assert (await anonymous_client.get("/health")).status_code == 200


async def test_users_only_see_their_own_meetings(client, other_client, meeting_payload):
    created = (await client.post("/api/v1/meetings", json=meeting_payload)).json()
    path = f"/api/v1/meetings/{created['id']}"
    date = meeting_payload["starts_at"][:10]

    theirs = (await other_client.get("/api/v1/meetings", params={"date": date})).json()
    assert theirs["items"] == []
    assert (await other_client.get(path)).status_code == 404
    assert (await other_client.put(path, json=meeting_payload)).status_code == 404
    assert (await other_client.delete(path)).status_code == 404

    # Still there, untouched, for its owner.
    mine = (await client.get("/api/v1/meetings", params={"date": date})).json()["items"]
    assert [item["id"] for item in mine] == [created["id"]]


async def test_unknown_id_is_404_for_everyone(other_client):
    assert (await other_client.get(f"/api/v1/meetings/{uuid.uuid4()}")).status_code == 404
