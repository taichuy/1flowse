from fastapi.testclient import TestClient


def _valid_definition() -> dict:
    return {
        "nodes": [
            {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
            {"id": "output", "type": "output", "name": "Output", "config": {}},
        ],
        "edges": [
            {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "output"},
        ],
    }


def _create_workspace_starter(
    client: TestClient,
    *,
    name: str,
    business_track: str,
    description: str,
) -> dict:
    response = client.post(
        "/api/workspace-starters",
        json={
            "workspace_id": "default",
            "name": name,
            "description": description,
            "business_track": business_track,
            "default_workflow_name": f"{name} Workflow",
            "workflow_focus": f"{name} focus",
            "recommended_next_step": f"{name} next",
            "tags": [name.lower(), business_track],
            "definition": _valid_definition(),
            "created_from_workflow_id": "wf-demo",
            "created_from_workflow_version": "0.1.0",
        },
    )

    assert response.status_code == 201
    return response.json()


def test_workspace_starter_list_supports_filters_and_search(client: TestClient) -> None:
    app_template = _create_workspace_starter(
        client,
        name="App Starter",
        business_track="应用新建编排",
        description="Template for application creation",
    )
    _create_workspace_starter(
        client,
        name="API Response Starter",
        business_track="API 调用开放",
        description="Template for API publishing",
    )

    filtered_response = client.get(
        "/api/workspace-starters",
        params={"business_track": "应用新建编排", "search": "application"},
    )

    assert filtered_response.status_code == 200
    filtered_items = filtered_response.json()
    assert [item["id"] for item in filtered_items] == [app_template["id"]]


def test_workspace_starter_detail_returns_single_template(client: TestClient) -> None:
    created = _create_workspace_starter(
        client,
        name="Detail Starter",
        business_track="编排节点能力",
        description="Template for node orchestration",
    )

    response = client.get(f"/api/workspace-starters/{created['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["name"] == "Detail Starter"
    assert body["definition"]["nodes"][0]["id"] == "trigger"


def test_workspace_starter_update_persists_metadata_changes(client: TestClient) -> None:
    created = _create_workspace_starter(
        client,
        name="Original Starter",
        business_track="Dify 插件兼容",
        description="Template for compat tools",
    )

    response = client.put(
        f"/api/workspace-starters/{created['id']}",
        json={
            "name": "Updated Starter",
            "description": "Updated governance description",
            "workflow_focus": "Updated workflow focus",
            "recommended_next_step": "Updated next step",
            "tags": ["updated", "workspace starter"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Updated Starter"
    assert body["description"] == "Updated governance description"
    assert body["workflow_focus"] == "Updated workflow focus"
    assert body["recommended_next_step"] == "Updated next step"
    assert body["tags"] == ["updated", "workspace starter"]
