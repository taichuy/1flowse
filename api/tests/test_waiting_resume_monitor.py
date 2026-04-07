from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import NodeRun, Run, RunEvent
from app.models.workflow import Workflow
from app.services.callback_waiting_lifecycle import (
    build_callback_waiting_scheduled_resume,
)
from app.services.run_resume_scheduler import RunResumeScheduler
from app.services.waiting_resume_monitor import WaitingResumeMonitorService


def test_waiting_resume_monitor_schedules_due_waiting_callback_run(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    now = datetime(2026, 3, 18, 11, 0, tzinfo=UTC)
    scheduled_resumes = []
    service = WaitingResumeMonitorService(
        resume_scheduler=RunResumeScheduler(dispatcher=scheduled_resumes.append)
    )
    run = Run(
        id="run-waiting-resume-monitor",
        workflow_id=sample_workflow.id,
        workflow_version=sample_workflow.version,
        compiled_blueprint_id="bp-waiting-resume-monitor",
        status="waiting",
        checkpoint_payload={"waiting_node_run_id": "node-run-waiting-resume-monitor"},
        current_node_id="agent",
        input_payload={"message": "monitor me"},
        created_at=now - timedelta(minutes=5),
    )
    node_run = NodeRun(
        id="node-run-waiting-resume-monitor",
        run_id=run.id,
        node_id="agent",
        node_name="Agent",
        node_type="llmAgentNode",
        status="waiting_callback",
        phase="waiting_callback",
        checkpoint_payload={
            "scheduled_resume": build_callback_waiting_scheduled_resume(
                delay_seconds=30,
                reason="callback pending",
                source="runtime_waiting",
                waiting_status="waiting_callback",
                backoff_attempt=1,
                scheduled_at=now - timedelta(minutes=1),
            )
        },
        waiting_reason="callback pending",
        created_at=now - timedelta(minutes=5),
    )
    sqlite_session.add_all([run, node_run])
    sqlite_session.commit()

    result = service.schedule_due_resumes(
        sqlite_session,
        source="scheduler_waiting_resume_monitor",
        now=now,
    )

    assert result.matched_count == 1
    assert result.scheduled_count == 1
    assert result.run_ids == [run.id]
    assert result.items[0].scheduled_resume_due_at == now - timedelta(seconds=30)
    assert scheduled_resumes == []

    sqlite_session.commit()

    assert len(scheduled_resumes) == 1
    assert scheduled_resumes[0].run_id == run.id
    assert scheduled_resumes[0].delay_seconds == 0.0
    assert scheduled_resumes[0].reason == "callback pending"
    assert scheduled_resumes[0].source == "scheduler_waiting_resume_monitor"

    requeue_event = sqlite_session.scalar(
        select(RunEvent)
        .where(RunEvent.run_id == run.id, RunEvent.event_type == "run.resume.requeued")
        .order_by(RunEvent.id.desc())
    )
    assert requeue_event is not None
    assert requeue_event.payload["scheduled_resume_source"] == "runtime_waiting"
    assert requeue_event.payload["scheduled_resume_due_at"] == "2026-03-18T10:59:30Z"


def test_waiting_resume_monitor_treats_legacy_scheduled_resume_as_due(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    now = datetime(2026, 3, 18, 12, 0, tzinfo=UTC)
    scheduled_resumes = []
    service = WaitingResumeMonitorService(
        resume_scheduler=RunResumeScheduler(dispatcher=scheduled_resumes.append)
    )
    run = Run(
        id="run-waiting-resume-legacy",
        workflow_id=sample_workflow.id,
        workflow_version=sample_workflow.version,
        compiled_blueprint_id="bp-waiting-resume-legacy",
        status="waiting",
        checkpoint_payload={"waiting_node_run_id": "node-run-waiting-resume-legacy"},
        current_node_id="agent",
        input_payload={"message": "legacy monitor"},
        created_at=now - timedelta(minutes=10),
    )
    node_run = NodeRun(
        id="node-run-waiting-resume-legacy",
        run_id=run.id,
        node_id="agent",
        node_name="Agent",
        node_type="llmAgentNode",
        status="waiting_callback",
        phase="waiting_callback",
        checkpoint_payload={
            "scheduled_resume": {
                "delay_seconds": 5,
                "reason": "legacy callback pending",
                "source": "callback_ticket_monitor",
                "waiting_status": "waiting_callback",
                "backoff_attempt": 2,
            }
        },
        waiting_reason="legacy callback pending",
        created_at=now - timedelta(minutes=10),
    )
    sqlite_session.add_all([run, node_run])
    sqlite_session.commit()

    result = service.schedule_due_resumes(sqlite_session, now=now)

    assert result.scheduled_count == 1
    sqlite_session.commit()
    assert len(scheduled_resumes) == 1
    assert scheduled_resumes[0].run_id == run.id


def test_waiting_resume_monitor_skips_future_due_or_terminated_nodes(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    now = datetime(2026, 3, 18, 13, 0, tzinfo=UTC)
    scheduled_resumes = []
    service = WaitingResumeMonitorService(
        resume_scheduler=RunResumeScheduler(dispatcher=scheduled_resumes.append)
    )

    future_run = Run(
        id="run-waiting-resume-future",
        workflow_id=sample_workflow.id,
        workflow_version=sample_workflow.version,
        compiled_blueprint_id="bp-waiting-resume-future",
        status="waiting",
        checkpoint_payload={"waiting_node_run_id": "node-run-waiting-resume-future"},
        current_node_id="agent",
        input_payload={"message": "future monitor"},
        created_at=now - timedelta(minutes=3),
    )
    future_node = NodeRun(
        id="node-run-waiting-resume-future",
        run_id=future_run.id,
        node_id="agent",
        node_name="Agent",
        node_type="llmAgentNode",
        status="waiting_callback",
        phase="waiting_callback",
        checkpoint_payload={
            "scheduled_resume": build_callback_waiting_scheduled_resume(
                delay_seconds=300,
                reason="future callback pending",
                source="runtime_waiting",
                waiting_status="waiting_callback",
                backoff_attempt=0,
                scheduled_at=now,
            )
        },
        waiting_reason="future callback pending",
        created_at=now - timedelta(minutes=3),
    )

    terminated_run = Run(
        id="run-waiting-resume-terminated",
        workflow_id=sample_workflow.id,
        workflow_version=sample_workflow.version,
        compiled_blueprint_id="bp-waiting-resume-terminated",
        status="waiting",
        checkpoint_payload={"waiting_node_run_id": "node-run-waiting-resume-terminated"},
        current_node_id="agent",
        input_payload={"message": "terminated monitor"},
        created_at=now - timedelta(minutes=3),
    )
    terminated_node = NodeRun(
        id="node-run-waiting-resume-terminated",
        run_id=terminated_run.id,
        node_id="agent",
        node_name="Agent",
        node_type="llmAgentNode",
        status="waiting_callback",
        phase="waiting_callback",
        checkpoint_payload={
            "callback_waiting_lifecycle": {
                "terminated": True,
                "termination_reason": "callback_waiting_max_expired_tickets_reached",
            },
            "scheduled_resume": build_callback_waiting_scheduled_resume(
                delay_seconds=0,
                reason="terminated callback pending",
                source="callback_ticket_monitor",
                waiting_status="waiting_callback",
                backoff_attempt=3,
                scheduled_at=now - timedelta(minutes=1),
            ),
        },
        waiting_reason="terminated callback pending",
        created_at=now - timedelta(minutes=3),
    )

    sqlite_session.add_all([future_run, future_node, terminated_run, terminated_node])
    sqlite_session.commit()

    result = service.schedule_due_resumes(sqlite_session, now=now)

    assert result.scheduled_count == 0
    sqlite_session.commit()
    assert scheduled_resumes == []


def test_waiting_resume_monitor_skips_recently_requeued_resume(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    now = datetime(2026, 3, 18, 14, 0, tzinfo=UTC)
    scheduled_resumes = []
    service = WaitingResumeMonitorService(
        resume_scheduler=RunResumeScheduler(dispatcher=scheduled_resumes.append),
        recent_requeue_window_seconds=300,
    )
    run = Run(
        id="run-waiting-resume-recently-requeued",
        workflow_id=sample_workflow.id,
        workflow_version=sample_workflow.version,
        compiled_blueprint_id="bp-waiting-resume-recently-requeued",
        status="waiting",
        checkpoint_payload={"waiting_node_run_id": "node-run-waiting-resume-recently-requeued"},
        current_node_id="agent",
        input_payload={"message": "still queued"},
        created_at=now - timedelta(minutes=5),
    )
    node_run = NodeRun(
        id="node-run-waiting-resume-recently-requeued",
        run_id=run.id,
        node_id="agent",
        node_name="Agent",
        node_type="llmAgentNode",
        status="waiting_callback",
        phase="waiting_callback",
        checkpoint_payload={
            "scheduled_resume": build_callback_waiting_scheduled_resume(
                delay_seconds=30,
                reason="callback pending",
                source="runtime_waiting",
                waiting_status="waiting_callback",
                backoff_attempt=1,
                scheduled_at=now - timedelta(minutes=2),
                requeued_at=now - timedelta(seconds=60),
                requeue_source="scheduler_waiting_resume_monitor",
            )
        },
        waiting_reason="callback pending",
        created_at=now - timedelta(minutes=5),
    )
    sqlite_session.add_all([run, node_run])
    sqlite_session.commit()

    result = service.schedule_due_resumes(sqlite_session, now=now)

    assert result.scheduled_count == 0
    sqlite_session.commit()
    assert scheduled_resumes == []


def test_waiting_resume_monitor_requeues_again_after_recent_window_expires(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    now = datetime(2026, 3, 18, 15, 0, tzinfo=UTC)
    scheduled_resumes = []
    service = WaitingResumeMonitorService(
        resume_scheduler=RunResumeScheduler(dispatcher=scheduled_resumes.append),
        recent_requeue_window_seconds=300,
    )
    run = Run(
        id="run-waiting-resume-requeue-stale",
        workflow_id=sample_workflow.id,
        workflow_version=sample_workflow.version,
        compiled_blueprint_id="bp-waiting-resume-requeue-stale",
        status="waiting",
        checkpoint_payload={"waiting_node_run_id": "node-run-waiting-resume-requeue-stale"},
        current_node_id="agent",
        input_payload={"message": "requeue me again"},
        created_at=now - timedelta(minutes=10),
    )
    node_run = NodeRun(
        id="node-run-waiting-resume-requeue-stale",
        run_id=run.id,
        node_id="agent",
        node_name="Agent",
        node_type="llmAgentNode",
        status="waiting_callback",
        phase="waiting_callback",
        checkpoint_payload={
            "scheduled_resume": build_callback_waiting_scheduled_resume(
                delay_seconds=30,
                reason="callback pending",
                source="runtime_waiting",
                waiting_status="waiting_callback",
                backoff_attempt=1,
                scheduled_at=now - timedelta(minutes=8),
                requeued_at=now - timedelta(minutes=6),
                requeue_source="scheduler_waiting_resume_monitor",
            )
        },
        waiting_reason="callback pending",
        created_at=now - timedelta(minutes=10),
    )
    sqlite_session.add_all([run, node_run])
    sqlite_session.commit()

    result = service.schedule_due_resumes(sqlite_session, now=now)

    assert result.scheduled_count == 1
    sqlite_session.commit()
    assert len(scheduled_resumes) == 1
    node_run = sqlite_session.get(NodeRun, node_run.id)
    assert node_run is not None
    assert node_run.checkpoint_payload["scheduled_resume"]["requeued_at"] == "2026-03-18T15:00:00Z"
    assert (
        node_run.checkpoint_payload["scheduled_resume"]["requeue_source"]
        == "waiting_resume_monitor"
    )
