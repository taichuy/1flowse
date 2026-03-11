"""persist workflow published endpoint bindings"""

import sqlalchemy as sa
from alembic import op

revision = "20260312_0010"
down_revision = "20260311_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_published_endpoints",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workflow_id", sa.String(length=36), nullable=False),
        sa.Column("workflow_version_id", sa.String(length=36), nullable=False),
        sa.Column("workflow_version", sa.String(length=32), nullable=False),
        sa.Column("target_workflow_version_id", sa.String(length=36), nullable=False),
        sa.Column("target_workflow_version", sa.String(length=32), nullable=False),
        sa.Column("compiled_blueprint_id", sa.String(length=36), nullable=False),
        sa.Column("endpoint_id", sa.String(length=64), nullable=False),
        sa.Column("endpoint_name", sa.String(length=128), nullable=False),
        sa.Column("protocol", sa.String(length=32), nullable=False),
        sa.Column("auth_mode", sa.String(length=32), nullable=False),
        sa.Column("streaming", sa.Boolean(), nullable=False),
        sa.Column("input_schema", sa.JSON(), nullable=False),
        sa.Column("output_schema", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["compiled_blueprint_id"], ["workflow_compiled_blueprints.id"]),
        sa.ForeignKeyConstraint(["target_workflow_version_id"], ["workflow_versions.id"]),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.ForeignKeyConstraint(["workflow_version_id"], ["workflow_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workflow_version_id",
            "endpoint_id",
            name="uq_workflow_published_endpoints_version_endpoint",
        ),
    )
    op.create_index(
        "ix_workflow_published_endpoints_workflow_id",
        "workflow_published_endpoints",
        ["workflow_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_published_endpoints_workflow_version_id",
        "workflow_published_endpoints",
        ["workflow_version_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_published_endpoints_target_workflow_version_id",
        "workflow_published_endpoints",
        ["target_workflow_version_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_published_endpoints_compiled_blueprint_id",
        "workflow_published_endpoints",
        ["compiled_blueprint_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workflow_published_endpoints_compiled_blueprint_id",
        table_name="workflow_published_endpoints",
    )
    op.drop_index(
        "ix_workflow_published_endpoints_target_workflow_version_id",
        table_name="workflow_published_endpoints",
    )
    op.drop_index(
        "ix_workflow_published_endpoints_workflow_version_id",
        table_name="workflow_published_endpoints",
    )
    op.drop_index(
        "ix_workflow_published_endpoints_workflow_id",
        table_name="workflow_published_endpoints",
    )
    op.drop_table("workflow_published_endpoints")
