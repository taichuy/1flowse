"""add workflow publish endpoint lifecycle"""

import sqlalchemy as sa
from alembic import op

revision = "20260312_0011"
down_revision = "20260312_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workflow_published_endpoints",
        sa.Column(
            "lifecycle_status",
            sa.String(length=32),
            nullable=False,
            server_default="draft",
        ),
    )
    op.add_column(
        "workflow_published_endpoints",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "workflow_published_endpoints",
        sa.Column("unpublished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_workflow_published_endpoints_lifecycle_status",
        "workflow_published_endpoints",
        ["lifecycle_status"],
        unique=False,
    )
    op.alter_column(
        "workflow_published_endpoints",
        "lifecycle_status",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workflow_published_endpoints_lifecycle_status",
        table_name="workflow_published_endpoints",
    )
    op.drop_column("workflow_published_endpoints", "unpublished_at")
    op.drop_column("workflow_published_endpoints", "published_at")
    op.drop_column("workflow_published_endpoints", "lifecycle_status")
