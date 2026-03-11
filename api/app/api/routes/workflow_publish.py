from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.workflow import Workflow
from app.schemas.workflow_publish import WorkflowPublishedEndpointItem
from app.services.workflow_publish import WorkflowPublishBindingService

router = APIRouter(prefix="/workflows", tags=["workflow-publish"])
workflow_publish_service = WorkflowPublishBindingService()


@router.get(
    "/{workflow_id}/published-endpoints",
    response_model=list[WorkflowPublishedEndpointItem],
)
def list_workflow_published_endpoints(
    workflow_id: str,
    workflow_version: str | None = Query(default=None, min_length=1, max_length=32),
    include_all_versions: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[WorkflowPublishedEndpointItem]:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    effective_version = workflow_version
    if effective_version is None and not include_all_versions:
        effective_version = workflow.version

    records = workflow_publish_service.list_for_workflow(
        db,
        workflow_id,
        workflow_version=effective_version,
    )
    return [
        WorkflowPublishedEndpointItem(
            id=record.id,
            workflow_id=record.workflow_id,
            workflow_version_id=record.workflow_version_id,
            workflow_version=record.workflow_version,
            target_workflow_version_id=record.target_workflow_version_id,
            target_workflow_version=record.target_workflow_version,
            compiled_blueprint_id=record.compiled_blueprint_id,
            endpoint_id=record.endpoint_id,
            endpoint_name=record.endpoint_name,
            protocol=record.protocol,
            auth_mode=record.auth_mode,
            streaming=record.streaming,
            input_schema=record.input_schema,
            output_schema=record.output_schema,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )
        for record in records
    ]
