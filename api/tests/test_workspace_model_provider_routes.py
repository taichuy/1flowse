from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.credential_store import CredentialStore
from app.services.model_provider_registry import (
    ModelProviderRegistryError,
    ModelProviderRegistryService,
)


def _auth_headers(token: str | None) -> dict[str, str]:
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def _csrf_headers(body: dict[str, object]) -> dict[str, str]:
    headers = _auth_headers(body.get("access_token") if isinstance(body, dict) else None)
    csrf_token = body.get("csrf_token") if isinstance(body, dict) else None
    if isinstance(csrf_token, str) and csrf_token:
        headers["X-CSRF-Token"] = csrf_token
    return headers


def _login(client: TestClient, *, email: str, password: str) -> dict[str, object]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def test_model_provider_registry_service_rejects_incompatible_credential_type(
    sqlite_session: Session,
) -> None:
    credential = CredentialStore().create(
        sqlite_session,
        name="Anthropic Key",
        credential_type="anthropic_api_key",
        data={"api_key": "anthropic-secret"},
    )
    sqlite_session.commit()

    service = ModelProviderRegistryService()
    try:
        service.create_provider_config(
            sqlite_session,
            workspace_id="default",
            provider_id="openai",
            label="OpenAI Prod",
            description="",
            credential_ref=f"credential://{credential.id}",
            base_url=None,
            default_model=None,
            protocol=None,
            status="active",
        )
    except ModelProviderRegistryError as exc:
        assert "OpenAI" in str(exc)
    else:
        raise AssertionError("Expected incompatible credential validation to fail.")


def test_workspace_model_provider_registry_crud_flow(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    credential_store = CredentialStore()
    openai_credential = credential_store.create(
        sqlite_session,
        name="OpenAI Team Key",
        credential_type="openai_api_key",
        data={"api_key": "openai-secret"},
    )
    anthropic_credential = credential_store.create(
        sqlite_session,
        name="Claude Team Key",
        credential_type="anthropic_api_key",
        data={"api_key": "anthropic-secret"},
    )
    sqlite_session.commit()

    owner_login = _login(client, email="admin@taichuy.com", password="admin123")

    create_response = client.post(
        "/api/workspace/model-providers",
        headers=_csrf_headers(owner_login),
        json={
            "provider_id": "openai",
            "label": "OpenAI Production",
            "description": "主团队 OpenAI 供应商",
            "credential_ref": f"credential://{openai_credential.id}",
            "base_url": "https://api.openai.com/v1",
            "default_model": "gpt-4.1",
            "protocol": "responses",
            "status": "active",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["provider_id"] == "openai"
    assert created["credential_ref"] == f"credential://{openai_credential.id}"
    assert created["protocol"] == "responses"

    list_response = client.get(
        "/api/workspace/model-providers",
        headers=_auth_headers(owner_login["access_token"]),
    )
    assert list_response.status_code == 200
    body = list_response.json()
    assert {item["id"] for item in body["catalog"]} == {"openai", "anthropic"}
    assert body["items"][0]["label"] == "OpenAI Production"

    update_response = client.put(
        f"/api/workspace/model-providers/{created['id']}",
        headers=_csrf_headers(owner_login),
        json={
            "provider_id": "anthropic",
            "label": "Claude Primary",
            "credential_ref": f"credential://{anthropic_credential.id}",
            "base_url": "https://api.anthropic.com",
            "default_model": "claude-3-7-sonnet-latest",
            "protocol": "messages",
            "status": "active",
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["provider_id"] == "anthropic"
    assert updated["credential_ref"] == f"credential://{anthropic_credential.id}"
    assert updated["provider_label"] == "Anthropic"

    deactivate_response = client.delete(
        f"/api/workspace/model-providers/{created['id']}",
        headers=_csrf_headers(owner_login),
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["status"] == "inactive"
    assert deactivate_response.json()["disabled_at"] is not None


def test_workspace_model_provider_registry_write_requires_manager_and_csrf(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    credential = CredentialStore().create(
        sqlite_session,
        name="OpenAI Viewer Key",
        credential_type="openai_api_key",
        data={"api_key": "viewer-openai-secret"},
    )
    sqlite_session.commit()

    owner_login = _login(client, email="admin@taichuy.com", password="admin123")
    create_member_response = client.post(
        "/api/workspace/members",
        headers=_csrf_headers(owner_login),
        json={
            "email": "viewer@taichuy.com",
            "display_name": "Viewer User",
            "password": "viewer123",
            "role": "viewer",
        },
    )
    assert create_member_response.status_code == 201

    viewer_login = _login(client, email="viewer@taichuy.com", password="viewer123")

    missing_csrf_response = client.post(
        "/api/workspace/model-providers",
        headers=_auth_headers(owner_login["access_token"]),
        json={
            "provider_id": "openai",
            "label": "OpenAI No CSRF",
            "credential_ref": f"credential://{credential.id}",
        },
    )
    assert missing_csrf_response.status_code == 403

    viewer_forbidden_response = client.post(
        "/api/workspace/model-providers",
        headers=_csrf_headers(viewer_login),
        json={
            "provider_id": "openai",
            "label": "Viewer OpenAI",
            "credential_ref": f"credential://{credential.id}",
        },
    )
    assert viewer_forbidden_response.status_code == 403
    assert viewer_forbidden_response.json()["detail"] == "当前账号没有团队模型供应商管理权限。"

    viewer_list_response = client.get(
        "/api/workspace/model-providers",
        headers=_auth_headers(viewer_login["access_token"]),
    )
    assert viewer_list_response.status_code == 200
    assert len(viewer_list_response.json()["catalog"]) == 2


def test_workspace_model_provider_settings_requires_manager_before_loading_credentials(
    client: TestClient,
    sqlite_session: Session,
) -> None:
    credential_store = CredentialStore()
    openai_credential = credential_store.create(
        sqlite_session,
        name="OpenAI Team Key",
        credential_type="openai_api_key",
        data={"api_key": "openai-secret"},
    )
    sqlite_session.commit()

    owner_login = _login(client, email="admin@taichuy.com", password="admin123")
    create_member_response = client.post(
        "/api/workspace/members",
        headers=_csrf_headers(owner_login),
        json={
            "email": "viewer@taichuy.com",
            "display_name": "Viewer User",
            "password": "viewer123",
            "role": "viewer",
        },
    )
    assert create_member_response.status_code == 201

    client.post(
        "/api/workspace/model-providers",
        headers=_csrf_headers(owner_login),
        json={
            "provider_id": "openai",
            "label": "OpenAI Production",
            "description": "主团队 OpenAI 供应商",
            "credential_ref": f"credential://{openai_credential.id}",
            "base_url": "https://api.openai.com/v1",
            "default_model": "gpt-4.1",
            "protocol": "responses",
            "status": "active",
        },
    )

    owner_settings_response = client.get(
        "/api/workspace/model-providers/settings",
        headers=_auth_headers(owner_login["access_token"]),
    )
    assert owner_settings_response.status_code == 200
    owner_settings_body = owner_settings_response.json()
    assert owner_settings_body["registry"]["items"][0]["label"] == "OpenAI Production"
    assert owner_settings_body["credentials"][0]["id"] == openai_credential.id

    viewer_login = _login(client, email="viewer@taichuy.com", password="viewer123")
    viewer_settings_response = client.get(
        "/api/workspace/model-providers/settings",
        headers=_auth_headers(viewer_login["access_token"]),
    )
    assert viewer_settings_response.status_code == 403
    assert viewer_settings_response.json()["detail"] == "当前账号没有团队模型供应商管理权限。"
