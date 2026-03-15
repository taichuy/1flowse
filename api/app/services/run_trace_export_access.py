from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Run
from app.models.sensitive_access import (
    SensitiveAccessRequestRecord,
    SensitiveResourceRecord,
)
from app.models.workflow import Workflow
from app.services.sensitive_access_control import SensitiveAccessControlService
from app.services.sensitive_access_types import SensitiveAccessRequestBundle

__all__ = ["RunTraceExportAccessService"]


_TRACE_EXPORT_RESOURCE_KIND = "run_trace_export"
_SENSITIVITY_RANK = {
    "L0": 0,
    "L1": 1,
    "L2": 2,
    "L3": 3,
}


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _match_trace_export_resource(
    record: SensitiveResourceRecord,
    *,
    run_id: str,
) -> bool:
    if record.source != "workspace_resource":
        return False
    metadata_payload = record.metadata_payload if isinstance(record.metadata_payload, dict) else {}
    return (
        str(metadata_payload.get("resource_kind") or "").strip()
        == _TRACE_EXPORT_RESOURCE_KIND
        and str(metadata_payload.get("run_id") or "").strip() == run_id
    )


class RunTraceExportAccessService:
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
        run_id: str,
        requester_id: str,
        purpose_text: str | None = None,
        notification_channel: str = "in_app",
        notification_target: str = "sensitive-access-inbox",
    ) -> SensitiveAccessRequestBundle | None:
        sensitivity_level = self._resolve_export_sensitivity(db, run_id=run_id)
        if sensitivity_level is None:
            return None

        run = db.get(Run, run_id)
        if run is None:
            return None

        resource, require_revalidation = self._find_or_create_export_resource(
            db,
            run=run,
            sensitivity_level=sensitivity_level,
        )
        return self._sensitive_access.ensure_access(
            db,
            run_id=run.id,
            node_run_id=None,
            requester_type="human",
            requester_id=requester_id,
            resource_id=resource.id,
            action_type="export",
            purpose_text=purpose_text or f"export run trace for {run.id}",
            notification_channel=notification_channel,
            notification_target=notification_target,
            reuse_existing=not require_revalidation,
        )

    def _resolve_export_sensitivity(
        self,
        db: Session,
        *,
        run_id: str,
    ) -> str | None:
        statement = (
            select(SensitiveResourceRecord)
            .join(
                SensitiveAccessRequestRecord,
                SensitiveAccessRequestRecord.resource_id == SensitiveResourceRecord.id,
            )
            .where(SensitiveAccessRequestRecord.run_id == run_id)
            .order_by(SensitiveAccessRequestRecord.created_at.desc())
        )
        resources = db.scalars(statement).all()
        if not resources:
            return None

        highest_rank = -1
        highest_level: str | None = None
        for resource in resources:
            rank = _SENSITIVITY_RANK.get(resource.sensitivity_level, 0)
            if rank > highest_rank:
                highest_rank = rank
                highest_level = resource.sensitivity_level
        return highest_level

    def _find_or_create_export_resource(
        self,
        db: Session,
        *,
        run: Run,
        sensitivity_level: str,
    ) -> tuple[SensitiveResourceRecord, bool]:
        existing = self._find_export_resource(db, run_id=run.id)
        if existing is not None:
            if _SENSITIVITY_RANK.get(existing.sensitivity_level, 0) < _SENSITIVITY_RANK.get(
                sensitivity_level,
                0,
            ):
                existing.sensitivity_level = sensitivity_level
                existing.updated_at = _utcnow()
                db.flush()
                return existing, True
            return existing, False

        workflow = db.get(Workflow, run.workflow_id)
        workflow_label = workflow.name if workflow is not None else run.workflow_id
        return (
            self._sensitive_access.create_resource(
                db,
                label=f"Run trace export · {workflow_label}",
                description=f"Sensitive export surface for run {run.id} trace payloads.",
                sensitivity_level=sensitivity_level,
                source="workspace_resource",
                metadata={
                    "resource_kind": _TRACE_EXPORT_RESOURCE_KIND,
                    "run_id": run.id,
                    "workflow_id": run.workflow_id,
                    "workflow_version": run.workflow_version,
                },
            ),
            False,
        )

    def _find_export_resource(
        self,
        db: Session,
        *,
        run_id: str,
    ) -> SensitiveResourceRecord | None:
        records = db.scalars(
            select(SensitiveResourceRecord).where(
                SensitiveResourceRecord.source == "workspace_resource"
            )
        ).all()
        for record in records:
            if _match_trace_export_resource(record, run_id=run_id):
                return record
        return None
