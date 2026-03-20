import json

import httpx

from app.services.plugin_runtime_adapter_clients import CompatibilityAdapterHealthChecker
from app.services.plugin_runtime_types import CompatibilityAdapterRegistration


def test_health_checker_uses_adapter_health_payload_status_and_mode() -> None:
    adapter = CompatibilityAdapterRegistration(
        id="dify-default",
        ecosystem="compat:dify",
        endpoint="http://adapter.local",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "http://adapter.local/healthz"
        return httpx.Response(
            200,
            text=json.dumps(
                {
                    "status": "degraded",
                    "adapter_id": "dify-default",
                    "ecosystem": "compat:dify",
                    "mode": "proxy",
                }
            ),
            headers={"content-type": "application/json"},
        )

    checker = CompatibilityAdapterHealthChecker(
        client_factory=lambda timeout_ms: httpx.Client(
            transport=httpx.MockTransport(handler),
            timeout=timeout_ms / 1000,
        )
    )

    health = checker.probe(adapter)

    assert health.status == "degraded"
    assert health.mode == "proxy"
    assert health.detail is None


def test_health_checker_normalizes_ok_status_to_up() -> None:
    adapter = CompatibilityAdapterRegistration(
        id="dify-default",
        ecosystem="compat:dify",
        endpoint="http://adapter.local",
    )

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text=json.dumps(
                {
                    "status": "ok",
                    "adapter_id": "dify-default",
                    "ecosystem": "compat:dify",
                    "mode": "translate",
                }
            ),
            headers={"content-type": "application/json"},
        )

    checker = CompatibilityAdapterHealthChecker(
        client_factory=lambda timeout_ms: httpx.Client(
            transport=httpx.MockTransport(handler),
            timeout=timeout_ms / 1000,
        )
    )

    health = checker.probe(adapter)

    assert health.status == "up"
    assert health.mode == "translate"

