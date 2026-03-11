"""add compiled workflow blueprints and bind runs to blueprint ids"""

import sqlalchemy as sa
from alembic import op

revision = "20260311_0009"
down_revision = "20260311_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_compiled_blueprints",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workflow_id", sa.String(length=36), nullable=False),
        sa.Column("workflow_version_id", sa.String(length=36), nullable=False),
        sa.Column("workflow_version", sa.String(length=32), nullable=False),
        sa.Column("compiler_version", sa.String(length=64), nullable=False),
        sa.Column("blueprint_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.ForeignKeyConstraint(["workflow_version_id"], ["workflow_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workflow_version_id",
            name="uq_workflow_compiled_blueprints_workflow_version",
        ),
    )
    op.create_index(
        "ix_workflow_compiled_blueprints_workflow_id",
        "workflow_compiled_blueprints",
        ["workflow_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_compiled_blueprints_workflow_version_id",
        "workflow_compiled_blueprints",
        ["workflow_version_id"],
        unique=False,
    )

    op.add_column(
        "runs",
        sa.Column("compiled_blueprint_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "ix_runs_compiled_blueprint_id",
        "runs",
        ["compiled_blueprint_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_runs_compiled_blueprint_id",
        "runs",
        "workflow_compiled_blueprints",
        ["compiled_blueprint_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_runs_compiled_blueprint_id", "runs", type_="foreignkey")
    op.drop_index("ix_runs_compiled_blueprint_id", table_name="runs")
    with op.batch_alter_table("runs") as batch_op:
        batch_op.drop_column("compiled_blueprint_id")

    op.drop_index(
        "ix_workflow_compiled_blueprints_workflow_version_id",
        table_name="workflow_compiled_blueprints",
    )
    op.drop_index(
        "ix_workflow_compiled_blueprints_workflow_id",
        table_name="workflow_compiled_blueprints",
    )
    op.drop_table("workflow_compiled_blueprints")
