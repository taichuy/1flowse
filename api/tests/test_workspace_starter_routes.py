from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


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

    history_response = client.get(f"/api/workspace-starters/{created['id']}/history")
    assert history_response.status_code == 200
    history_items = history_response.json()
    assert [item["action"] for item in history_items[:2]] == ["updated", "created"]
    assert history_items[0]["payload"]["fields"] == [
        "description",
        "name",
        "recommended_next_step",
        "tags",
        "workflow_focus",
    ]


def test_workspace_starter_archive_and_restore_change_visibility(
    client: TestClient,
) -> None:
    created = _create_workspace_starter(
        client,
        name="Archive Starter",
        business_track="应用新建编排",
        description="Template for archive flow",
    )

    archive_response = client.post(f"/api/workspace-starters/{created['id']}/archive")
    assert archive_response.status_code == 200
    archived = archive_response.json()
    assert archived["archived"] is True
    assert archived["archived_at"] is not None

    default_list = client.get("/api/workspace-starters")
    assert default_list.status_code == 200
    assert default_list.json() == []

    archived_list = client.get(
        "/api/workspace-starters",
        params={"archived_only": True},
    )
    assert archived_list.status_code == 200
    assert [item["id"] for item in archived_list.json()] == [created["id"]]

    restore_response = client.post(f"/api/workspace-starters/{created['id']}/restore")
    assert restore_response.status_code == 200
    restored = restore_response.json()
    assert restored["archived"] is False
    assert restored["archived_at"] is None

    active_list = client.get("/api/workspace-starters")
    assert active_list.status_code == 200
    assert [item["id"] for item in active_list.json()] == [created["id"]]

    history_response = client.get(f"/api/workspace-starters/{created['id']}/history")
    assert history_response.status_code == 200
    history_items = history_response.json()
    assert [item["action"] for item in history_items[:3]] == [
        "restored",
        "archived",
        "created",
    ]


def test_workspace_starter_refresh_updates_snapshot_and_records_history(
    client: TestClient,
    sqlite_session: Session,
    sample_workflow,
) -> None:
    created = _create_workspace_starter(
        client,
        name="Refresh Starter",
        business_track="编排节点能力",
        description="Template for refresh flow",
    )

    sample_workflow.version = "0.1.1"
    sample_workflow.definition = {
        "nodes": [
            {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
            {
                "id": "agent",
                "type": "llm_agent",
                "name": "Agent",
                "config": {"prompt": "Refresh me"},
            },
            {"id": "output", "type": "output", "name": "Output", "config": {}},
        ],
        "edges": [
            {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
            {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
        ],
    }
    sqlite_session.add(sample_workflow)
    sqlite_session.commit()

    refresh_response = client.post(f"/api/workspace-starters/{created['id']}/refresh")
    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()
    assert refreshed["created_from_workflow_version"] == "0.1.1"
    assert [node["id"] for node in refreshed["definition"]["nodes"]] == [
        "trigger",
        "agent",
        "output",
    ]

    history_response = client.get(f"/api/workspace-starters/{created['id']}/history")
    assert history_response.status_code == 200
    history_items = history_response.json()
    assert history_items[0]["action"] == "refreshed"
    assert history_items[0]["payload"] == {
        "source_workflow_id": "wf-demo",
        "previous_workflow_version": "0.1.0",
        "source_workflow_version": "0.1.1",
        "changed": True,
    }


def test_workspace_starter_delete_requires_archive_first(client: TestClient) -> None:
    created = _create_workspace_starter(
        client,
        name="Delete Starter",
        business_track="API 调用开放",
        description="Template for delete flow",
    )

    conflict_response = client.delete(f"/api/workspace-starters/{created['id']}")
    assert conflict_response.status_code == 409

    archive_response = client.post(f"/api/workspace-starters/{created['id']}/archive")
    assert archive_response.status_code == 200

    delete_response = client.delete(f"/api/workspace-starters/{created['id']}")
    assert delete_response.status_code == 204

    detail_response = client.get(
        f"/api/workspace-starters/{created['id']}",
    )
    assert detail_response.status_code == 404
