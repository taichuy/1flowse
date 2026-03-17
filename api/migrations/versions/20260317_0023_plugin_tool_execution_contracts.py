"""persist plugin tool execution contracts

Revision ID: 20260317_0023
Revises: 20260316_0022
"""

import sqlalchemy as sa
from alembic import op

revision = "20260317_0023"
down_revision = "20260316_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    plugin_tools = sa.table(
        "plugin_tools",
        sa.column("ecosystem", sa.String()),
        sa.column("supported_execution_classes", sa.JSON()),
        sa.column("default_execution_class", sa.String()),
    )
    op.add_column(
        "plugin_tools",
        sa.Column(
            "supported_execution_classes",
            sa.JSON(),
            nullable=True,
        ),
    )
    op.add_column(
        "plugin_tools",
        sa.Column(
            "default_execution_class",
            sa.String(length=32),
            nullable=True,
        ),
    )
    op.execute(
        plugin_tools.update()
        .where(plugin_tools.c.ecosystem == "native")
        .values(supported_execution_classes=["inline"])
    )
    op.execute(
        plugin_tools.update()
        .where(plugin_tools.c.ecosystem != "native")
        .values(supported_execution_classes=[])
    )
    op.alter_column(
        "plugin_tools",
        "supported_execution_classes",
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("plugin_tools", "default_execution_class")
    op.drop_column("plugin_tools", "supported_execution_classes")
