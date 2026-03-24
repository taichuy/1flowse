from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.run import NodeRun, Run
from app.models.sensitive_access import (
    ApprovalTicketRecord,
    NotificationDispatchRecord,
    SensitiveAccessRequestRecord,
)
from app.models.workflow import Workflow
from app.services.notification_dispatch_scheduler import NotificationDispatchScheduler
from app.services.run_resume_scheduler import RunResumeScheduler
from app.services.sensitive_access_control import SensitiveAccessControlService


def _build_sensitive_access_service(
    *,
    scheduled_resumes: list,
    scheduled_dispatches: list,
) -> SensitiveAccessControlService:
    return SensitiveAccessControlService(
        resume_scheduler=RunResumeScheduler(dispatcher=scheduled_resumes.append),
        notification_dispatch_scheduler=NotificationDispatchScheduler(
            dispatcher=scheduled_dispatches.append
        ),
        settings=Settings(
            notification_email_smtp_host="smtp.example.test",
            notification_email_from_address="noreply@example.test",
        ),
    )


def _create_waiting_scope(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> tuple[str, str]:
    run = Run(
        id="run-sensitive-access-expiry",
        workflow_id=sample_workflow.id,
        workflow_version=sample_workflow.version,
        status="waiting",
        input_payload={},
        checkpoint_payload={},
        created_at=datetime.now(UTC),
    )
    node_run = NodeRun(
        id="node-run-sensitive-access-expiry",
        run_id=run.id,
        node_id="mock_tool",
        node_name="Mock Tool",
        node_type="tool",
        status="waiting_callback",
        phase="waiting_callback",
        input_payload={},
        checkpoint_payload={},
        working_context={},
        artifact_refs=[],
        created_at=datetime.now(UTC),
    )
    sqlite_session.add_all([run, node_run])
    sqlite_session.commit()
    return run.id, node_run.id


def test_expire_pending_tickets_marks_requests_denied_and_schedules_resume(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    scheduled_resumes = []
    scheduled_dispatches = []
    service = _build_sensitive_access_service(
        scheduled_resumes=scheduled_resumes,
        scheduled_dispatches=scheduled_dispatches,
    )
    run_id, node_run_id = _create_waiting_scope(sqlite_session, sample_workflow)

    resource = service.create_resource(
        sqlite_session,
        label="Expiry protected secret",
        sensitivity_level="L3",
        source="published_secret",
        metadata={"binding_id": "binding-expiry-batch"},
    )
    sqlite_session.commit()

    bundle = service.request_access(
        sqlite_session,
        run_id=run_id,
        node_run_id=node_run_id,
        requester_type="ai",
        requester_id="assistant-expiry-batch",
        resource_id=resource.id,
        action_type="read",
        purpose_text="expire approval batch",
        notification_channel="email",
        notification_target="ops@example.com",
    )
    sqlite_session.commit()

    assert bundle.approval_ticket is not None
    assert bundle.approval_ticket.expires_at is not None
    assert len(scheduled_dispatches) == 1
    assert bundle.notifications[0].status == "pending"

    result = service.expire_pending_tickets(
        sqlite_session,
        source="test_expiry",
        now=bundle.approval_ticket.expires_at + timedelta(minutes=1),
    )
    sqlite_session.commit()

    assert result.source == "test_expiry"
    assert result.matched_count == 1
    assert result.expired_count == 1
    assert result.scheduled_resume_count == 1
    assert result.ticket_ids == [bundle.approval_ticket.id]
    assert result.run_ids == [run_id]
    assert len(scheduled_resumes) == 1
    assert scheduled_resumes[0].run_id == run_id
    assert scheduled_resumes[0].source == "test_expiry"

    stored_ticket = sqlite_session.get(ApprovalTicketRecord, bundle.approval_ticket.id)
    stored_request = sqlite_session.get(
        SensitiveAccessRequestRecord,
        bundle.access_request.id,
    )
    stored_notification = sqlite_session.get(
        NotificationDispatchRecord,
        bundle.notifications[0].id,
    )
    assert stored_ticket is not None
    assert stored_request is not None
    assert stored_notification is not None
    assert stored_ticket.status == "expired"
    assert stored_ticket.waiting_status == "failed"
    assert stored_request.decision == "deny"
    assert stored_request.reason_code == "approval_expired"
    assert stored_notification.status == "failed"
    assert (
        stored_notification.error
        == "Approval ticket expired before notification delivery."
    )
