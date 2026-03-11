from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Run, RunCallbackTicket, RunEvent
from app.models.workflow import Workflow, WorkflowVersion
from app.services.plugin_runtime import PluginCallProxy, PluginRegistry, PluginToolDefinition
from app.services.runtime import RuntimeService


def _create_waiting_callback_run(sqlite_session: Session) -> tuple[str, str]:
    workflow = Workflow(
        id="wf-cleanup-route",
        name="Cleanup Route Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "agent",
                    "type": "llm_agent",
                    "name": "Agent",
                    "config": {
                        "assistant": {"enabled": False},
                        "toolPolicy": {"allowedToolIds": ["native.search"]},
                        "mockPlan": {
                            "toolCalls": [
                                {
                                    "toolId": "native.search",
                                    "inputs": {"query": "cleanup-route"},
                                }
                            ]
                        },
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
                {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
            ],
        },
    )
    workflow_version = WorkflowVersion(
        id="wf-cleanup-route-v1",
        workflow_id=workflow.id,
        version=workflow.version,
        definition=workflow.definition,
    )
    sqlite_session.add(workflow)
    sqlite_session.add(workflow_version)
    sqlite_session.commit()

    registry = PluginRegistry()
    registry.register_tool(
        PluginToolDefinition(id="native.search", name="Native Search"),
        invoker=lambda _request: {
            "status": "waiting",
            "content_type": "json",
            "summary": "waiting for callback",
            "structured": {"externalTicket": "cleanup-route"},
            "meta": {
                "tool_name": "Native Search",
                "waiting_reason": "cleanup route pending",
                "waiting_status": "waiting_callback",
            },
        },
    )

    first_pass = RuntimeService(plugin_call_proxy=PluginCallProxy(registry)).execute_workflow(
        sqlite_session,
        workflow,
        {"topic": "cleanup-route"},
    )
    waiting_run = next(node_run for node_run in first_pass.node_runs if node_run.node_id == "agent")
    return first_pass.run.id, waiting_run.checkpoint_payload["callback_ticket"]["ticket"]


def test_cleanup_stale_run_callback_tickets_route_expires_stale_tickets(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    run_id, ticket = _create_waiting_callback_run(sqlite_session)
    ticket_record = sqlite_session.get(RunCallbackTicket, ticket)
    assert ticket_record is not None
    ticket_record.expires_at = datetime.now(UTC) - timedelta(minutes=5)
    sqlite_session.commit()

    response = client.post(
        "/api/runs/callback-tickets/cleanup",
        json={"source": "route_cleanup"},
    )

    sqlite_session.refresh(ticket_record)
    refreshed_run = sqlite_session.get(Run, run_id)
    event = sqlite_session.scalar(
        select(RunEvent)
        .where(
            RunEvent.run_id == run_id,
            RunEvent.event_type == "run.callback.ticket.expired",
        )
        .order_by(RunEvent.id.desc())
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "route_cleanup"
    assert body["matched_count"] == 1
    assert body["expired_count"] == 1
    assert body["run_ids"] == [run_id]
    assert body["items"][0]["ticket"] == ticket
    assert body["items"][0]["node_id"] == "agent"
    assert body["items"][0]["status"] == "expired"
    assert ticket_record.status == "expired"
    assert ticket_record.expired_at is not None
    assert ticket_record.callback_payload == {
        "reason": "callback_ticket_expired",
        "source": "route_cleanup",
        "cleanup": True,
    }
    assert refreshed_run is not None
    assert refreshed_run.status == "waiting"
    assert event is not None
    assert event.payload["ticket"] == ticket
    assert event.payload["source"] == "route_cleanup"
    assert event.payload["cleanup"] is True


def test_cleanup_stale_run_callback_tickets_route_supports_dry_run(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    run_id, ticket = _create_waiting_callback_run(sqlite_session)
    ticket_record = sqlite_session.get(RunCallbackTicket, ticket)
    assert ticket_record is not None
    ticket_record.expires_at = datetime.now(UTC) - timedelta(minutes=5)
    sqlite_session.commit()

    response = client.post(
        "/api/runs/callback-tickets/cleanup",
        json={"source": "route_cleanup_dry_run", "dry_run": True},
    )

    sqlite_session.refresh(ticket_record)
    matching_events = sqlite_session.scalars(
        select(RunEvent).where(
            RunEvent.run_id == run_id,
            RunEvent.event_type == "run.callback.ticket.expired",
        )
    ).all()

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "route_cleanup_dry_run"
    assert body["dry_run"] is True
    assert body["matched_count"] == 1
    assert body["expired_count"] == 0
    assert body["items"][0]["ticket"] == ticket
    assert body["items"][0]["status"] == "pending"
    assert ticket_record.status == "pending"
    assert ticket_record.expired_at is None
    assert matching_events == []
