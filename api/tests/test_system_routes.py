from datetime import UTC, datetime
from types import SimpleNamespace

from app.api.routes import system as system_routes
from app.models.run import Run, RunEvent
from app.services.plugin_runtime import (
    CompatibilityAdapterHealth,
    PluginRegistry,
    PluginToolDefinition,
)


class _HealthyRedis:
    def ping(self) -> bool:
        return True


class _HealthyS3Client:
    def list_buckets(self) -> dict:
        return {"Buckets": []}


class _StaticHealthChecker:
    def __init__(self, healths: list[CompatibilityAdapterHealth]) -> None:
        self._healths = healths

    def probe_all(self, registry: PluginRegistry) -> list[CompatibilityAdapterHealth]:
        return self._healths


def test_system_overview_includes_plugin_adapter_health(client, monkeypatch) -> None:
    registry = PluginRegistry()
    registry.register_tool(
        PluginToolDefinition(
            id="compat:dify:plugin:demo/search",
            name="Demo Search",
            ecosystem="compat:dify",
            source="plugin",
        )
    )
    monkeypatch.setattr(system_routes, "get_settings", lambda: SimpleNamespace(
        env="test",
        redis_url="redis://example",
        s3_endpoint="http://example",
        s3_access_key="key",
        s3_secret_key="secret",
        s3_region="us-east-1",
        s3_use_ssl=False,
    ))
    monkeypatch.setattr(system_routes, "check_database", lambda: True)
    monkeypatch.setattr(system_routes.redis, "from_url", lambda url: _HealthyRedis())
    monkeypatch.setattr(system_routes.boto3, "client", lambda *args, **kwargs: _HealthyS3Client())
    monkeypatch.setattr(system_routes, "get_plugin_registry", lambda: registry)
    monkeypatch.setattr(
        system_routes,
        "get_compatibility_adapter_health_checker",
        lambda: _StaticHealthChecker(
            [
                CompatibilityAdapterHealth(
                    id="dify-default",
                    ecosystem="compat:dify",
                    endpoint="http://adapter.local",
                    enabled=True,
                    status="up",
                )
            ]
        ),
    )

    response = client.get("/api/system/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "plugin-call-proxy-foundation" in body["capabilities"]
    assert "plugin-adapter-health-probe" in body["capabilities"]
    assert "plugin-tool-catalog-visible" in body["capabilities"]
    assert "runtime-events-visible" in body["capabilities"]
    assert body["plugin_adapters"] == [
        {
            "id": "dify-default",
            "ecosystem": "compat:dify",
            "endpoint": "http://adapter.local",
            "enabled": True,
            "status": "up",
            "detail": None,
        }
    ]
    assert body["plugin_tools"] == [
        {
            "id": "compat:dify:plugin:demo/search",
            "name": "Demo Search",
            "ecosystem": "compat:dify",
            "source": "plugin",
            "callable": True,
        }
    ]
    assert body["runtime_activity"] == {"recent_runs": [], "recent_events": []}
    assert any(service["name"] == "plugin-adapter:dify-default" for service in body["services"])


def test_list_plugin_adapters_returns_current_adapter_health(client, monkeypatch) -> None:
    monkeypatch.setattr(system_routes, "get_plugin_registry", lambda: PluginRegistry())
    monkeypatch.setattr(
        system_routes,
        "get_compatibility_adapter_health_checker",
        lambda: _StaticHealthChecker(
            [
                CompatibilityAdapterHealth(
                    id="dify-default",
                    ecosystem="compat:dify",
                    endpoint="http://adapter.local",
                    enabled=True,
                    status="down",
                    detail="connect timeout",
                )
            ]
        ),
    )

    response = client.get("/api/system/plugin-adapters")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "dify-default",
            "ecosystem": "compat:dify",
            "endpoint": "http://adapter.local",
            "enabled": True,
            "status": "down",
            "detail": "connect timeout",
        }
    ]


def test_runtime_activity_returns_recent_runs_and_events(
    client,
    sqlite_session,
    sample_workflow,
    monkeypatch,
) -> None:
    created_at = datetime.now(UTC)
    sqlite_session.add(
        Run(
            id="run-demo",
            workflow_id=sample_workflow.id,
            workflow_version=sample_workflow.version,
            status="succeeded",
            input_payload={"topic": "diagnostics"},
            output_payload={"answer": "ok"},
            created_at=created_at,
            finished_at=created_at,
        )
    )
    sqlite_session.add(
        RunEvent(
            run_id="run-demo",
            node_run_id=None,
            event_type="run.completed",
            payload={"summary": "done"},
            created_at=created_at,
        )
    )
    sqlite_session.commit()

    monkeypatch.setattr(system_routes, "get_plugin_registry", lambda: PluginRegistry())
    response = client.get("/api/system/runtime-activity")
    created_at_text = created_at.isoformat().replace("+00:00", "")

    assert response.status_code == 200
    assert response.json() == {
        "recent_runs": [
            {
                "id": "run-demo",
                "workflow_id": sample_workflow.id,
                "workflow_version": sample_workflow.version,
                "status": "succeeded",
                "created_at": created_at_text,
                "finished_at": created_at_text,
                "event_count": 1,
            }
        ],
        "recent_events": [
            {
                "id": 1,
                "run_id": "run-demo",
                "node_run_id": None,
                "event_type": "run.completed",
                "payload": {"summary": "done"},
                "created_at": created_at_text,
            }
        ],
    }
