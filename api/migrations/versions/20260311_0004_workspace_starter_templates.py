"""add workspace starter template persistence"""

import sqlalchemy as sa
from alembic import op

revision = "20260311_0004"
down_revision = "20260310_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_starter_templates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("business_track", sa.String(length=64), nullable=False),
        sa.Column("default_workflow_name", sa.String(length=128), nullable=False),
        sa.Column("workflow_focus", sa.Text(), nullable=False),
        sa.Column("recommended_next_step", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("created_from_workflow_id", sa.String(length=36), nullable=True),
        sa.Column("created_from_workflow_version", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_workspace_starter_templates_workspace_id",
        "workspace_starter_templates",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        "ix_workspace_starter_templates_business_track",
        "workspace_starter_templates",
        ["business_track"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workspace_starter_templates_business_track",
        table_name="workspace_starter_templates",
    )
    op.drop_index(
        "ix_workspace_starter_templates_workspace_id",
        table_name="workspace_starter_templates",
    )
    op.drop_table("workspace_starter_templates")
