"""add skill catalog

Revision ID: 20260317_0024
Revises: 20260317_0023
"""

import sqlalchemy as sa
from alembic import op

revision = "20260317_0024"
down_revision = "20260317_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "skills",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_skills_workspace_id"), "skills", ["workspace_id"], unique=False)

    op.create_table(
        "skill_references",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("skill_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("skill_id", "name", name="uq_skill_reference_skill_name"),
    )
    op.create_index(
        op.f("ix_skill_references_skill_id"),
        "skill_references",
        ["skill_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_skill_references_skill_id"), table_name="skill_references")
    op.drop_table("skill_references")
    op.drop_index(op.f("ix_skills_workspace_id"), table_name="skills")
    op.drop_table("skills")
