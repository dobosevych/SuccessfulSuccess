"""The signed-in user's own profile."""

from fastapi import APIRouter

from app.api.deps import UserServiceDep
from app.auth import AuthError, CurrentUserDep, VerifierDep
from app.schemas import UserRead, UserSync

router = APIRouter(prefix="/me", tags=["users"])


@router.get("", response_model=UserRead, summary="The signed-in user's profile")
async def read_me(user: CurrentUserDep, service: UserServiceDep) -> UserRead:
    return UserRead.model_validate(await service.get_or_create(user.sub))


@router.post(
    "/sync",
    response_model=UserRead,
    summary="Store the profile from the user's ID token (called after each sign-in)",
    responses={401: {"description": "Invalid ID token, or one for another user"}},
)
async def sync_me(
    payload: UserSync, user: CurrentUserDep, verifier: VerifierDep, service: UserServiceDep
) -> UserRead:
    # Access tokens carry no profile, so the client sends its ID token too. It
    # must verify on its own and belong to the same user as the access token.
    claims = await verifier.verify_id_token(payload.id_token)
    if claims["sub"] != user.sub:
        raise AuthError("The ID token belongs to another user.")
    return UserRead.model_validate(await service.sync(user.sub, claims))
