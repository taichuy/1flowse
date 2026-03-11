from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.run import NodeRun, Run, RunEvent
from app.models.workflow import Workflow, WorkflowCompiledBlueprint, WorkflowVersion
from app.schemas.run import WorkflowRunListItem
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowDetail,
    WorkflowListItem,
    WorkflowUpdate,
    WorkflowVersionItem,
)
from app.services.compiled_blueprints import (
    CompiledBlueprintError,
    CompiledBlueprintService,
)
from app.services.workflow_definitions import (
    WorkflowDefinitionValidationError,
    bump_workflow_version,
    validate_workflow_definition,
)
from app.services.workflow_publish import (
    WorkflowPublishBindingError,
    WorkflowPublishBindingService,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])
compiled_blueprint_service = CompiledBlueprintService()
workflow_publish_service = WorkflowPublishBindingService(compiled_blueprint_service)


def _serialize_workflow_detail(
    workflow: Workflow,
    versions: list[WorkflowVersion],
    compiled_blueprints: dict[str, WorkflowCompiledBlueprint] | None = None,
) -> WorkflowDetail:
    compiled_blueprints = compiled_blueprints or {}
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
                compiled_blueprint_id=compiled_blueprints.get(version.id).id
                if compiled_blueprints.get(version.id) is not None
                else None,
                compiled_blueprint_compiler_version=compiled_blueprints.get(version.id).compiler_version
                if compiled_blueprints.get(version.id) is not None
                else None,
                compiled_blueprint_updated_at=compiled_blueprints.get(version.id).updated_at
                if compiled_blueprints.get(version.id) is not None
                else None,
            )
            for version in versions
        ],
    )


def _load_compiled_blueprint_lookup(
    db: Session,
    workflow_id: str,
) -> dict[str, WorkflowCompiledBlueprint]:
    records = db.scalars(
        select(WorkflowCompiledBlueprint).where(
            WorkflowCompiledBlueprint.workflow_id == workflow_id
        )
    ).all()
    return {record.workflow_version_id: record for record in records}


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
    db.flush()
    try:
        compiled_blueprint = compiled_blueprint_service.ensure_for_workflow_version(
            db,
            workflow_version,
        )
        db.flush()
        workflow_publish_service.ensure_for_workflow_version(db, workflow_version)
    except CompiledBlueprintError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except WorkflowPublishBindingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    db.commit()
    db.refresh(workflow)
    db.refresh(workflow_version)
    db.refresh(compiled_blueprint)
    return _serialize_workflow_detail(
        workflow,
        [workflow_version],
        {workflow_version.id: compiled_blueprint},
    )


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
    return _serialize_workflow_detail(
        workflow,
        versions,
        _load_compiled_blueprint_lookup(db, workflow_id),
    )


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
        workflow_version = WorkflowVersion(
            id=str(uuid4()),
            workflow_id=workflow.id,
            version=workflow.version,
            definition=definition,
        )
        db.add(workflow_version)
        db.flush()
        try:
            compiled_blueprint_service.ensure_for_workflow_version(db, workflow_version)
            db.flush()
        except CompiledBlueprintError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        try:
            workflow_publish_service.ensure_for_workflow_version(db, workflow_version)
        except WorkflowPublishBindingError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    versions = db.scalars(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.created_at.desc())
    ).all()
    return _serialize_workflow_detail(
        workflow,
        versions,
        _load_compiled_blueprint_lookup(db, workflow_id),
    )


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
    compiled_blueprints = _load_compiled_blueprint_lookup(db, workflow_id)
    return [
        WorkflowVersionItem(
            id=version.id,
            workflow_id=version.workflow_id,
            version=version.version,
            created_at=version.created_at,
            compiled_blueprint_id=compiled_blueprints.get(version.id).id
            if compiled_blueprints.get(version.id) is not None
            else None,
            compiled_blueprint_compiler_version=compiled_blueprints.get(version.id).compiler_version
            if compiled_blueprints.get(version.id) is not None
            else None,
            compiled_blueprint_updated_at=compiled_blueprints.get(version.id).updated_at
            if compiled_blueprints.get(version.id) is not None
            else None,
        )
        for version in versions
    ]


@router.get("/{workflow_id}/runs", response_model=list[WorkflowRunListItem])
def list_workflow_runs(
    workflow_id: str,
    limit: int = Query(default=8, ge=1, le=20),
    db: Session = Depends(get_db),
) -> list[WorkflowRunListItem]:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    node_run_stats = (
        select(
            NodeRun.run_id.label("run_id"),
            func.count(NodeRun.id).label("node_run_count"),
        )
        .group_by(NodeRun.run_id)
        .subquery()
    )
    run_event_stats = (
        select(
            RunEvent.run_id.label("run_id"),
            func.count(RunEvent.id).label("event_count"),
            func.max(RunEvent.created_at).label("last_event_at"),
        )
        .group_by(RunEvent.run_id)
        .subquery()
    )

    rows = db.execute(
        select(
            Run,
            node_run_stats.c.node_run_count,
            run_event_stats.c.event_count,
            run_event_stats.c.last_event_at,
        )
        .outerjoin(node_run_stats, node_run_stats.c.run_id == Run.id)
        .outerjoin(run_event_stats, run_event_stats.c.run_id == Run.id)
        .where(Run.workflow_id == workflow_id)
        .order_by(Run.created_at.desc())
        .limit(limit)
    ).all()

    return [
        WorkflowRunListItem(
            id=run.id,
            workflow_id=run.workflow_id,
            workflow_version=run.workflow_version,
            status=run.status,
            error_message=run.error_message,
            created_at=run.created_at,
            started_at=run.started_at,
            finished_at=run.finished_at,
            node_run_count=node_run_count or 0,
            event_count=event_count or 0,
            last_event_at=last_event_at,
        )
        for run, node_run_count, event_count, last_event_at in rows
    ]
