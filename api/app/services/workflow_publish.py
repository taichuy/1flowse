from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import WorkflowPublishedEndpoint, WorkflowVersion
from app.schemas.workflow import WorkflowPublishedEndpointDefinition
from app.services.compiled_blueprints import CompiledBlueprintService


class WorkflowPublishBindingError(ValueError):
    pass


class WorkflowPublishBindingService:
    def __init__(
        self,
        compiled_blueprint_service: CompiledBlueprintService | None = None,
    ) -> None:
        self._compiled_blueprint_service = (
            compiled_blueprint_service or CompiledBlueprintService()
        )

    def ensure_for_workflow_version(
        self,
        db: Session,
        workflow_version: WorkflowVersion,
    ) -> list[WorkflowPublishedEndpoint]:
        definition = workflow_version.definition or {}
        publish_definitions = [
            WorkflowPublishedEndpointDefinition.model_validate(item)
            for item in definition.get("publish") or []
        ]
        existing_records = db.scalars(
            select(WorkflowPublishedEndpoint).where(
                WorkflowPublishedEndpoint.workflow_version_id == workflow_version.id
            )
        ).all()
        existing_by_endpoint_id = {
            record.endpoint_id: record for record in existing_records
        }

        synced_records: list[WorkflowPublishedEndpoint] = []
        seen_endpoint_ids: set[str] = set()
        for endpoint in publish_definitions:
            target_version_value = endpoint.workflowVersion or workflow_version.version
            target_version = db.scalar(
                select(WorkflowVersion).where(
                    WorkflowVersion.workflow_id == workflow_version.workflow_id,
                    WorkflowVersion.version == target_version_value,
                )
            )
            if target_version is None:
                raise WorkflowPublishBindingError(
                    "Published endpoint "
                    f"'{endpoint.id}' references unknown workflow version "
                    f"'{target_version_value}'."
                )

            compiled_blueprint = self._compiled_blueprint_service.ensure_for_workflow_version(
                db,
                target_version,
            )
            record = existing_by_endpoint_id.get(endpoint.id)
            if record is None:
                record = WorkflowPublishedEndpoint(
                    id=str(uuid4()),
                    workflow_id=workflow_version.workflow_id,
                    workflow_version_id=workflow_version.id,
                    workflow_version=workflow_version.version,
                    target_workflow_version_id=target_version.id,
                    target_workflow_version=target_version.version,
                    compiled_blueprint_id=compiled_blueprint.id,
                    endpoint_id=endpoint.id,
                    endpoint_name=endpoint.name,
                    protocol=endpoint.protocol,
                    auth_mode=endpoint.authMode,
                    streaming=endpoint.streaming,
                    input_schema=endpoint.inputSchema,
                    output_schema=endpoint.outputSchema,
                )
            else:
                record.workflow_id = workflow_version.workflow_id
                record.workflow_version_id = workflow_version.id
                record.workflow_version = workflow_version.version
                record.target_workflow_version_id = target_version.id
                record.target_workflow_version = target_version.version
                record.compiled_blueprint_id = compiled_blueprint.id
                record.endpoint_name = endpoint.name
                record.protocol = endpoint.protocol
                record.auth_mode = endpoint.authMode
                record.streaming = endpoint.streaming
                record.input_schema = endpoint.inputSchema
                record.output_schema = endpoint.outputSchema

            db.add(record)
            synced_records.append(record)
            seen_endpoint_ids.add(endpoint.id)

        for record in existing_records:
            if record.endpoint_id not in seen_endpoint_ids:
                db.delete(record)

        return synced_records

    def list_for_workflow(
        self,
        db: Session,
        workflow_id: str,
        *,
        workflow_version: str | None = None,
    ) -> list[WorkflowPublishedEndpoint]:
        statement = (
            select(WorkflowPublishedEndpoint)
            .where(WorkflowPublishedEndpoint.workflow_id == workflow_id)
            .order_by(
                WorkflowPublishedEndpoint.workflow_version.desc(),
                WorkflowPublishedEndpoint.endpoint_name.asc(),
            )
        )
        if workflow_version is not None:
            statement = statement.where(
                WorkflowPublishedEndpoint.workflow_version == workflow_version
            )
        return db.scalars(statement).all()
