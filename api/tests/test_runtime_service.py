import pytest
from sqlalchemy.orm import Session

from app.models.workflow import Workflow
from app.services.runtime import RuntimeService, WorkflowExecutionError


def test_runtime_service_executes_linear_workflow(
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    service = RuntimeService()

    artifacts = service.execute_workflow(
        sqlite_session,
        sample_workflow,
        {"topic": "hello"},
    )

    assert artifacts.run.status == "succeeded"
    assert artifacts.run.workflow_version == "0.1.0"
    assert artifacts.run.output_payload == {"mock_tool": {"answer": "done"}}
    assert len(artifacts.node_runs) == 3
    assert [event.event_type for event in artifacts.events] == [
        "run.started",
        "node.started",
        "node.output.completed",
        "node.started",
        "node.output.completed",
        "node.started",
        "node.output.completed",
        "run.completed",
    ]


def test_runtime_service_only_executes_selected_condition_branch(sqlite_session: Session) -> None:
    workflow = Workflow(
        id="wf-condition",
        name="Condition Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "branch",
                    "type": "condition",
                    "name": "Branch",
                    "config": {"selected": "true"},
                },
                {
                    "id": "true_path",
                    "type": "tool",
                    "name": "True Path",
                    "config": {"mock_output": {"answer": "yes"}},
                },
                {
                    "id": "false_path",
                    "type": "tool",
                    "name": "False Path",
                    "config": {"mock_output": {"answer": "no"}},
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "branch"},
                {
                    "id": "e2",
                    "sourceNodeId": "branch",
                    "targetNodeId": "true_path",
                    "condition": "true",
                },
                {
                    "id": "e3",
                    "sourceNodeId": "branch",
                    "targetNodeId": "false_path",
                    "condition": "false",
                },
                {"id": "e4", "sourceNodeId": "true_path", "targetNodeId": "output"},
                {"id": "e5", "sourceNodeId": "false_path", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = RuntimeService().execute_workflow(sqlite_session, workflow, {"topic": "branch"})

    assert artifacts.run.status == "succeeded"
    assert artifacts.run.output_payload == {"true_path": {"answer": "yes"}}
    assert {node_run.node_id: node_run.status for node_run in artifacts.node_runs} == {
        "trigger": "succeeded",
        "branch": "succeeded",
        "true_path": "succeeded",
        "false_path": "skipped",
        "output": "succeeded",
    }
    assert "node.skipped" in [event.event_type for event in artifacts.events]


def test_runtime_service_can_continue_through_failure_branch(sqlite_session: Session) -> None:
    workflow = Workflow(
        id="wf-failure-branch",
        name="Failure Branch Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "explode",
                    "type": "tool",
                    "name": "Explode",
                    "config": {"mock_error": "boom"},
                },
                {
                    "id": "success_path",
                    "type": "tool",
                    "name": "Success Path",
                    "config": {"mock_output": {"answer": "unexpected"}},
                },
                {
                    "id": "fallback",
                    "type": "tool",
                    "name": "Fallback",
                    "config": {"mock_output": {"answer": "recovered"}},
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "explode"},
                {"id": "e2", "sourceNodeId": "explode", "targetNodeId": "success_path"},
                {
                    "id": "e3",
                    "sourceNodeId": "explode",
                    "targetNodeId": "fallback",
                    "condition": "failed",
                },
                {"id": "e4", "sourceNodeId": "success_path", "targetNodeId": "output"},
                {"id": "e5", "sourceNodeId": "fallback", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = RuntimeService().execute_workflow(sqlite_session, workflow, {"topic": "errors"})

    assert artifacts.run.status == "succeeded"
    assert artifacts.run.output_payload == {"fallback": {"answer": "recovered"}}
    assert {node_run.node_id: node_run.status for node_run in artifacts.node_runs} == {
        "trigger": "succeeded",
        "explode": "failed",
        "success_path": "skipped",
        "fallback": "succeeded",
        "output": "succeeded",
    }
    assert [event.event_type for event in artifacts.events].count("node.failed") == 1
    assert artifacts.run.error_message is None


def test_runtime_service_retries_node_before_succeeding(sqlite_session: Session) -> None:
    workflow = Workflow(
        id="wf-retry-success",
        name="Retry Success Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "flaky_tool",
                    "type": "tool",
                    "name": "Flaky Tool",
                    "config": {
                        "mock_error_sequence": ["temporary outage"],
                        "mock_output": {"answer": "recovered"},
                    },
                    "runtimePolicy": {
                        "retry": {
                            "maxAttempts": 2,
                            "backoffSeconds": 0,
                        }
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "flaky_tool"},
                {"id": "e2", "sourceNodeId": "flaky_tool", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = RuntimeService().execute_workflow(sqlite_session, workflow, {"topic": "retry"})

    assert artifacts.run.status == "succeeded"
    assert artifacts.run.output_payload == {"flaky_tool": {"answer": "recovered"}}
    assert {node_run.node_id: node_run.status for node_run in artifacts.node_runs} == {
        "trigger": "succeeded",
        "flaky_tool": "succeeded",
        "output": "succeeded",
    }
    flaky_tool_run = next(
        node_run for node_run in artifacts.node_runs if node_run.node_id == "flaky_tool"
    )
    assert flaky_tool_run.input_payload["attempt"] == {"current": 2, "max": 2}
    assert [event.event_type for event in artifacts.events].count("node.retrying") == 1
    assert "node.failed" not in [event.event_type for event in artifacts.events]


def test_runtime_service_routes_to_failure_branch_after_retries_exhausted(
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-retry-failure-branch",
        name="Retry Failure Branch Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "explode",
                    "type": "tool",
                    "name": "Explode",
                    "config": {"mock_error": "boom"},
                    "runtimePolicy": {
                        "retry": {
                            "maxAttempts": 3,
                            "backoffSeconds": 0,
                        }
                    },
                },
                {
                    "id": "fallback",
                    "type": "tool",
                    "name": "Fallback",
                    "config": {"mock_output": {"answer": "recovered after retries"}},
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "explode"},
                {
                    "id": "e2",
                    "sourceNodeId": "explode",
                    "targetNodeId": "fallback",
                    "condition": "failed",
                },
                {"id": "e3", "sourceNodeId": "fallback", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = RuntimeService().execute_workflow(
        sqlite_session,
        workflow,
        {"topic": "retry failure"},
    )

    assert artifacts.run.status == "succeeded"
    assert artifacts.run.output_payload == {"fallback": {"answer": "recovered after retries"}}
    assert {node_run.node_id: node_run.status for node_run in artifacts.node_runs} == {
        "trigger": "succeeded",
        "explode": "failed",
        "fallback": "succeeded",
        "output": "succeeded",
    }
    assert [event.event_type for event in artifacts.events].count("node.retrying") == 2
    assert [event.event_type for event in artifacts.events].count("node.failed") == 1


def test_runtime_service_injects_authorized_context_and_executes_mcp_query(
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-mcp-query",
        name="MCP Query Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "planner",
                    "type": "tool",
                    "name": "Planner",
                    "config": {"mock_output": {"plan": "collect facts"}},
                },
                {
                    "id": "search",
                    "type": "tool",
                    "name": "Search",
                    "config": {"mock_output": {"docs": ["a", "b"]}},
                },
                {
                    "id": "reader",
                    "type": "mcp_query",
                    "name": "Reader",
                    "config": {
                        "contextAccess": {
                            "readableNodeIds": ["planner"],
                            "readableArtifacts": [
                                {"nodeId": "search", "artifactType": "json"},
                            ],
                        },
                        "query": {
                            "type": "authorized_context",
                            "sourceNodeIds": ["planner", "search"],
                            "artifactTypes": ["json"],
                        },
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "planner"},
                {"id": "e2", "sourceNodeId": "planner", "targetNodeId": "search"},
                {"id": "e3", "sourceNodeId": "search", "targetNodeId": "reader"},
                {"id": "e4", "sourceNodeId": "reader", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = RuntimeService().execute_workflow(sqlite_session, workflow, {"topic": "mcp"})

    assert artifacts.run.status == "succeeded"
    assert artifacts.run.output_payload == {
        "reader": {
            "query": {
                "type": "authorized_context",
                "sourceNodeIds": ["planner", "search"],
                "artifactTypes": ["json"],
            },
            "results": [
                {"nodeId": "planner", "artifactType": "json", "content": {"plan": "collect facts"}},
                {"nodeId": "search", "artifactType": "json", "content": {"docs": ["a", "b"]}},
            ],
        }
    }
    reader_run = next(node_run for node_run in artifacts.node_runs if node_run.node_id == "reader")
    assert reader_run.input_payload["authorized_context"] == {
        "currentNodeId": "reader",
        "readableNodeIds": ["planner", "search"],
        "readableArtifacts": [
            {"nodeId": "planner", "artifactType": "json"},
            {"nodeId": "search", "artifactType": "json"},
        ],
    }
    assert [event.event_type for event in artifacts.events].count("node.context.read") == 1


def test_runtime_service_rejects_unauthorized_mcp_query_source(sqlite_session: Session) -> None:
    workflow = Workflow(
        id="wf-mcp-query-unauthorized",
        name="Unauthorized MCP Query Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "planner",
                    "type": "tool",
                    "name": "Planner",
                    "config": {"mock_output": {"plan": "collect facts"}},
                },
                {
                    "id": "reader",
                    "type": "mcp_query",
                    "name": "Reader",
                    "config": {
                        "contextAccess": {
                            "readableNodeIds": ["planner"],
                        },
                        "query": {
                            "type": "authorized_context",
                            "sourceNodeIds": ["planner", "search"],
                            "artifactTypes": ["json"],
                        },
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "planner"},
                {"id": "e2", "sourceNodeId": "planner", "targetNodeId": "reader"},
                {"id": "e3", "sourceNodeId": "reader", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    with pytest.raises(WorkflowExecutionError, match="unauthorized context sources"):
        RuntimeService().execute_workflow(sqlite_session, workflow, {"topic": "mcp"})


def test_runtime_service_rejects_loop_nodes(sqlite_session: Session) -> None:
    workflow = Workflow(
        id="wf-loop",
        name="Loop Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [{"id": "loop", "type": "loop", "name": "Loop", "config": {}}],
            "edges": [],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    service = RuntimeService()

    with pytest.raises(WorkflowExecutionError):
        service.execute_workflow(sqlite_session, workflow, {})
