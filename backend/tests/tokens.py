"""Signing real RS256 tokens the way Cognito does, for a pool that only exists in tests."""

import json
import time

import jwt

from app.auth import CognitoVerifier

ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool"
CLIENT_ID = "test-client"
KID = "test-key"


def make_verifier(private_key) -> CognitoVerifier:
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    jwks = {"keys": [public_jwk | {"kid": KID, "alg": "RS256", "use": "sig"}]}
    return CognitoVerifier(ISSUER, CLIENT_ID, json.dumps(jwks))


def make_token(private_key, kid: str = KID, **overrides) -> str:
    """An access token by default. A None override drops that claim."""
    now = int(time.time())
    claims = {
        "sub": "user-123",
        "iss": ISSUER,
        "client_id": CLIENT_ID,
        "token_use": "access",
        "username": "someone",
        "iat": now,
        "exp": now + 3600,
    } | overrides
    claims = {key: value for key, value in claims.items() if value is not None}
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": kid})


def make_id_token(private_key, **overrides) -> str:
    """An ID token: named for the app client in "aud", with no "client_id"."""
    return make_token(
        private_key, **({"token_use": "id", "aud": CLIENT_ID, "client_id": None} | overrides)
    )
