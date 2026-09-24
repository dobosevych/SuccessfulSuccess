"""ORM model for the people who sign in (one row per Cognito user)."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    # Cognito's `sub`: stable for the life of the account, unlike the email.
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    given_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    family_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    picture_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    # How they signed in: "cognito" (email + password) or "google".
    auth_provider: Mapped[str] = mapped_column(
        String(32), nullable=False, default="cognito", server_default="cognito"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
