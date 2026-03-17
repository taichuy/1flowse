from datetime import UTC, datetime

from app.api.routes.published_endpoint_invocation_support import (
    build_waiting_lifecycle_lookup,
)
from app.models.run import NodeRun, Run, RunCallbackTicket


def test_build_waiting_lifecycle_lookup_keeps_terminated_callback_context_without_waiting_reason(
) -> None:
    now = datetime(2026, 3, 17, 18, 0, tzinfo=UTC)
    terminated_at = datetime(2026, 3, 17, 18, 5, tzinfo=UTC)
    run = Run(
        id="run-terminated-callback",
        workflow_id="wf-terminated-callback",
        workflow_version="0.1.0",
        status="failed",
        input_payload={"question": "hello"},
        checkpoint_payload={"waiting_node_run_id": None},
        current_node_id=None,
        error_message="Callback waiting terminated after 2 expired ticket cycle(s) (max 2).",
        started_at=now,
        finished_at=terminated_at,
        created_at=now,
    )
    node_run = NodeRun(
        id="node-run-terminated-callback",
        run_id=run.id,
        node_id="tool_wait",
        node_name="Tool Wait",
        node_type="tool",
        status="failed",
        phase="failed",
        retry_count=0,
        input_payload={"question": "hello"},
        output_payload=None,
        checkpoint_payload={
            "callback_waiting_lifecycle": {
                "wait_cycle_count": 2,
                "issued_ticket_count": 2,
                "expired_ticket_count": 2,
                "consumed_ticket_count": 0,
                "canceled_ticket_count": 0,
                "late_callback_count": 0,
                "resume_schedule_count": 1,
                "max_expired_ticket_count": 2,
                "terminated": True,
                "termination_reason": "callback_waiting_max_expired_tickets_reached",
                "terminated_at": terminated_at.isoformat().replace("+00:00", "Z"),
                "last_ticket_status": "expired",
                "last_ticket_reason": "callback_ticket_expired",
                "last_ticket_updated_at": terminated_at.isoformat().replace("+00:00", "Z"),
                "last_late_callback_status": None,
                "last_late_callback_reason": None,
                "last_late_callback_at": None,
                "last_resume_delay_seconds": 5.0,
                "last_resume_reason": "callback pending",
                "last_resume_source": "callback_ticket_monitor",
                "last_resume_backoff_attempt": 2,
            }
        },
        working_context={},
        evidence_context=None,
        artifact_refs=[],
        error_message=run.error_message,
        waiting_reason="callback pending",
        started_at=now,
        phase_started_at=terminated_at,
        finished_at=terminated_at,
        created_at=now,
    )
    callback_ticket = RunCallbackTicket(
        id="ticket-terminated-callback",
        run_id=run.id,
        node_run_id=node_run.id,
        tool_call_id=None,
        tool_id="native.search",
        tool_call_index=0,
        waiting_status="waiting_callback",
        status="expired",
        reason="callback pending",
        callback_payload={"reason": "callback_ticket_expired"},
        created_at=now,
        expires_at=terminated_at,
        expired_at=terminated_at,
    )

    waiting_reason_lookup, waiting_lifecycle_lookup = build_waiting_lifecycle_lookup(
        {run.id: run},
        [node_run],
        [callback_ticket],
    )

    waiting_lifecycle = waiting_lifecycle_lookup[run.id]
    assert waiting_reason_lookup[run.id] is None
    assert waiting_lifecycle is not None
    assert waiting_lifecycle.node_run_id == node_run.id
    assert waiting_lifecycle.node_status == "failed"
    assert waiting_lifecycle.waiting_reason is None
    assert waiting_lifecycle.callback_ticket_count == 1
    assert waiting_lifecycle.callback_ticket_status_counts == {"expired": 1}
    assert waiting_lifecycle.callback_waiting_lifecycle is not None
    assert waiting_lifecycle.callback_waiting_lifecycle.terminated is True
    assert (
        waiting_lifecycle.callback_waiting_lifecycle.termination_reason
        == "callback_waiting_max_expired_tickets_reached"
    )
