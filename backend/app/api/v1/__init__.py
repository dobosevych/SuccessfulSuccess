from fastapi import APIRouter

from app.api.v1.meetings import router as meetings_router
from app.api.v1.users import router as users_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(meetings_router)
api_router.include_router(users_router)

__all__ = ["api_router"]
