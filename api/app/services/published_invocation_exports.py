from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any, Literal

from app.models.workflow import WorkflowPublishedEndpoint
from app.schemas.workflow_publish import PublishedEndpointInvocationListResponse

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
) -> dict[str, Any]:
    return {
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


def serialize_published_invocation_export_jsonl(payload: dict[str, Any]) -> str:
    lines = [
        json.dumps(
            {
                "record_type": "published_invocation_export",
                "export": payload.get("export") or {},
                "binding": payload.get("binding") or {},
                "filters": payload.get("filters") or {},
                "summary": payload.get("summary") or {},
                "facets": payload.get("facets") or {},
            },
            ensure_ascii=False,
        )
    ]
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
