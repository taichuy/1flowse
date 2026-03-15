from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sensitive_access import SensitiveResourceRecord
from app.models.workflow import Workflow, WorkflowPublishedInvocation
from app.services.run_sensitive_access_summary import (
    SENSITIVITY_RANK,
    resolve_highest_run_sensitivity,
)
from app.services.sensitive_access_control import SensitiveAccessControlService
from app.services.sensitive_access_types import SensitiveAccessRequestBundle

__all__ = ["PublishedInvocationDetailAccessService"]


_PUBLISHED_INVOCATION_DETAIL_RESOURCE_KIND = "published_invocation_detail"


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _match_invocation_detail_resource(
    record: SensitiveResourceRecord,
    *,
    invocation_id: str,
) -> bool:
    if record.source != "workspace_resource":
        return False
    metadata_payload = record.metadata_payload if isinstance(record.metadata_payload, dict) else {}
    return (
        str(metadata_payload.get("resource_kind") or "").strip()
        == _PUBLISHED_INVOCATION_DETAIL_RESOURCE_KIND
        and str(metadata_payload.get("invocation_id") or "").strip() == invocation_id
    )


class PublishedInvocationDetailAccessService:
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
        invocation: WorkflowPublishedInvocation,
        requester_id: str,
        purpose_text: str | None = None,
        notification_channel: str = "in_app",
        notification_target: str = "sensitive-access-inbox",
    ) -> SensitiveAccessRequestBundle | None:
        if not invocation.run_id:
            return None

        sensitivity_level = resolve_highest_run_sensitivity(db, run_id=invocation.run_id)
        if sensitivity_level is None:
            return None

        resource, require_revalidation = self._find_or_create_detail_resource(
            db,
            invocation=invocation,
            sensitivity_level=sensitivity_level,
        )
        return self._sensitive_access.ensure_access(
            db,
            run_id=invocation.run_id,
            node_run_id=None,
            requester_type="human",
            requester_id=requester_id,
            resource_id=resource.id,
            action_type="read",
            purpose_text=purpose_text or f"read published invocation detail for {invocation.id}",
            notification_channel=notification_channel,
            notification_target=notification_target,
            reuse_existing=not require_revalidation,
        )

    def _find_or_create_detail_resource(
        self,
        db: Session,
        *,
        invocation: WorkflowPublishedInvocation,
        sensitivity_level: str,
    ) -> tuple[SensitiveResourceRecord, bool]:
        existing = self._find_detail_resource(db, invocation_id=invocation.id)
        if existing is not None:
            if SENSITIVITY_RANK.get(existing.sensitivity_level, 0) < SENSITIVITY_RANK.get(
                sensitivity_level,
                0,
            ):
                existing.sensitivity_level = sensitivity_level
                existing.updated_at = _utcnow()
                db.flush()
                return existing, True
            return existing, False

        workflow = db.get(Workflow, invocation.workflow_id)
        workflow_label = workflow.name if workflow is not None else invocation.workflow_id
        return (
            self._sensitive_access.create_resource(
                db,
                label=(
                    f"Published invocation detail · {workflow_label} / {invocation.endpoint_alias}"
                ),
                description=(
                    f"Sensitive detail surface for published invocation {invocation.id}."
                ),
                sensitivity_level=sensitivity_level,
                source="workspace_resource",
                metadata={
                    "resource_kind": _PUBLISHED_INVOCATION_DETAIL_RESOURCE_KIND,
                    "workflow_id": invocation.workflow_id,
                    "binding_id": invocation.binding_id,
                    "invocation_id": invocation.id,
                    "run_id": invocation.run_id,
                    "endpoint_id": invocation.endpoint_id,
                    "endpoint_alias": invocation.endpoint_alias,
                },
            ),
            False,
        )

    def _find_detail_resource(
        self,
        db: Session,
        *,
        invocation_id: str,
    ) -> SensitiveResourceRecord | None:
        records = db.scalars(
            select(SensitiveResourceRecord).where(
                SensitiveResourceRecord.source == "workspace_resource"
            )
        ).all()
        for record in records:
            if _match_invocation_detail_resource(record, invocation_id=invocation_id):
                return record
        return None
