"""add callback ticket expiry columns"""

import sqlalchemy as sa
from alembic import op

revision = "20260312_0015"
down_revision = "20260312_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "run_callback_tickets",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "run_callback_tickets",
        sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_run_callback_tickets_expires_at",
        "run_callback_tickets",
        ["expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_run_callback_tickets_expires_at", table_name="run_callback_tickets")
    op.drop_column("run_callback_tickets", "expired_at")
    op.drop_column("run_callback_tickets", "expires_at")
