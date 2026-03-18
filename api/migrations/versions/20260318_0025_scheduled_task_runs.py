"""add scheduled task runs

Revision ID: 20260318_0025
Revises: 20260317_0024
"""

import sqlalchemy as sa
from alembic import op

revision = "20260318_0025"
down_revision = "20260317_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduled_task_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("task_name", sa.String(length=128), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("matched_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("affected_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("summary_payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_scheduled_task_runs_task_name"),
        "scheduled_task_runs",
        ["task_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scheduled_task_runs_status"),
        "scheduled_task_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scheduled_task_runs_started_at"),
        "scheduled_task_runs",
        ["started_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scheduled_task_runs_finished_at"),
        "scheduled_task_runs",
        ["finished_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_scheduled_task_runs_finished_at"), table_name="scheduled_task_runs")
    op.drop_index(op.f("ix_scheduled_task_runs_started_at"), table_name="scheduled_task_runs")
    op.drop_index(op.f("ix_scheduled_task_runs_status"), table_name="scheduled_task_runs")
    op.drop_index(op.f("ix_scheduled_task_runs_task_name"), table_name="scheduled_task_runs")
    op.drop_table("scheduled_task_runs")
