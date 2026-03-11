"""add published endpoint api keys"""

import sqlalchemy as sa
from alembic import op

revision = "20260312_0012"
down_revision = "20260312_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_published_api_keys",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workflow_id", sa.String(length=36), nullable=False),
        sa.Column("endpoint_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("key_prefix", sa.String(length=24), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="active",
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "key_hash",
            name="uq_workflow_published_api_keys_key_hash",
        ),
    )
    op.create_index(
        "ix_workflow_published_api_keys_workflow_id",
        "workflow_published_api_keys",
        ["workflow_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_published_api_keys_endpoint_id",
        "workflow_published_api_keys",
        ["endpoint_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_published_api_keys_status",
        "workflow_published_api_keys",
        ["status"],
        unique=False,
    )
    op.alter_column(
        "workflow_published_api_keys",
        "status",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workflow_published_api_keys_status",
        table_name="workflow_published_api_keys",
    )
    op.drop_index(
        "ix_workflow_published_api_keys_endpoint_id",
        table_name="workflow_published_api_keys",
    )
    op.drop_index(
        "ix_workflow_published_api_keys_workflow_id",
        table_name="workflow_published_api_keys",
    )
    op.drop_table("workflow_published_api_keys")
