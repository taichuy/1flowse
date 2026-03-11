"""add workspace starter governance history"""

import sqlalchemy as sa
from alembic import op

revision = "20260311_0006"
down_revision = "20260311_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_starter_history",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("template_id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["workspace_starter_templates.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_workspace_starter_history_template_id",
        "workspace_starter_history",
        ["template_id"],
        unique=False,
    )
    op.create_index(
        "ix_workspace_starter_history_workspace_id",
        "workspace_starter_history",
        ["workspace_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workspace_starter_history_workspace_id",
        table_name="workspace_starter_history",
    )
    op.drop_index(
        "ix_workspace_starter_history_template_id",
        table_name="workspace_starter_history",
    )
    op.drop_table("workspace_starter_history")
