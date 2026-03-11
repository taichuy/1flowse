from fastapi.testclient import TestClient


def _publishable_definition(
    *,
    answer: str = "done",
    workflow_version: str | None = "0.1.0",
) -> dict:
    endpoint: dict[str, object] = {
        "id": "native-chat",
        "name": "Native Chat",
        "protocol": "native",
        "authMode": "internal",
        "streaming": False,
        "inputSchema": {"type": "object"},
    }
    if workflow_version is not None:
        endpoint["workflowVersion"] = workflow_version

    return {
        "nodes": [
            {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
            {
                "id": "tool",
                "type": "tool",
                "name": "Tool",
                "config": {"mock_output": {"answer": answer}},
            },
            {"id": "output", "type": "output", "name": "Output", "config": {}},
        ],
        "edges": [
            {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "tool"},
            {"id": "e2", "sourceNodeId": "tool", "targetNodeId": "output"},
        ],
        "publish": [endpoint],
    }


def test_create_workflow_persists_publish_bindings(client: TestClient) -> None:
    create_response = client.post(
        "/api/workflows",
        json={
            "name": "Publishable Workflow",
            "definition": _publishable_definition(),
        },
    )

    assert create_response.status_code == 201
    workflow_id = create_response.json()["id"]

    response = client.get(f"/api/workflows/{workflow_id}/published-endpoints")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["workflow_version"] == "0.1.0"
    assert body[0]["target_workflow_version"] == "0.1.0"
    assert body[0]["compiled_blueprint_id"] is not None
    assert body[0]["endpoint_id"] == "native-chat"


def test_list_published_endpoints_supports_current_and_all_versions(
    client: TestClient,
) -> None:
    create_response = client.post(
        "/api/workflows",
        json={
            "name": "Versioned Publish Workflow",
            "definition": _publishable_definition(),
        },
    )
    assert create_response.status_code == 201
    workflow_id = create_response.json()["id"]

    update_response = client.put(
        f"/api/workflows/{workflow_id}",
        json={
            "definition": {
                **_publishable_definition(answer="updated", workflow_version=None),
                "publish": [
                    {
                        "id": "native-chat",
                        "name": "Native Chat Stable",
                        "protocol": "native",
                        "workflowVersion": "0.1.0",
                        "authMode": "internal",
                        "streaming": False,
                        "inputSchema": {"type": "object"},
                    },
                    {
                        "id": "openai-chat",
                        "name": "OpenAI Chat Latest",
                        "protocol": "openai",
                        "authMode": "api_key",
                        "streaming": True,
                        "inputSchema": {"type": "object"},
                    },
                ],
            }
        },
    )
    assert update_response.status_code == 200

    current_response = client.get(f"/api/workflows/{workflow_id}/published-endpoints")
    assert current_response.status_code == 200
    current_body = current_response.json()
    assert [item["endpoint_id"] for item in current_body] == ["native-chat", "openai-chat"]
    assert current_body[0]["workflow_version"] == "0.1.1"
    assert current_body[0]["target_workflow_version"] == "0.1.0"
    assert current_body[1]["target_workflow_version"] == "0.1.1"

    all_versions_response = client.get(
        f"/api/workflows/{workflow_id}/published-endpoints",
        params={"include_all_versions": "true"},
    )
    assert all_versions_response.status_code == 200
    all_versions_body = all_versions_response.json()
    assert [
        (item["workflow_version"], item["endpoint_id"])
        for item in all_versions_body
    ] == [
        ("0.1.1", "native-chat"),
        ("0.1.1", "openai-chat"),
        ("0.1.0", "native-chat"),
    ]


def test_create_workflow_rejects_publish_binding_to_unknown_version(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/workflows",
        json={
            "name": "Broken Publish Binding",
            "definition": _publishable_definition(workflow_version="9.9.9"),
        },
    )

    assert response.status_code == 422
    assert "references unknown workflow version" in response.json()["detail"]
