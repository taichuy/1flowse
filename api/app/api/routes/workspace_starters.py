from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.workspace_starter import WorkspaceStarterTemplateRecord
from app.schemas.workspace_starter import (
    WorkspaceStarterTemplateCreate,
    WorkspaceStarterTemplateItem,
    WorkspaceStarterTemplateUpdate,
)
from app.services.workflow_definitions import WorkflowDefinitionValidationError
from app.services.workspace_starter_templates import (
    get_workspace_starter_template_service,
)

router = APIRouter(prefix="/workspace-starters", tags=["workspace-starters"])


@router.get("", response_model=list[WorkspaceStarterTemplateItem])
def list_workspace_starters(
    workspace_id: str = Query(default="default", min_length=1, max_length=64),
    db: Session = Depends(get_db),
) -> list[WorkspaceStarterTemplateItem]:
    service = get_workspace_starter_template_service()
    records = service.list_templates(db, workspace_id=workspace_id)
    return [service.serialize(record) for record in records]


@router.post(
    "",
    response_model=WorkspaceStarterTemplateItem,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace_starter(
    payload: WorkspaceStarterTemplateCreate,
    db: Session = Depends(get_db),
) -> WorkspaceStarterTemplateItem:
    service = get_workspace_starter_template_service()
    try:
        record = service.create_template(db, payload)
    except WorkflowDefinitionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    db.commit()
    db.refresh(record)
    return service.serialize(record)


@router.put("/{template_id}", response_model=WorkspaceStarterTemplateItem)
def update_workspace_starter(
    template_id: str,
    payload: WorkspaceStarterTemplateUpdate,
    db: Session = Depends(get_db),
) -> WorkspaceStarterTemplateItem:
    service = get_workspace_starter_template_service()
    record = db.get(WorkspaceStarterTemplateRecord, template_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace starter template not found.",
        )

    try:
        service.update_template(record, payload)
    except WorkflowDefinitionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    db.add(record)
    db.commit()
    db.refresh(record)
    return service.serialize(record)
