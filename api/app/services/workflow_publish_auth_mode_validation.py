from __future__ import annotations

from typing import Any

from app.schemas.workflow_legacy_auth_governance import (
    WorkflowPublishedEndpointLegacyAuthModeContract,
)
from app.schemas.workflow_publish import WorkflowPublishedEndpointIssue
from app.schemas.workflow_published_endpoint import (
    SUPPORTED_PUBLISHED_ENDPOINT_AUTH_MODES,
)

_SUPPORTED_PERSISTED_PUBLISH_AUTH_MODES = frozenset(
    SUPPORTED_PUBLISHED_ENDPOINT_AUTH_MODES
)


def format_workflow_publish_auth_modes(modes: list[str]) -> str:
    return " / ".join(mode.strip() for mode in modes if isinstance(mode, str) and mode.strip())


def build_workflow_publish_auth_mode_contract_summary(
    contract: WorkflowPublishedEndpointLegacyAuthModeContract | None = None,
) -> str:
    resolved_contract = contract or WorkflowPublishedEndpointLegacyAuthModeContract()
    return (
        "Publish auth contract: "
        f"supported {format_workflow_publish_auth_modes(resolved_contract.supported_auth_modes)}; "
        f"legacy {format_workflow_publish_auth_modes(resolved_contract.retired_legacy_auth_modes)}."
    )


def build_workflow_publish_auth_mode_follow_up(
    contract: WorkflowPublishedEndpointLegacyAuthModeContract | None = None,
) -> str:
    resolved_contract = contract or WorkflowPublishedEndpointLegacyAuthModeContract()
    return resolved_contract.follow_up


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
    contract = WorkflowPublishedEndpointLegacyAuthModeContract()

    return [
        WorkflowPublishedEndpointIssue(
            category="unsupported_auth_mode",
            message=(
                f"Published endpoint '{endpoint_label}' still uses unsupported legacy auth "
                f"mode '{normalized_auth_mode}'. "
                f"{build_workflow_publish_auth_mode_contract_summary(contract)}"
            ),
            field="auth_mode",
            remediation=build_workflow_publish_auth_mode_follow_up(contract),
            auth_mode_contract=contract,
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
                    "which is not supported for durable publish bindings. "
                    f"{build_workflow_publish_auth_mode_contract_summary()}"
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
