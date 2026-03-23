from __future__ import annotations

from typing import Any

from app.schemas.workflow_publish import WorkflowPublishedEndpointIssue
from app.schemas.workflow_published_endpoint import (
    SUPPORTED_PUBLISHED_ENDPOINT_AUTH_MODES,
)

_SUPPORTED_PERSISTED_PUBLISH_AUTH_MODES = frozenset(
    SUPPORTED_PUBLISHED_ENDPOINT_AUTH_MODES
)


def is_supported_published_endpoint_auth_mode(value: object) -> bool:
    normalized = _normalize_optional_string(value)
    return normalized in _SUPPORTED_PERSISTED_PUBLISH_AUTH_MODES


def collect_invalid_published_endpoint_auth_mode_issues(
    *,
    endpoint_id: str | None,
    endpoint_name: str | None,
    auth_mode: object,
) -> list[WorkflowPublishedEndpointIssue]:
    normalized_auth_mode = _normalize_optional_string(auth_mode)
    if normalized_auth_mode is None or is_supported_published_endpoint_auth_mode(
        normalized_auth_mode
    ):
        return []

    endpoint_label = (
        _normalize_optional_string(endpoint_name)
        or _normalize_optional_string(endpoint_id)
        or "published endpoint"
    )

    return [
        WorkflowPublishedEndpointIssue(
            category="unsupported_auth_mode",
            message=(
                f"Published endpoint '{endpoint_label}' still uses unsupported legacy auth "
                f"mode '{normalized_auth_mode}'. Current publish lifecycle only supports "
                "durable bindings with auth_mode 'api_key' or 'internal'."
            ),
            field="auth_mode",
            remediation=(
                "Update the workflow definition to use 'api_key' or 'internal', save to "
                "resync bindings, then retry the publish lifecycle action."
            ),
            blocks_lifecycle_publish=True,
        )
    ]


def collect_invalid_workflow_publish_auth_modes(
    definition: dict[str, Any] | None,
) -> list[dict[str, str]]:
    if not isinstance(definition, dict):
        return []

    publish = definition.get("publish")
    if not isinstance(publish, list):
        return []

    issues: list[dict[str, str]] = []
    for index, raw_endpoint in enumerate(publish):
        if not isinstance(raw_endpoint, dict):
            continue

        auth_mode = _normalize_optional_string(raw_endpoint.get("authMode"))
        if auth_mode is None or auth_mode in _SUPPORTED_PERSISTED_PUBLISH_AUTH_MODES:
            continue

        endpoint_id = _normalize_optional_string(raw_endpoint.get("id"))
        endpoint_name = _normalize_optional_string(raw_endpoint.get("name"))
        endpoint_label = endpoint_name or endpoint_id or f"endpoint_{index + 1}"

        issues.append(
            {
                "message": (
                    f"Published endpoint '{endpoint_label}' requests auth mode '{auth_mode}', "
                    "but the current published gateway only supports durable bindings with "
                    "authMode 'api_key' or 'internal'."
                ),
                "path": f"publish.{index}.authMode",
                "field": "authMode",
            }
        )

    return issues


def _normalize_optional_string(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None
