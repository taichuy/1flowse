from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.run import Run, RunEvent
from app.models.workflow import Workflow
from app.schemas.run import (
    RunCreate,
    RunDetail,
    RunEventItem,
    RunTrace,
    RunTraceFilters,
    RunTraceSummary,
)
from app.services.runtime import ExecutionArtifacts, RuntimeService, WorkflowExecutionError

router = APIRouter(tags=["runs"])
runtime_service = RuntimeService()


def _serialize_run(artifacts: ExecutionArtifacts) -> RunDetail:
    return RunDetail(
        id=artifacts.run.id,
        workflow_id=artifacts.run.workflow_id,
        workflow_version=artifacts.run.workflow_version,
        status=artifacts.run.status,
        input_payload=artifacts.run.input_payload,
        output_payload=artifacts.run.output_payload,
        error_message=artifacts.run.error_message,
        started_at=artifacts.run.started_at,
        finished_at=artifacts.run.finished_at,
        created_at=artifacts.run.created_at,
        node_runs=[
            {
                "id": node_run.id,
                "node_id": node_run.node_id,
                "node_name": node_run.node_name,
                "node_type": node_run.node_type,
                "status": node_run.status,
                "input_payload": node_run.input_payload,
                "output_payload": node_run.output_payload,
                "error_message": node_run.error_message,
                "started_at": node_run.started_at,
                "finished_at": node_run.finished_at,
            }
            for node_run in artifacts.node_runs
        ],
        events=[
            _serialize_run_event(event) for event in artifacts.events
        ],
    )


def _serialize_run_event(event: RunEvent) -> RunEventItem:
    return RunEventItem(
        id=event.id,
        run_id=event.run_id,
        node_run_id=event.node_run_id,
        event_type=event.event_type,
        payload=event.payload,
        created_at=event.created_at,
    )


@router.post(
    "/workflows/{workflow_id}/runs",
    response_model=RunDetail,
    status_code=status.HTTP_201_CREATED,
)
def execute_workflow(
    workflow_id: str,
    payload: RunCreate,
    db: Session = Depends(get_db),
) -> RunDetail:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    try:
        artifacts = runtime_service.execute_workflow(db, workflow, payload.input_payload)
    except WorkflowExecutionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    return _serialize_run(artifacts)


@router.get("/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: str, db: Session = Depends(get_db)) -> RunDetail:
    artifacts = runtime_service.load_run(db, run_id)
    if artifacts is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    return _serialize_run(artifacts)


@router.get("/runs/{run_id}/events", response_model=list[RunEventItem])
def get_run_events(run_id: str, db: Session = Depends(get_db)) -> list[RunEventItem]:
    artifacts = runtime_service.load_run(db, run_id)
    if artifacts is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    return [_serialize_run_event(event) for event in artifacts.events]


@router.get("/runs/{run_id}/trace", response_model=RunTrace)
def get_run_trace(
    run_id: str,
    event_type: str | None = None,
    node_run_id: str | None = None,
    before_event_id: int | None = None,
    after_event_id: int | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    order: Literal["asc", "desc"] = "asc",
    db: Session = Depends(get_db),
) -> RunTrace:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    conditions = [RunEvent.run_id == run_id]
    if event_type is not None:
        conditions.append(RunEvent.event_type == event_type)
    if node_run_id is not None:
        conditions.append(RunEvent.node_run_id == node_run_id)
    if before_event_id is not None:
        conditions.append(RunEvent.id < before_event_id)
    if after_event_id is not None:
        conditions.append(RunEvent.id > after_event_id)

    total_event_count = db.scalar(
        select(func.count(RunEvent.id)).where(RunEvent.run_id == run_id)
    ) or 0
    matched_event_count = db.scalar(select(func.count(RunEvent.id)).where(*conditions)) or 0
    available_event_types = db.scalars(
        select(RunEvent.event_type)
        .where(RunEvent.run_id == run_id)
        .distinct()
        .order_by(RunEvent.event_type.asc())
    ).all()
    available_node_run_ids = db.scalars(
        select(RunEvent.node_run_id)
        .where(RunEvent.run_id == run_id, RunEvent.node_run_id.is_not(None))
        .distinct()
        .order_by(RunEvent.node_run_id.asc())
    ).all()

    order_by = RunEvent.id.asc() if order == "asc" else RunEvent.id.desc()
    events = db.scalars(
        select(RunEvent).where(*conditions).order_by(order_by).limit(limit + 1)
    ).all()

    has_more = len(events) > limit
    if has_more:
        events = events[:limit]

    return RunTrace(
        run_id=run_id,
        filters=RunTraceFilters(
            event_type=event_type,
            node_run_id=node_run_id,
            before_event_id=before_event_id,
            after_event_id=after_event_id,
            limit=limit,
            order=order,
        ),
        summary=RunTraceSummary(
            total_event_count=total_event_count,
            matched_event_count=matched_event_count,
            returned_event_count=len(events),
            available_event_types=available_event_types,
            available_node_run_ids=[item for item in available_node_run_ids if item is not None],
            first_event_id=events[0].id if events else None,
            last_event_id=events[-1].id if events else None,
            has_more=has_more,
        ),
        events=[_serialize_run_event(event) for event in events],
    )
