"""A single error envelope for every non-2xx response."""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.meeting import MeetingNotFoundError

HTTP_422_UNPROCESSABLE = 422

_STATUS_CODES = {
    status.HTTP_404_NOT_FOUND: "not_found",
    HTTP_422_UNPROCESSABLE: "validation_error",
    status.HTTP_503_SERVICE_UNAVAILABLE: "service_unavailable",
}


def error_response(
    status_code: int,
    message: str,
    code: str | None = None,
    details: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code or _STATUS_CODES.get(status_code, "internal_error"),
                "message": message,
                "details": details or [],
            }
        },
    )


def _clean_message(message: str) -> str:
    """Pydantic prefixes custom validator errors with "Value error, "."""
    return message.removeprefix("Value error, ")


def _field_path(location: tuple[Any, ...]) -> str:
    """Turn ('body', 'participants', 0, 'name') into 'participants.0.name'."""
    parts = [str(part) for part in location if part not in ("body", "query", "path")]
    return ".".join(parts)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(MeetingNotFoundError)
    async def _not_found(_: Request, exc: MeetingNotFoundError) -> JSONResponse:
        return error_response(status.HTTP_404_NOT_FOUND, str(exc))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"field": _field_path(error["loc"]), "message": _clean_message(error["msg"])}
            for error in exc.errors()
        ]
        message = details[0]["message"] if details else "The request payload is invalid."
        return error_response(HTTP_422_UNPROCESSABLE, message, details=details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return error_response(exc.status_code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected error occurred."
        )
