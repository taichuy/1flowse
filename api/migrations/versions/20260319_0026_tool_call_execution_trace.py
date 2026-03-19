"""persist tool call execution trace

Revision ID: 20260319_0026
Revises: 20260318_0025
"""

import sqlalchemy as sa
from alembic import op

revision = "20260319_0026"
down_revision = "20260318_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tool_call_records",
        sa.Column(
            "execution_trace",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tool_call_records", "execution_trace")
