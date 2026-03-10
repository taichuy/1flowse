from fastapi.testclient import TestClient


def _valid_definition(answer: str = "done", runtime_policy: dict | None = None) -> dict:
    return {
        "nodes": [
            {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
            {
                "id": "tool",
                "type": "tool",
                "name": "Tool",
                "config": {"mock_output": {"answer": answer}},
                "runtimePolicy": runtime_policy,
            },
            {"id": "output", "type": "output", "name": "Output", "config": {}},
        ],
        "edges": [
            {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "tool"},
            {"id": "e2", "sourceNodeId": "tool", "targetNodeId": "output"},
        ],
    }


def _valid_mcp_definition() -> dict:
    return {
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
    }


def test_create_workflow_persists_initial_version(client: TestClient) -> None:
    response = client.post(
        "/api/workflows",
        json={"name": "Validated Workflow", "definition": _valid_definition()},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Validated Workflow"
    assert body["version"] == "0.1.0"
    assert body["definition"]["edges"][0]["channel"] == "control"
    assert [version["version"] for version in body["versions"]] == ["0.1.0"]


def test_create_workflow_rejects_invalid_definition(client: TestClient) -> None:
    response = client.post(
        "/api/workflows",
        json={
            "name": "Broken Workflow",
            "definition": {
                "nodes": [{"id": "tool", "type": "tool", "name": "Tool", "config": {}}],
                "edges": [],
            },
        },
    )

    assert response.status_code == 422
    assert "trigger node" in response.json()["detail"]


def test_update_workflow_bumps_version_and_keeps_history(
    client: TestClient,
    sample_workflow,
) -> None:
    response = client.put(
        f"/api/workflows/{sample_workflow.id}",
        json={"definition": _valid_definition(answer="updated")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "0.1.1"
    assert body["definition"]["nodes"][1]["config"]["mock_output"]["answer"] == "updated"
    assert [version["version"] for version in body["versions"]] == ["0.1.1", "0.1.0"]

    versions_response = client.get(f"/api/workflows/{sample_workflow.id}/versions")
    assert versions_response.status_code == 200
    assert [version["version"] for version in versions_response.json()] == ["0.1.1", "0.1.0"]


def test_create_workflow_accepts_retry_runtime_policy(client: TestClient) -> None:
    response = client.post(
        "/api/workflows",
        json={
            "name": "Retry Workflow",
            "definition": _valid_definition(
                runtime_policy={
                    "retry": {
                        "maxAttempts": 3,
                        "backoffSeconds": 1,
                        "backoffMultiplier": 2,
                    }
                }
            ),
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["definition"]["nodes"][1]["runtimePolicy"]["retry"]["maxAttempts"] == 3


def test_create_workflow_rejects_invalid_retry_runtime_policy(client: TestClient) -> None:
    response = client.post(
        "/api/workflows",
        json={
            "name": "Broken Retry Workflow",
            "definition": _valid_definition(
                runtime_policy={
                    "retry": {
                        "maxAttempts": 0,
                    }
                }
            ),
        },
    )

    assert response.status_code == 422
    assert "maxAttempts" in response.json()["detail"]


def test_create_workflow_accepts_authorized_context_mcp_query(client: TestClient) -> None:
    response = client.post(
        "/api/workflows",
        json={"name": "MCP Workflow", "definition": _valid_mcp_definition()},
    )

    assert response.status_code == 201
    body = response.json()
    reader_node = next(node for node in body["definition"]["nodes"] if node["id"] == "reader")
    assert reader_node["config"]["query"]["type"] == "authorized_context"
    assert reader_node["config"]["contextAccess"]["readableNodeIds"] == ["planner"]


def test_create_workflow_rejects_unauthorized_mcp_query_source(client: TestClient) -> None:
    definition = _valid_mcp_definition()
    definition["nodes"].insert(
        2,
        {
            "id": "search",
            "type": "tool",
            "name": "Search",
            "config": {"mock_output": {"docs": ["x"]}},
        },
    )
    definition["edges"] = [
        {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "planner"},
        {"id": "e2", "sourceNodeId": "planner", "targetNodeId": "search"},
        {"id": "e3", "sourceNodeId": "search", "targetNodeId": "reader"},
        {"id": "e4", "sourceNodeId": "reader", "targetNodeId": "output"},
    ]
    reader_node = next(node for node in definition["nodes"] if node["id"] == "reader")
    reader_node["config"]["query"]["sourceNodeIds"] = ["planner", "search"]

    response = client.post(
        "/api/workflows",
        json={"name": "Broken MCP Workflow", "definition": definition},
    )

    assert response.status_code == 422
    assert "unauthorized source nodes" in response.json()["detail"]
