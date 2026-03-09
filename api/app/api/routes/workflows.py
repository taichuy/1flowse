from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.workflow import Workflow, WorkflowVersion
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowDetail,
    WorkflowListItem,
    WorkflowUpdate,
    WorkflowVersionItem,
)
from app.services.workflow_definitions import (
    WorkflowDefinitionValidationError,
    bump_workflow_version,
    validate_workflow_definition,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _serialize_workflow_detail(
    workflow: Workflow,
    versions: list[WorkflowVersion],
) -> WorkflowDetail:
    return WorkflowDetail(
        id=workflow.id,
        name=workflow.name,
        version=workflow.version,
        status=workflow.status,
        definition=workflow.definition,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        versions=[
            WorkflowVersionItem(
                id=version.id,
                workflow_id=version.workflow_id,
                version=version.version,
                created_at=version.created_at,
            )
            for version in versions
        ],
    )


@router.get("", response_model=list[WorkflowListItem])
def list_workflows(db: Session = Depends(get_db)) -> list[WorkflowListItem]:
    items = db.scalars(select(Workflow).order_by(Workflow.name.asc())).all()
    return [
        WorkflowListItem(
            id=item.id,
            name=item.name,
            version=item.version,
            status=item.status,
        )
        for item in items
    ]


@router.post("", response_model=WorkflowDetail, status_code=status.HTTP_201_CREATED)
def create_workflow(payload: WorkflowCreate, db: Session = Depends(get_db)) -> WorkflowDetail:
    try:
        definition = validate_workflow_definition(payload.definition)
    except WorkflowDefinitionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    workflow = Workflow(
        id=str(uuid4()),
        name=payload.name,
        version="0.1.0",
        status="draft",
        definition=definition,
    )
    workflow_version = WorkflowVersion(
        id=str(uuid4()),
        workflow_id=workflow.id,
        version=workflow.version,
        definition=definition,
    )
    db.add(workflow)
    db.add(workflow_version)
    db.commit()
    db.refresh(workflow)
    db.refresh(workflow_version)
    return _serialize_workflow_detail(workflow, [workflow_version])


@router.get("/{workflow_id}", response_model=WorkflowDetail)
def get_workflow(workflow_id: str, db: Session = Depends(get_db)) -> WorkflowDetail:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")
    versions = db.scalars(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.created_at.desc())
    ).all()
    return _serialize_workflow_detail(workflow, versions)


@router.put("/{workflow_id}", response_model=WorkflowDetail)
def update_workflow(
    workflow_id: str,
    payload: WorkflowUpdate,
    db: Session = Depends(get_db),
) -> WorkflowDetail:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    if payload.name is not None:
        workflow.name = payload.name

    if payload.definition is not None:
        try:
            definition = validate_workflow_definition(payload.definition)
        except WorkflowDefinitionValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

        workflow.version = bump_workflow_version(workflow.version)
        workflow.definition = definition
        db.add(
            WorkflowVersion(
                id=str(uuid4()),
                workflow_id=workflow.id,
                version=workflow.version,
                definition=definition,
            )
        )

    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    versions = db.scalars(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.created_at.desc())
    ).all()
    return _serialize_workflow_detail(workflow, versions)


@router.get("/{workflow_id}/versions", response_model=list[WorkflowVersionItem])
def list_workflow_versions(
    workflow_id: str,
    db: Session = Depends(get_db),
) -> list[WorkflowVersionItem]:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    versions = db.scalars(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.created_at.desc())
    ).all()
    return [
        WorkflowVersionItem(
            id=version.id,
            workflow_id=version.workflow_id,
            version=version.version,
            created_at=version.created_at,
        )
        for version in versions
    ]
