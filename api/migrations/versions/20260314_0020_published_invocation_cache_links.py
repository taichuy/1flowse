"""add published invocation cache links

Revision ID: 20260314_0020
Revises: 20260314_0019
"""

import sqlalchemy as sa
from alembic import op

revision = "20260314_0020"
down_revision = "20260314_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workflow_published_invocations",
        sa.Column("cache_key", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "workflow_published_invocations",
        sa.Column("cache_entry_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        op.f("ix_workflow_published_invocations_cache_key"),
        "workflow_published_invocations",
        ["cache_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workflow_published_invocations_cache_entry_id"),
        "workflow_published_invocations",
        ["cache_entry_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_workflow_published_invocations_cache_entry_id"),
        table_name="workflow_published_invocations",
    )
    op.drop_index(
        op.f("ix_workflow_published_invocations_cache_key"),
        table_name="workflow_published_invocations",
    )
    op.drop_column("workflow_published_invocations", "cache_entry_id")
    op.drop_column("workflow_published_invocations", "cache_key")
