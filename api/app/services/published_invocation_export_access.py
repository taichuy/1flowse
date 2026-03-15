from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sensitive_access import SensitiveResourceRecord
from app.models.workflow import Workflow, WorkflowPublishedEndpoint, WorkflowPublishedInvocation
from app.services.run_sensitive_access_summary import (
    SENSITIVITY_RANK,
    resolve_highest_sensitivity_for_runs,
)
from app.services.sensitive_access_control import SensitiveAccessControlService
from app.services.sensitive_access_types import SensitiveAccessRequestBundle

__all__ = ["PublishedInvocationExportAccessService"]


_PUBLISHED_INVOCATION_EXPORT_RESOURCE_KIND = "published_invocation_export"


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _match_export_resource(
    record: SensitiveResourceRecord,
    *,
    binding_id: str,
) -> bool:
    if record.source != "workspace_resource":
        return False
    metadata_payload = record.metadata_payload if isinstance(record.metadata_payload, dict) else {}
    return (
        str(metadata_payload.get("resource_kind") or "").strip()
        == _PUBLISHED_INVOCATION_EXPORT_RESOURCE_KIND
        and str(metadata_payload.get("binding_id") or "").strip() == binding_id
    )


class PublishedInvocationExportAccessService:
    def __init__(
        self,
        *,
        sensitive_access_service: SensitiveAccessControlService | None = None,
    ) -> None:
        self._sensitive_access = sensitive_access_service or SensitiveAccessControlService()

    def ensure_access(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        records: Sequence[WorkflowPublishedInvocation],
        requester_id: str,
        purpose_text: str | None = None,
        notification_channel: str = "in_app",
        notification_target: str = "sensitive-access-inbox",
    ) -> SensitiveAccessRequestBundle | None:
        run_ids = list(dict.fromkeys(record.run_id for record in records if record.run_id))
        sensitivity_level = resolve_highest_sensitivity_for_runs(db, run_ids=run_ids)
        if sensitivity_level is None:
            return None

        resource, require_revalidation = self._find_or_create_export_resource(
            db,
            binding=binding,
            records=records,
            run_ids=run_ids,
            sensitivity_level=sensitivity_level,
        )
        return self._sensitive_access.ensure_access(
            db,
            run_id=None,
            node_run_id=None,
            requester_type="human",
            requester_id=requester_id,
            resource_id=resource.id,
            action_type="export",
            purpose_text=purpose_text or f"export published invocations for {binding.id}",
            notification_channel=notification_channel,
            notification_target=notification_target,
            reuse_existing=not require_revalidation,
        )

    def _find_or_create_export_resource(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        records: Sequence[WorkflowPublishedInvocation],
        run_ids: list[str],
        sensitivity_level: str,
    ) -> tuple[SensitiveResourceRecord, bool]:
        metadata = {
            "resource_kind": _PUBLISHED_INVOCATION_EXPORT_RESOURCE_KIND,
            "workflow_id": binding.workflow_id,
            "binding_id": binding.id,
            "endpoint_id": binding.endpoint_id,
            "endpoint_alias": binding.endpoint_alias,
            "invocation_count": len(records),
            "run_count": len(run_ids),
            "run_ids": list(run_ids),
            "latest_invocation_id": records[0].id if records else None,
            "latest_invoked_at": records[0].created_at.isoformat() if records else None,
        }
        existing = self._find_export_resource(db, binding_id=binding.id)
        if existing is not None:
            require_revalidation = False
            metadata_changed = existing.metadata_payload != metadata
            if SENSITIVITY_RANK.get(existing.sensitivity_level, 0) < SENSITIVITY_RANK.get(
                sensitivity_level,
                0,
            ):
                existing.sensitivity_level = sensitivity_level
                require_revalidation = True
            if metadata_changed:
                existing.metadata_payload = metadata
            if require_revalidation or metadata_changed:
                existing.updated_at = _utcnow()
                db.flush()
            return existing, require_revalidation

        workflow = db.get(Workflow, binding.workflow_id)
        workflow_label = workflow.name if workflow is not None else binding.workflow_id
        return (
            self._sensitive_access.create_resource(
                db,
                label=(
                    f"Published invocation export · {workflow_label} / {binding.endpoint_alias}"
                ),
                description=(
                    "Sensitive export surface for published invocation audit payloads "
                    f"under binding {binding.id}."
                ),
                sensitivity_level=sensitivity_level,
                source="workspace_resource",
                metadata=metadata,
            ),
            False,
        )

    def _find_export_resource(
        self,
        db: Session,
        *,
        binding_id: str,
    ) -> SensitiveResourceRecord | None:
        records = db.scalars(
            select(SensitiveResourceRecord).where(
                SensitiveResourceRecord.source == "workspace_resource"
            )
        ).all()
        for record in records:
            if _match_export_resource(record, binding_id=binding_id):
                return record
        return None
