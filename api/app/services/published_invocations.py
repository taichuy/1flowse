from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.workflow import (
    WorkflowPublishedEndpoint,
    WorkflowPublishedInvocation,
)
from app.services.published_invocation_audit import PublishedInvocationAuditMixin
from app.services.published_invocation_types import (
    PublishedInvocationApiKeyBucketFacet,
    PublishedInvocationApiKeyUsage,
    PublishedInvocationAudit,
    PublishedInvocationBucketFacet,
    PublishedInvocationCacheStatus,
    PublishedInvocationFacet,
    PublishedInvocationFailureReason,
    PublishedInvocationReasonCode,
    PublishedInvocationRequestSource,
    PublishedInvocationRequestSurface,
    PublishedInvocationStatus,
    PublishedInvocationSummary,
    PublishedInvocationTimeBucket,
    classify_invocation_reason,
)

__all__ = [
    "PublishedInvocationApiKeyBucketFacet",
    "PublishedInvocationApiKeyUsage",
    "PublishedInvocationAudit",
    "PublishedInvocationBucketFacet",
    "PublishedInvocationCacheStatus",
    "PublishedInvocationFacet",
    "PublishedInvocationFailureReason",
    "PublishedInvocationReasonCode",
    "PublishedInvocationRequestSource",
    "PublishedInvocationRequestSurface",
    "PublishedInvocationService",
    "PublishedInvocationStatus",
    "PublishedInvocationSummary",
    "PublishedInvocationTimeBucket",
    "classify_invocation_reason",
]


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _build_payload_preview(payload: dict) -> dict:
    keys = sorted(payload.keys())
    preview: dict[str, object] = {
        "key_count": len(keys),
        "keys": keys[:10],
    }

    scalar_preview: dict[str, object] = {}
    for key in keys[:5]:
        value = payload.get(key)
        if value is None or isinstance(value, (bool, int, float)):
            scalar_preview[key] = value
            continue
        if isinstance(value, str):
            scalar_preview[key] = value[:120]
            continue
        if isinstance(value, list):
            scalar_preview[key] = {
                "type": "list",
                "length": len(value),
            }
            continue
        if isinstance(value, dict):
            nested_keys = sorted(value.keys())
            scalar_preview[key] = {
                "type": "object",
                "key_count": len(nested_keys),
                "keys": nested_keys[:5],
            }
            continue
        scalar_preview[key] = {"type": type(value).__name__}

    if scalar_preview:
        preview["sample"] = scalar_preview
    return preview


class PublishedInvocationService(PublishedInvocationAuditMixin):
    def count_recent_for_binding(
        self,
        db: Session,
        *,
        workflow_id: str,
        binding_id: str,
        created_from: datetime,
        statuses: tuple[PublishedInvocationStatus, ...] = ("succeeded", "failed"),
    ) -> int:
        return (
            db.scalar(
                select(func.count())
                .select_from(WorkflowPublishedInvocation)
                .where(
                    WorkflowPublishedInvocation.workflow_id == workflow_id,
                    WorkflowPublishedInvocation.binding_id == binding_id,
                    WorkflowPublishedInvocation.created_at >= _as_utc(created_from),
                    WorkflowPublishedInvocation.status.in_(statuses),
                )
            )
            or 0
        )

    def _build_binding_statement(
        self,
        *,
        workflow_id: str,
        binding_id: str,
        status: PublishedInvocationStatus | None = None,
        request_source: PublishedInvocationRequestSource | None = None,
        cache_status: PublishedInvocationCacheStatus | None = None,
        run_status: str | None = None,
        api_key_id: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ):
        statement = select(WorkflowPublishedInvocation).where(
            WorkflowPublishedInvocation.workflow_id == workflow_id,
            WorkflowPublishedInvocation.binding_id == binding_id,
        )
        if status is not None:
            statement = statement.where(WorkflowPublishedInvocation.status == status)
        if request_source is not None:
            statement = statement.where(
                WorkflowPublishedInvocation.request_source == request_source
            )
        if cache_status is not None:
            statement = statement.where(
                WorkflowPublishedInvocation.cache_status == cache_status
            )
        if run_status is not None:
            statement = statement.where(WorkflowPublishedInvocation.run_status == run_status)
        if api_key_id is not None:
            statement = statement.where(WorkflowPublishedInvocation.api_key_id == api_key_id)
        if created_from is not None:
            statement = statement.where(
                WorkflowPublishedInvocation.created_at >= _as_utc(created_from)
            )
        if created_to is not None:
            statement = statement.where(
                WorkflowPublishedInvocation.created_at <= _as_utc(created_to)
            )
        return statement

    def _list_binding_records(
        self,
        db: Session,
        *,
        workflow_id: str,
        binding_id: str,
        status: PublishedInvocationStatus | None = None,
        request_source: PublishedInvocationRequestSource | None = None,
        request_surface: PublishedInvocationRequestSurface | None = None,
        cache_status: PublishedInvocationCacheStatus | None = None,
        run_status: str | None = None,
        api_key_id: str | None = None,
        reason_code: PublishedInvocationReasonCode | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        limit: int | None = None,
    ) -> list[WorkflowPublishedInvocation]:
        statement = self._build_binding_statement(
            workflow_id=workflow_id,
            binding_id=binding_id,
            status=status,
            request_source=request_source,
            cache_status=cache_status,
            run_status=run_status,
            api_key_id=api_key_id,
            created_from=created_from,
            created_to=created_to,
        ).order_by(
            WorkflowPublishedInvocation.created_at.desc(),
            WorkflowPublishedInvocation.id.desc(),
        )

        if reason_code is None and request_surface is None and limit is not None:
            return db.scalars(statement.limit(limit)).all()

        records = db.scalars(statement).all()
        if request_surface is not None:
            records = [
                record
                for record in records
                if self.resolve_request_surface(record) == request_surface
            ]
        if reason_code is not None:
            records = [
                record
                for record in records
                if classify_invocation_reason(
                    status=record.status,
                    error_message=record.error_message,
                    run_status=record.run_status,
                )
                == reason_code
            ]
        if limit is not None:
            return records[:limit]
        return records

    def record_invocation(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        request_source: PublishedInvocationRequestSource,
        input_payload: dict,
        status: PublishedInvocationStatus,
        cache_status: PublishedInvocationCacheStatus = "bypass",
        cache_key: str | None = None,
        cache_entry_id: str | None = None,
        request_surface_override: PublishedInvocationRequestSurface | None = None,
        api_key_id: str | None = None,
        run_id: str | None = None,
        run_status: str | None = None,
        response_payload: dict | None = None,
        error_message: str | None = None,
        started_at: datetime | None = None,
        finished_at: datetime | None = None,
    ) -> WorkflowPublishedInvocation:
        effective_started_at = started_at or _utcnow()
        effective_finished_at = finished_at or _utcnow()
        duration_ms = max(
            int((effective_finished_at - effective_started_at).total_seconds() * 1000),
            0,
        )
        request_preview = _build_payload_preview(input_payload)
        if request_surface_override is not None:
            request_preview["surface_hint"] = request_surface_override

        record = WorkflowPublishedInvocation(
            id=str(uuid4()),
            workflow_id=binding.workflow_id,
            binding_id=binding.id,
            endpoint_id=binding.endpoint_id,
            endpoint_alias=binding.endpoint_alias,
            route_path=binding.route_path,
            protocol=binding.protocol,
            auth_mode=binding.auth_mode,
            request_source=request_source,
            status=status,
            cache_status=cache_status,
            cache_key=cache_key,
            cache_entry_id=cache_entry_id,
            api_key_id=api_key_id,
            run_id=run_id,
            run_status=run_status,
            error_message=error_message[:512] if error_message else None,
            request_preview=request_preview,
            response_preview=(
                _build_payload_preview(response_payload)
                if isinstance(response_payload, dict)
                else response_payload
            ),
            duration_ms=duration_ms,
            created_at=effective_started_at,
            finished_at=effective_finished_at,
        )
        db.add(record)
        db.flush()
        return record

    def get_for_binding(
        self,
        db: Session,
        *,
        workflow_id: str,
        binding_id: str,
        invocation_id: str,
    ) -> WorkflowPublishedInvocation | None:
        return db.scalar(
            select(WorkflowPublishedInvocation).where(
                WorkflowPublishedInvocation.id == invocation_id,
                WorkflowPublishedInvocation.workflow_id == workflow_id,
                WorkflowPublishedInvocation.binding_id == binding_id,
            )
        )

    def list_for_binding(
        self,
        db: Session,
        *,
        workflow_id: str,
        binding_id: str,
        status: PublishedInvocationStatus | None = None,
        request_source: PublishedInvocationRequestSource | None = None,
        request_surface: PublishedInvocationRequestSurface | None = None,
        cache_status: PublishedInvocationCacheStatus | None = None,
        run_status: str | None = None,
        api_key_id: str | None = None,
        reason_code: PublishedInvocationReasonCode | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        limit: int = 20,
    ) -> list[WorkflowPublishedInvocation]:
        return self._list_binding_records(
            db,
            workflow_id=workflow_id,
            binding_id=binding_id,
            status=status,
            request_source=request_source,
            request_surface=request_surface,
            cache_status=cache_status,
            run_status=run_status,
            api_key_id=api_key_id,
            reason_code=reason_code,
            created_from=created_from,
            created_to=created_to,
            limit=limit,
        )
