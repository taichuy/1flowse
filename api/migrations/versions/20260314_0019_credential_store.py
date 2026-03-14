"""add credential store

Revision ID: 20260314_0019
Revises: 20260312_0018
"""

import sqlalchemy as sa
from alembic import op

revision = "20260314_0019"
down_revision = "20260312_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credentials",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("credential_type", sa.String(length=64), nullable=False),
        sa.Column("encrypted_data", sa.Text(), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_credentials_credential_type", "credentials", ["credential_type"], unique=False
    )
    op.create_index("ix_credentials_status", "credentials", ["status"], unique=False)
    op.alter_column("credentials", "description", server_default=None)
    op.alter_column("credentials", "status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_credentials_status", table_name="credentials")
    op.drop_index("ix_credentials_credential_type", table_name="credentials")
    op.drop_table("credentials")
