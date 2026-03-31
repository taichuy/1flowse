"""persist workspace model provider configs

Revision ID: 20260331_0030
Revises: 20260327_0029
"""

import sqlalchemy as sa
from alembic import op

revision = "20260331_0030"
down_revision = "20260327_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_model_provider_configs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("provider_id", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=False),
        sa.Column("credential_id", sa.String(length=36), nullable=False),
        sa.Column("base_url", sa.String(length=512), nullable=False),
        sa.Column("default_model", sa.String(length=128), nullable=False),
        sa.Column("protocol", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "supported_model_types",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["credential_id"], ["credentials.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_workspace_model_provider_configs_workspace_id",
        "workspace_model_provider_configs",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        "ix_workspace_model_provider_configs_provider_id",
        "workspace_model_provider_configs",
        ["provider_id"],
        unique=False,
    )
    op.create_index(
        "ix_workspace_model_provider_configs_credential_id",
        "workspace_model_provider_configs",
        ["credential_id"],
        unique=False,
    )
    op.create_index(
        "ix_workspace_model_provider_configs_status",
        "workspace_model_provider_configs",
        ["status"],
        unique=False,
    )
    op.alter_column(
        "workspace_model_provider_configs",
        "supported_model_types",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workspace_model_provider_configs_status",
        table_name="workspace_model_provider_configs",
    )
    op.drop_index(
        "ix_workspace_model_provider_configs_credential_id",
        table_name="workspace_model_provider_configs",
    )
    op.drop_index(
        "ix_workspace_model_provider_configs_provider_id",
        table_name="workspace_model_provider_configs",
    )
    op.drop_index(
        "ix_workspace_model_provider_configs_workspace_id",
        table_name="workspace_model_provider_configs",
    )
    op.drop_table("workspace_model_provider_configs")
