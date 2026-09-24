"""Cognito access-token verification and the current-user dependency."""

import asyncio
import base64
import binascii
import json
import logging
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger("meetings.auth")


class AuthError(Exception):
    """The request carries no valid access token."""


class AuthNotConfiguredError(Exception):
    """The server has no Cognito user pool to check tokens against."""


@dataclass(frozen=True)
class CurrentUser:
    # Cognito's stable user id; meetings are owned by it.
    sub: str
    username: str | None = None


def _parse_jwks(raw: str) -> dict[str, Any]:
    """Accept the JWKS document as JSON or as base64-encoded JSON."""
    text = raw.strip()
    if not text.startswith("{"):
        try:
            text = base64.b64decode(text).decode()
        except (binascii.Error, UnicodeDecodeError) as exc:
            raise ValueError("COGNITO_JWKS is neither JSON nor base64-encoded JSON") from exc
    return json.loads(text)


class CognitoVerifier:
    def __init__(
        self,
        issuer: str,
        client_id: str,
        jwks: str = "",
        fetch_timeout: float = 5.0,
    ) -> None:
        self.issuer = issuer
        self.client_id = client_id
        self._static_jwks = jwks
        self._fetch_timeout = fetch_timeout
        self._keys: jwt.PyJWKSet | None = None
        self._lock = asyncio.Lock()

    def _fetch_jwks(self) -> dict[str, Any]:
        url = f"{self.issuer}/.well-known/jwks.json"
        with urllib.request.urlopen(url, timeout=self._fetch_timeout) as response:
            return json.load(response)

    async def _load_keys(self, refresh: bool = False) -> jwt.PyJWKSet:
        async with self._lock:
            if self._keys is None or refresh:
                if self._static_jwks:
                    document = _parse_jwks(self._static_jwks)
                else:
                    document = await asyncio.to_thread(self._fetch_jwks)
                self._keys = jwt.PyJWKSet.from_dict(document)
            return self._keys

    async def _signing_key(self, kid: str) -> jwt.PyJWK:
        keys = await self._load_keys()
        for key in keys.keys:
            if key.key_id == kid:
                return key
        # Cognito may have rotated its keys since they were fetched.
        if not self._static_jwks:
            for key in (await self._load_keys(refresh=True)).keys:
                if key.key_id == kid:
                    return key
        raise AuthError("The token was signed with an unknown key.")

    async def _claims(self, token: str, token_use: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise AuthError("The token is malformed.") from exc

        key = await self._signing_key(header.get("kid", ""))
        try:
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self.issuer,
                # ID tokens name the app client in "aud"; access tokens have no
                # "aud" and carry it in "client_id" instead (checked below).
                audience=self.client_id if token_use == "id" else None,
                options={"require": ["exp", "iat", "iss", "sub", "token_use"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("The token has expired.") from exc
        except jwt.PyJWTError as exc:
            raise AuthError("The token is invalid.") from exc

        # Both kinds are signed by the same keys, so check which one this is.
        if claims["token_use"] != token_use:
            raise AuthError(f"An {'ID' if token_use == 'id' else 'access'} token is required.")
        if token_use == "access" and claims.get("client_id") != self.client_id:
            raise AuthError("The access token was issued to another client.")
        return claims

    async def verify(self, token: str) -> CurrentUser:
        """Check an access token, the only kind the API accepts for requests."""
        claims = await self._claims(token, "access")
        return CurrentUser(sub=claims["sub"], username=claims.get("username"))

    async def verify_id_token(self, token: str) -> dict[str, Any]:
        """Check an ID token and return its claims (the user's profile)."""
        return await self._claims(token, "id")


@lru_cache
def get_verifier() -> CognitoVerifier:
    if not settings.cognito_user_pool_id or not settings.cognito_client_id:
        raise AuthNotConfiguredError()
    return CognitoVerifier(
        settings.cognito_issuer, settings.cognito_client_id, settings.cognito_jwks
    )


_bearer = HTTPBearer(auto_error=False)


VerifierDep = Annotated[CognitoVerifier, Depends(get_verifier)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: VerifierDep,
) -> CurrentUser:
    if credentials is None:
        raise AuthError("Sign in to continue.")
    return await verifier.verify(credentials.credentials)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
