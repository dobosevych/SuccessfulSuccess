"""users (one per Cognito account) and the owner of every meeting

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-24
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("given_name", sa.String(200), nullable=True),
        sa.Column("family_name", sa.String(200), nullable=True),
        sa.Column("picture_url", sa.String(2048), nullable=True),
        sa.Column("auth_provider", sa.String(32), nullable=False, server_default="cognito"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Nullable so existing meetings survive; with no owner they are visible to nobody.
    op.add_column(
        "meetings",
        sa.Column(
            "owner_id",
            sa.String(128),
            sa.ForeignKey("users.id", name="meetings_owner_id_fkey", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_meetings_owner_id_starts_at", "meetings", ["owner_id", "starts_at"])


def downgrade() -> None:
    op.drop_index("ix_meetings_owner_id_starts_at", table_name="meetings")
    op.drop_column("meetings", "owner_id")
    op.drop_table("users")
