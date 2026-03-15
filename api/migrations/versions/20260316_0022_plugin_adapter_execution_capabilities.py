"""add plugin adapter execution capability declarations

Revision ID: 20260316_0022
Revises: 20260315_0021
"""

import sqlalchemy as sa
from alembic import op

revision = "20260316_0022"
down_revision = "20260315_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    plugin_adapters = sa.table(
        "plugin_adapters",
        sa.column("supported_execution_classes", sa.JSON()),
    )
    op.add_column(
        "plugin_adapters",
        sa.Column(
            "supported_execution_classes",
            sa.JSON(),
            nullable=True,
        ),
    )
    op.execute(
        plugin_adapters.update().values(supported_execution_classes=["subprocess"])
    )
    op.alter_column(
        "plugin_adapters",
        "supported_execution_classes",
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("plugin_adapters", "supported_execution_classes")
