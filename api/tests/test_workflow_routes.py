from fastapi.testclient import TestClient


def _valid_definition(answer: str = "done") -> dict:
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
