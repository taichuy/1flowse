"""add workflow versions and run workflow version"""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "20260309_0002"
down_revision = "20260309_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_versions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workflow_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workflow_id",
            "version",
            name="uq_workflow_versions_workflow_version",
        ),
    )
    op.create_index(
        "ix_workflow_versions_workflow_id",
        "workflow_versions",
        ["workflow_id"],
        unique=False,
    )

    op.add_column(
        "runs",
        sa.Column("workflow_version", sa.String(length=32), nullable=True),
    )

    connection = op.get_bind()
    workflows = sa.table(
        "workflows",
        sa.column("id", sa.String(length=36)),
        sa.column("version", sa.String(length=32)),
        sa.column("definition", sa.JSON()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    runs = sa.table(
        "runs",
        sa.column("id", sa.String(length=36)),
        sa.column("workflow_id", sa.String(length=36)),
        sa.column("workflow_version", sa.String(length=32)),
    )
    workflow_versions = sa.table(
        "workflow_versions",
        sa.column("id", sa.String(length=36)),
        sa.column("workflow_id", sa.String(length=36)),
        sa.column("version", sa.String(length=32)),
        sa.column("definition", sa.JSON()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )

    workflow_rows = connection.execute(
        sa.select(
            workflows.c.id,
            workflows.c.version,
            workflows.c.definition,
            workflows.c.created_at,
        )
    ).mappings()
    workflow_versions_by_id = {}
    version_rows = []
    for workflow_row in workflow_rows:
        workflow_versions_by_id[workflow_row["id"]] = workflow_row["version"]
        version_rows.append(
            {
                "id": str(uuid4()),
                "workflow_id": workflow_row["id"],
                "version": workflow_row["version"],
                "definition": workflow_row["definition"],
                "created_at": workflow_row["created_at"],
            }
        )

    if version_rows:
        connection.execute(sa.insert(workflow_versions), version_rows)

    run_rows = connection.execute(
        sa.select(runs.c.id, runs.c.workflow_id)
    ).mappings()
    for run_row in run_rows:
        workflow_version = workflow_versions_by_id.get(run_row["workflow_id"])
        if workflow_version is None:
            continue
        connection.execute(
            sa.update(runs)
            .where(runs.c.id == run_row["id"])
            .values(workflow_version=workflow_version)
        )

    with op.batch_alter_table("runs") as batch_op:
        batch_op.alter_column("workflow_version", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("runs") as batch_op:
        batch_op.drop_column("workflow_version")

    op.drop_index("ix_workflow_versions_workflow_id", table_name="workflow_versions")
    op.drop_table("workflow_versions")
