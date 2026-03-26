from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any, Literal

from app.models.workflow import WorkflowPublishedEndpoint
from app.schemas.workflow_publish import (
    PublishedEndpointInvocationListResponse,
    WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot,
)
from app.services.workflow_definition_governance import (
    resolve_primary_workflow_definition_issue,
)

WORKFLOW_EDITOR_LINK_LABEL = "回到 workflow 编辑器"

__all__ = [
    "build_published_invocation_export_filename",
    "build_published_invocation_export_payload",
    "serialize_published_invocation_export_jsonl",
]


def _utcnow_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return normalized or "binding"


def build_published_invocation_export_filename(
    binding: WorkflowPublishedEndpoint,
    export_format: Literal["json", "jsonl"],
) -> str:
    suffix = "json" if export_format == "json" else "jsonl"
    return (
        f"published-{_slug(binding.endpoint_alias)}-"
        f"{_slug(binding.endpoint_id)}-invocations.{suffix}"
    )


def build_published_invocation_export_payload(
    *,
    binding: WorkflowPublishedEndpoint,
    export_format: Literal["json", "jsonl"],
    limit: int,
    response: PublishedEndpointInvocationListResponse,
    legacy_auth_governance: WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot | None = None,
) -> dict[str, Any]:
    payload = {
        "export": {
            "exported_at": _utcnow_iso(),
            "format": export_format,
            "limit": limit,
            "returned_item_count": len(response.items),
        },
        "binding": {
            "workflow_id": binding.workflow_id,
            "binding_id": binding.id,
            "endpoint_id": binding.endpoint_id,
            "endpoint_alias": binding.endpoint_alias,
            "route_path": binding.route_path,
            "protocol": binding.protocol,
            "auth_mode": binding.auth_mode,
            "workflow_version": binding.workflow_version,
            "target_workflow_version": binding.target_workflow_version,
            "lifecycle_status": binding.lifecycle_status,
        },
        **response.model_dump(mode="json"),
    }

    legacy_auth_governance_payload = _serialize_legacy_auth_governance(
        legacy_auth_governance
    )
    if legacy_auth_governance_payload is not None:
        payload["legacy_auth_governance"] = legacy_auth_governance_payload

    return payload


def _serialize_legacy_auth_governance(
    snapshot: WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot | None,
) -> dict[str, Any] | None:
    if snapshot is None or snapshot.binding_count <= 0:
        return None

    payload = snapshot.model_dump(mode="json")
    serialized_workflows: list[dict[str, Any]] = []
    workflow_follow_up_by_id: dict[str, dict[str, Any]] = {}
    for workflow in payload.pop("workflows", []):
        if not isinstance(workflow, dict):
            continue

        workflow_follow_up = _build_legacy_auth_workflow_follow_up(workflow)
        serialized_workflow = {
            **workflow,
            "workflow_follow_up": workflow_follow_up,
        }
        serialized_workflows.append(serialized_workflow)
        workflow_id = workflow.get("workflow_id")
        if isinstance(workflow_id, str) and workflow_id:
            workflow_follow_up_by_id[workflow_id] = workflow_follow_up

    buckets_payload = payload.get("buckets") if isinstance(payload.get("buckets"), dict) else {}
    serialized_buckets: dict[str, list[dict[str, Any]]] = {}
    for bucket in ("draft_candidates", "published_blockers", "offline_inventory"):
        items = buckets_payload.get(bucket)
        if not isinstance(items, list):
            serialized_buckets[bucket] = []
            continue

        serialized_buckets[bucket] = [
            _serialize_legacy_auth_binding_item(item, workflow_follow_up_by_id)
            for item in items
            if isinstance(item, dict)
        ]

    return {
        "generated_at": payload.get("generated_at"),
        "workflow_count": payload.get("workflow_count"),
        "binding_count": payload.get("binding_count"),
        "auth_mode_contract": payload.get("auth_mode_contract") or {},
        "workflow": serialized_workflows[0] if serialized_workflows else None,
        "summary": payload.get("summary") or {},
        "checklist": payload.get("checklist") or [],
        "buckets": serialized_buckets,
    }


def _build_legacy_auth_workflow_follow_up(
    workflow: dict[str, Any],
) -> dict[str, Any]:
    workflow_id = workflow.get("workflow_id")
    workflow_detail_href = (
        f"/workflows/{workflow_id}"
        if isinstance(workflow_id, str) and workflow_id
        else "/workflows"
    )
    tool_governance = (
        workflow.get("tool_governance")
        if isinstance(workflow.get("tool_governance"), dict)
        else {}
    )
    definition_issue = resolve_primary_workflow_definition_issue(
        tool_governance=tool_governance,
        legacy_auth_governance=workflow,
    )
    if definition_issue is not None:
        workflow_detail_href = f"{workflow_detail_href}?definition_issue={definition_issue}"

    return {
        "workflow_detail_href": workflow_detail_href,
        "workflow_detail_label": WORKFLOW_EDITOR_LINK_LABEL,
        "definition_issue": definition_issue,
    }


def _serialize_legacy_auth_binding_item(
    item: dict[str, Any],
    workflow_follow_up_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    workflow_id = item.get("workflow_id")
    workflow_follow_up = (
        workflow_follow_up_by_id.get(workflow_id)
        if isinstance(workflow_id, str)
        else None
    )
    if workflow_follow_up is None:
        workflow_follow_up = _build_legacy_auth_workflow_follow_up(
            {
                "workflow_id": workflow_id,
            }
        )

    return {
        **item,
        "workflow_follow_up": workflow_follow_up,
    }


def serialize_published_invocation_export_jsonl(payload: dict[str, Any]) -> str:
    governance = (
        payload.get("legacy_auth_governance")
        if isinstance(payload.get("legacy_auth_governance"), dict)
        else None
    )
    lines = [
        json.dumps(
            {
                "record_type": "published_invocation_export",
                "export": payload.get("export") or {},
                "binding": payload.get("binding") or {},
                "filters": payload.get("filters") or {},
                "summary": payload.get("summary") or {},
                "facets": payload.get("facets") or {},
                "legacy_auth_governance": (
                    {
                        "binding_count": governance.get("binding_count"),
                        "auth_mode_contract": governance.get("auth_mode_contract") or {},
                        "workflow": governance.get("workflow"),
                        "summary": governance.get("summary") or {},
                    }
                    if governance is not None
                    else None
                ),
            },
            ensure_ascii=False,
        )
    ]

    if governance is not None:
        lines.append(
            json.dumps(
                {
                    "record_type": "workflow_legacy_auth_governance",
                    "generated_at": governance.get("generated_at"),
                    "workflow_count": governance.get("workflow_count"),
                    "binding_count": governance.get("binding_count"),
                    "auth_mode_contract": governance.get("auth_mode_contract") or {},
                    "workflow": governance.get("workflow"),
                    "summary": governance.get("summary") or {},
                    "checklist": governance.get("checklist") or [],
                },
                ensure_ascii=False,
            )
        )

        buckets = governance.get("buckets") if isinstance(governance.get("buckets"), dict) else {}
        for bucket in ("draft_candidates", "published_blockers", "offline_inventory"):
            items = buckets.get(bucket)
            if not isinstance(items, list):
                continue

            for item in items:
                if not isinstance(item, dict):
                    continue
                lines.append(
                    json.dumps(
                        {
                            "record_type": "workflow_legacy_auth_binding",
                            "bucket": bucket,
                            **item,
                        },
                        ensure_ascii=False,
                    )
                )

    items = payload.get("items") if isinstance(payload.get("items"), list) else []
    lines.extend(
        json.dumps(
            {
                "record_type": "invocation",
                **item,
            },
            ensure_ascii=False,
        )
        for item in items
        if isinstance(item, dict)
    )
    return "\n".join(lines) + "\n"
