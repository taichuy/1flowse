from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.workflow import Workflow


def test_execute_workflow_route(
    client: TestClient,
    sqlite_session: Session,
    sample_workflow: Workflow,
) -> None:
    response = client.post(
        f"/api/workflows/{sample_workflow.id}/runs",
        json={"input_payload": {"message": "hi"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["workflow_id"] == sample_workflow.id
    assert body["workflow_version"] == "0.1.0"
    assert body["status"] == "succeeded"
    assert len(body["node_runs"]) == 3
    assert body["events"][-1]["event_type"] == "run.completed"

    run_id = body["id"]
    stored_response = client.get(f"/api/runs/{run_id}")
    assert stored_response.status_code == 200
    assert stored_response.json()["id"] == run_id


def test_execute_workflow_route_returns_handled_failure_branch(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-failure-branch",
        name="Route Failure Branch",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "explode",
                    "type": "tool",
                    "name": "Explode",
                    "config": {"mock_error": "route boom"},
                },
                {
                    "id": "fallback",
                    "type": "tool",
                    "name": "Fallback",
                    "config": {"mock_output": {"answer": "route recovered"}},
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

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"message": "recover"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["output_payload"] == {"fallback": {"answer": "route recovered"}}
    assert {node_run["node_id"]: node_run["status"] for node_run in body["node_runs"]} == {
        "trigger": "succeeded",
        "explode": "failed",
        "fallback": "succeeded",
        "output": "succeeded",
    }


def test_execute_workflow_route_exposes_retry_events(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-retry",
        name="Route Retry Workflow",
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
                        "mock_error_sequence": ["route temporary"],
                        "mock_output": {"answer": "route recovered"},
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

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"message": "retry route"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["output_payload"] == {"flaky_tool": {"answer": "route recovered"}}
    assert [event["event_type"] for event in body["events"]].count("node.retrying") == 1


def test_execute_workflow_route_supports_selector_driven_branching(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-selector",
        name="Route Selector Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "branch",
                    "type": "router",
                    "name": "Branch",
                    "config": {
                        "selector": {
                            "rules": [
                                {
                                    "key": "search",
                                    "path": "trigger_input.intent",
                                    "operator": "eq",
                                    "value": "search",
                                }
                            ]
                        }
                    },
                },
                {
                    "id": "search_path",
                    "type": "tool",
                    "name": "Search Path",
                    "config": {"mock_output": {"answer": "search mode"}},
                },
                {
                    "id": "default_path",
                    "type": "tool",
                    "name": "Default Path",
                    "config": {"mock_output": {"answer": "default mode"}},
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "branch"},
                {
                    "id": "e2",
                    "sourceNodeId": "branch",
                    "targetNodeId": "search_path",
                    "condition": "search",
                },
                {"id": "e3", "sourceNodeId": "branch", "targetNodeId": "default_path"},
                {"id": "e4", "sourceNodeId": "search_path", "targetNodeId": "output"},
                {"id": "e5", "sourceNodeId": "default_path", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"intent": "search"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["output_payload"] == {"search_path": {"answer": "search mode"}}
    assert {node_run["node_id"]: node_run["status"] for node_run in body["node_runs"]} == {
        "trigger": "succeeded",
        "branch": "succeeded",
        "search_path": "succeeded",
        "default_path": "skipped",
        "output": "succeeded",
    }


def test_execute_workflow_route_supports_expression_driven_branching(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-expression",
        name="Route Expression Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "branch",
                    "type": "router",
                    "name": "Branch",
                    "config": {
                        "expression": "trigger_input.intent if trigger_input.intent else 'default'"
                    },
                },
                {
                    "id": "search_path",
                    "type": "tool",
                    "name": "Search Path",
                    "config": {"mock_output": {"answer": "search mode"}},
                },
                {
                    "id": "default_path",
                    "type": "tool",
                    "name": "Default Path",
                    "config": {"mock_output": {"answer": "default mode"}},
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "branch"},
                {
                    "id": "e2",
                    "sourceNodeId": "branch",
                    "targetNodeId": "search_path",
                    "condition": "search",
                },
                {"id": "e3", "sourceNodeId": "branch", "targetNodeId": "default_path"},
                {"id": "e4", "sourceNodeId": "search_path", "targetNodeId": "output"},
                {"id": "e5", "sourceNodeId": "default_path", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"intent": "search"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["output_payload"] == {"search_path": {"answer": "search mode"}}
    branch_run = next(node_run for node_run in body["node_runs"] if node_run["node_id"] == "branch")
    assert branch_run["output_payload"]["selected"] == "search"
    assert branch_run["output_payload"]["expression"]["defaultUsed"] is False


def test_execute_workflow_route_supports_edge_condition_expression(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-edge-expression",
        name="Route Edge Expression Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "scorer",
                    "type": "tool",
                    "name": "Scorer",
                    "config": {"mock_output": {"approved": True, "score": 97}},
                },
                {
                    "id": "approve",
                    "type": "tool",
                    "name": "Approve",
                    "config": {"mock_output": {"answer": "approved route"}},
                },
                {
                    "id": "reject",
                    "type": "tool",
                    "name": "Reject",
                    "config": {"mock_output": {"answer": "rejected route"}},
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "scorer"},
                {
                    "id": "e2",
                    "sourceNodeId": "scorer",
                    "targetNodeId": "approve",
                    "conditionExpression": "source_output.approved and source_output.score >= 90",
                },
                {
                    "id": "e3",
                    "sourceNodeId": "scorer",
                    "targetNodeId": "reject",
                    "conditionExpression": "not source_output.approved",
                },
                {"id": "e4", "sourceNodeId": "approve", "targetNodeId": "output"},
                {"id": "e5", "sourceNodeId": "reject", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"message": "edge expr route"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["output_payload"] == {"approve": {"answer": "approved route"}}
    assert {node_run["node_id"]: node_run["status"] for node_run in body["node_runs"]} == {
        "trigger": "succeeded",
        "scorer": "succeeded",
        "approve": "succeeded",
        "reject": "skipped",
        "output": "succeeded",
    }


def test_execute_workflow_route_supports_join_all_policy(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-join-all",
        name="Route Join All Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "planner",
                    "type": "tool",
                    "name": "Planner",
                    "config": {"mock_output": {"plan": "outline"}},
                },
                {
                    "id": "researcher",
                    "type": "tool",
                    "name": "Researcher",
                    "config": {"mock_output": {"facts": ["a"]}},
                },
                {
                    "id": "joiner",
                    "type": "tool",
                    "name": "Joiner",
                    "config": {"mock_output": {"answer": "route combined"}},
                    "runtimePolicy": {"join": {"mode": "all"}},
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "planner"},
                {"id": "e2", "sourceNodeId": "trigger", "targetNodeId": "researcher"},
                {"id": "e3", "sourceNodeId": "planner", "targetNodeId": "joiner"},
                {"id": "e4", "sourceNodeId": "researcher", "targetNodeId": "joiner"},
                {"id": "e5", "sourceNodeId": "joiner", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"message": "join route"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    joiner_run = next(node_run for node_run in body["node_runs"] if node_run["node_id"] == "joiner")
    assert joiner_run["input_payload"]["join"]["expectedSourceIds"] == ["planner", "researcher"]
    assert joiner_run["input_payload"]["join"]["mergeStrategy"] == "error"
    assert [event["event_type"] for event in body["events"]].count("node.join.ready") == 1


def test_execute_workflow_route_supports_edge_mapping_append_merge_strategy(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-mapping-append",
        name="Route Mapping Append Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "planner",
                    "type": "tool",
                    "name": "Planner",
                    "config": {"mock_output": {"topic": "plan"}},
                },
                {
                    "id": "researcher",
                    "type": "tool",
                    "name": "Researcher",
                    "config": {"mock_output": {"topic": "facts"}},
                },
                {
                    "id": "joiner",
                    "type": "tool",
                    "name": "Joiner",
                    "config": {},
                    "runtimePolicy": {
                        "join": {"mode": "all", "mergeStrategy": "append"}
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "planner"},
                {"id": "e2", "sourceNodeId": "trigger", "targetNodeId": "researcher"},
                {
                    "id": "e3",
                    "sourceNodeId": "planner",
                    "targetNodeId": "joiner",
                    "mapping": [{"sourceField": "topic", "targetField": "inputs.topics"}],
                },
                {
                    "id": "e4",
                    "sourceNodeId": "researcher",
                    "targetNodeId": "joiner",
                    "mapping": [{"sourceField": "topic", "targetField": "inputs.topics"}],
                },
                {"id": "e5", "sourceNodeId": "joiner", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"message": "mapping append route"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    joiner_run = next(node_run for node_run in body["node_runs"] if node_run["node_id"] == "joiner")
    assert joiner_run["input_payload"]["inputs"]["topics"] == ["plan", "facts"]


def test_execute_workflow_route_exposes_authorized_context_reads(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    workflow = Workflow(
        id="wf-route-mcp",
        name="Route MCP Workflow",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "planner",
                    "type": "tool",
                    "name": "Planner",
                    "config": {"mock_output": {"plan": "route plan"}},
                },
                {
                    "id": "reader",
                    "type": "mcp_query",
                    "name": "Reader",
                    "config": {
                        "contextAccess": {"readableNodeIds": ["planner"]},
                        "query": {
                            "type": "authorized_context",
                            "sourceNodeIds": ["planner"],
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

    response = client.post(
        f"/api/workflows/{workflow.id}/runs",
        json={"input_payload": {"message": "mcp route"}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["output_payload"] == {
        "reader": {
            "query": {
                "type": "authorized_context",
                "sourceNodeIds": ["planner"],
                "artifactTypes": ["json"],
            },
            "results": [
                {"nodeId": "planner", "artifactType": "json", "content": {"plan": "route plan"}}
            ],
        }
    }
    assert [event["event_type"] for event in body["events"]].count("node.context.read") == 1
