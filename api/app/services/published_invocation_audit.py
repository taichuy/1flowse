"""Published invocation audit aggregation helpers.

Extracts timeline building, bucket facet construction and the main
``build_binding_audit`` method from ``published_invocations.py`` into a
reusable mixin, keeping the main service file focused on CRUD, querying
and rate-limit counting.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import (
    WorkflowPublishedApiKey,
    WorkflowPublishedInvocation,
)
from app.services.published_invocation_types import (
    CACHE_STATUS_ORDER,
    REQUEST_SURFACE_ORDER,
    RUN_STATUS_ORDER,
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
    PublishedInvocationSummary,
    PublishedInvocationTimeBucket,
    classify_invocation_reason,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _resolve_record_reason_code(
    record: WorkflowPublishedInvocation,
) -> str | None:
    return classify_invocation_reason(
        status=record.status,
        error_message=record.error_message,
        run_status=record.run_status,
    )


def _resolve_request_surface(
    record: WorkflowPublishedInvocation,
) -> PublishedInvocationRequestSurface:
    surface_hint = record.request_preview.get("surface_hint")
    if isinstance(surface_hint, str) and surface_hint in REQUEST_SURFACE_ORDER:
        return surface_hint

    if record.protocol == "native":
        if record.request_source == "workflow":
            return "native.workflow"
        if record.request_source == "alias":
            return "native.alias"
        if record.request_source == "path":
            return "native.path"
        return "unknown"

    request_keys = set(record.request_preview.get("keys") or [])
    if record.protocol == "openai":
        if "messages" in request_keys:
            return "openai.chat.completions"
        if "input" in request_keys:
            return "openai.responses"
        return "openai.unknown"

    if record.protocol == "anthropic":
        return "anthropic.messages"

    return "unknown"


def _summarize_records(
    records: list[WorkflowPublishedInvocation],
) -> PublishedInvocationSummary:
    if not records:
        return PublishedInvocationSummary()

    counts: dict[str, int] = {
        "total_count": 0,
        "succeeded_count": 0,
        "failed_count": 0,
        "rejected_count": 0,
        "cache_hit_count": 0,
        "cache_miss_count": 0,
        "cache_bypass_count": 0,
    }
    last_record = records[0]
    for record in records:
        counts["total_count"] += 1
        counts[f"{record.status}_count"] += 1
        cache_status = record.cache_status or "bypass"
        counts[f"cache_{cache_status}_count"] += 1

    return PublishedInvocationSummary(
        total_count=counts["total_count"],
        succeeded_count=counts["succeeded_count"],
        failed_count=counts["failed_count"],
        rejected_count=counts["rejected_count"],
        cache_hit_count=counts["cache_hit_count"],
        cache_miss_count=counts["cache_miss_count"],
        cache_bypass_count=counts["cache_bypass_count"],
        last_invoked_at=last_record.created_at,
        last_status=last_record.status,
        last_cache_status=last_record.cache_status or "bypass",
        last_run_id=last_record.run_id,
        last_run_status=last_record.run_status,
        last_reason_code=classify_invocation_reason(
            status=last_record.status,
            error_message=last_record.error_message,
            run_status=last_record.run_status,
        ),
    )


def _resolve_timeline_granularity(
    *,
    created_from: datetime | None,
    created_to: datetime | None,
    records: list[WorkflowPublishedInvocation],
) -> Literal["hour", "day"]:
    normalized_from = _as_utc(created_from) if created_from is not None else None
    normalized_to = _as_utc(created_to) if created_to is not None else None

    if normalized_from is not None and normalized_to is not None:
        return "hour" if normalized_to - normalized_from <= timedelta(days=2) else "day"

    if records:
        last_record_at = _as_utc(records[0].created_at)
        first_record_at = _as_utc(records[-1].created_at)
        return "hour" if last_record_at - first_record_at <= timedelta(days=2) else "day"

    return "day"


def _truncate_bucket_start(
    value: datetime,
    *,
    granularity: Literal["hour", "day"],
) -> datetime:
    normalized = _as_utc(value)
    if granularity == "hour":
        return normalized.replace(minute=0, second=0, microsecond=0)
    return normalized.replace(hour=0, minute=0, second=0, microsecond=0)


def _build_bucket_facets(
    counts: dict[str, int],
    *,
    ordered_values: tuple[str, ...] | None = None,
    include_zero_values: bool = False,
) -> list[PublishedInvocationBucketFacet]:
    if ordered_values is not None:
        return [
            PublishedInvocationBucketFacet(value=value, count=counts[value])
            for value in ordered_values
            if include_zero_values or counts.get(value, 0) > 0
        ]

    return [
        PublishedInvocationBucketFacet(value=value, count=count)
        for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        if count > 0
    ]


def _build_api_key_bucket_facets(
    counts: dict[str, int],
    *,
    api_key_lookup: dict[str, WorkflowPublishedApiKey],
    limit: int = 3,
) -> list[PublishedInvocationApiKeyBucketFacet]:
    items = sorted(
        (
            (
                api_key_id,
                count,
                api_key_lookup.get(api_key_id),
            )
            for api_key_id, count in counts.items()
            if count > 0
        ),
        key=lambda item: (
            -item[1],
            item[2].name if item[2] and item[2].name else "",
            item[2].key_prefix if item[2] and item[2].key_prefix else "",
            item[0],
        ),
    )
    return [
        PublishedInvocationApiKeyBucketFacet(
            api_key_id=api_key_id,
            name=key_record.name if key_record else None,
            key_prefix=key_record.key_prefix if key_record else None,
            count=count,
        )
        for api_key_id, count, key_record in items[:limit]
    ]


def _build_run_status_bucket_facets(
    counts: dict[str, int],
) -> list[PublishedInvocationBucketFacet]:
    ordered_values = [value for value in RUN_STATUS_ORDER if counts.get(value, 0) > 0]
    extras = sorted(value for value, count in counts.items() if count > 0 and value not in RUN_STATUS_ORDER)
    return _build_bucket_facets(
        counts,
        ordered_values=tuple([*ordered_values, *extras]) if ordered_values or extras else None,
    )


def _build_timeline(
    records: list[WorkflowPublishedInvocation],
    *,
    granularity: Literal["hour", "day"],
    api_key_lookup: dict[str, WorkflowPublishedApiKey],
) -> list[PublishedInvocationTimeBucket]:
    if not records:
        return []

    bucket_size = timedelta(hours=1 if granularity == "hour" else 24)
    buckets: dict[datetime, dict[str, Any]] = {}

    for record in records:
        bucket_start = _truncate_bucket_start(record.created_at, granularity=granularity)
        bucket = buckets.setdefault(
            bucket_start,
            {
                "total_count": 0,
                "succeeded_count": 0,
                "failed_count": 0,
                "rejected_count": 0,
                "api_key_counts": defaultdict(int),
                "cache_status_counts": defaultdict(int),
                "run_status_counts": defaultdict(int),
                "request_surface_counts": defaultdict(int),
                "reason_counts": defaultdict(int),
            },
        )
        bucket["total_count"] += 1
        bucket[f"{record.status}_count"] += 1
        if record.api_key_id:
            bucket["api_key_counts"][record.api_key_id] += 1
        bucket["cache_status_counts"][record.cache_status or "bypass"] += 1
        if record.run_status:
            bucket["run_status_counts"][record.run_status] += 1
        bucket["request_surface_counts"][_resolve_request_surface(record)] += 1

        reason_code = _resolve_record_reason_code(record)
        if reason_code is not None:
            bucket["reason_counts"][reason_code] += 1

    return [
        PublishedInvocationTimeBucket(
            bucket_start=bucket_start,
            bucket_end=bucket_start + bucket_size,
            total_count=int(counts["total_count"]),
            succeeded_count=int(counts["succeeded_count"]),
            failed_count=int(counts["failed_count"]),
            rejected_count=int(counts["rejected_count"]),
            api_key_counts=_build_api_key_bucket_facets(
                counts["api_key_counts"],
                api_key_lookup=api_key_lookup,
            ),
            cache_status_counts=_build_bucket_facets(
                counts["cache_status_counts"],
                ordered_values=CACHE_STATUS_ORDER,
                include_zero_values=True,
            ),
            run_status_counts=_build_run_status_bucket_facets(counts["run_status_counts"]),
            request_surface_counts=_build_bucket_facets(
                counts["request_surface_counts"],
                ordered_values=REQUEST_SURFACE_ORDER,
            ),
            reason_counts=_build_bucket_facets(counts["reason_counts"]),
        )
        for bucket_start, counts in sorted(buckets.items(), reverse=True)
    ]


# ---------------------------------------------------------------------------
# Mixin
# ---------------------------------------------------------------------------


class PublishedInvocationAuditMixin:
    """Audit aggregation for ``PublishedInvocationService``.

    Expects the host class to provide ``_list_binding_records`` and
    ``_as_utc``.
    """

    # Stubs – provided by host class
    def _list_binding_records(self, db, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def resolve_request_surface(
        self,
        record: WorkflowPublishedInvocation,
    ) -> PublishedInvocationRequestSurface:
        return _resolve_request_surface(record)

    def build_binding_audit(
        self,
        db: Session,
        *,
        workflow_id: str,
        binding_id: str,
        status: str | None = None,
        request_source: str | None = None,
        request_surface: str | None = None,
        cache_status: str | None = None,
        run_status: str | None = None,
        api_key_id: str | None = None,
        reason_code: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> PublishedInvocationAudit:
        records = self._list_binding_records(
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
        )
        summary = _summarize_records(records)

        status_buckets: dict[str, dict[str, Any]] = {
            "succeeded": {"count": 0, "last_invoked_at": None, "last_status": None},
            "failed": {"count": 0, "last_invoked_at": None, "last_status": None},
            "rejected": {"count": 0, "last_invoked_at": None, "last_status": None},
        }
        request_source_buckets: dict[str, dict[str, Any]] = {
            "workflow": {"count": 0, "last_invoked_at": None, "last_status": None},
            "alias": {"count": 0, "last_invoked_at": None, "last_status": None},
            "path": {"count": 0, "last_invoked_at": None, "last_status": None},
        }
        request_surface_buckets: dict[str, dict[str, Any]] = {
            "native.workflow": {"count": 0, "last_invoked_at": None, "last_status": None},
            "native.workflow.async": {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            },
            "native.alias": {"count": 0, "last_invoked_at": None, "last_status": None},
            "native.alias.async": {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            },
            "native.path": {"count": 0, "last_invoked_at": None, "last_status": None},
            "native.path.async": {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            },
            "openai.chat.completions": {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            },
            "openai.chat.completions.async": {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            },
            "openai.responses": {"count": 0, "last_invoked_at": None, "last_status": None},
            "openai.responses.async": {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            },
            "openai.unknown": {"count": 0, "last_invoked_at": None, "last_status": None},
            "anthropic.messages": {"count": 0, "last_invoked_at": None, "last_status": None},
            "anthropic.messages.async": {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            },
            "unknown": {"count": 0, "last_invoked_at": None, "last_status": None},
        }
        cache_status_buckets: dict[str, dict[str, Any]] = {
            "hit": {"count": 0, "last_invoked_at": None, "last_status": None},
            "miss": {"count": 0, "last_invoked_at": None, "last_status": None},
            "bypass": {"count": 0, "last_invoked_at": None, "last_status": None},
        }
        run_status_buckets: dict[str, dict[str, Any]] = {
            value: {"count": 0, "last_invoked_at": None, "last_status": None}
            for value in RUN_STATUS_ORDER
        }
        api_key_buckets: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "count": 0,
                "succeeded_count": 0,
                "failed_count": 0,
                "rejected_count": 0,
                "last_invoked_at": None,
                "last_status": None,
            }
        )
        failure_reason_buckets: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "count": 0,
                "last_invoked_at": None,
            }
        )
        reason_buckets: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "count": 0,
                "last_invoked_at": None,
                "last_status": None,
            }
        )

        for record in records:
            status_bucket = status_buckets[record.status]
            status_bucket["count"] += 1
            if status_bucket["last_invoked_at"] is None:
                status_bucket["last_invoked_at"] = record.created_at
                status_bucket["last_status"] = record.status

            source_bucket = request_source_buckets[record.request_source]
            source_bucket["count"] += 1
            if source_bucket["last_invoked_at"] is None:
                source_bucket["last_invoked_at"] = record.created_at
                source_bucket["last_status"] = record.status

            resolved_surface = _resolve_request_surface(record)
            surface_bucket = request_surface_buckets[resolved_surface]
            surface_bucket["count"] += 1
            if surface_bucket["last_invoked_at"] is None:
                surface_bucket["last_invoked_at"] = record.created_at
                surface_bucket["last_status"] = record.status

            cache_bucket = cache_status_buckets[record.cache_status or "bypass"]
            cache_bucket["count"] += 1
            if cache_bucket["last_invoked_at"] is None:
                cache_bucket["last_invoked_at"] = record.created_at
                cache_bucket["last_status"] = record.status

            if record.run_status:
                run_status_bucket = run_status_buckets.setdefault(
                    record.run_status,
                    {"count": 0, "last_invoked_at": None, "last_status": None},
                )
                run_status_bucket["count"] += 1
                if run_status_bucket["last_invoked_at"] is None:
                    run_status_bucket["last_invoked_at"] = record.created_at
                    run_status_bucket["last_status"] = record.status

            if record.api_key_id:
                api_key_bucket = api_key_buckets[record.api_key_id]
                api_key_bucket["count"] += 1
                api_key_bucket[f"{record.status}_count"] += 1
                if api_key_bucket["last_invoked_at"] is None:
                    api_key_bucket["last_invoked_at"] = record.created_at
                    api_key_bucket["last_status"] = record.status

            if record.status != "succeeded" and record.error_message:
                failure_bucket = failure_reason_buckets[record.error_message]
                failure_bucket["count"] += 1
                if failure_bucket["last_invoked_at"] is None:
                    failure_bucket["last_invoked_at"] = record.created_at

            reason_code = _resolve_record_reason_code(record)
            if reason_code is not None:
                reason_bucket = reason_buckets[reason_code]
                reason_bucket["count"] += 1
                if reason_bucket["last_invoked_at"] is None:
                    reason_bucket["last_invoked_at"] = record.created_at
                    reason_bucket["last_status"] = record.status

        api_key_lookup: dict[str, WorkflowPublishedApiKey] = {}
        if api_key_buckets:
            api_key_records = db.scalars(
                select(WorkflowPublishedApiKey).where(
                    WorkflowPublishedApiKey.id.in_(list(api_key_buckets.keys()))
                )
            ).all()
            api_key_lookup = {record.id: record for record in api_key_records}

        status_counts = [
            PublishedInvocationFacet(
                value=value,
                count=int(bucket["count"]),
                last_invoked_at=bucket["last_invoked_at"],
                last_status=bucket["last_status"],
            )
            for value, bucket in status_buckets.items()
        ]
        request_source_counts = [
            PublishedInvocationFacet(
                value=value,
                count=int(bucket["count"]),
                last_invoked_at=bucket["last_invoked_at"],
                last_status=bucket["last_status"],
            )
            for value, bucket in request_source_buckets.items()
        ]
        request_surface_counts = [
            PublishedInvocationFacet(
                value=value,
                count=int(bucket["count"]),
                last_invoked_at=bucket["last_invoked_at"],
                last_status=bucket["last_status"],
            )
            for value, bucket in request_surface_buckets.items()
            if int(bucket["count"]) > 0
        ]
        cache_status_counts = [
            PublishedInvocationFacet(
                value=value,
                count=int(bucket["count"]),
                last_invoked_at=bucket["last_invoked_at"],
                last_status=bucket["last_status"],
            )
            for value, bucket in cache_status_buckets.items()
        ]
        run_status_counts = [
            PublishedInvocationFacet(
                value=value,
                count=int(bucket["count"]),
                last_invoked_at=bucket["last_invoked_at"],
                last_status=bucket["last_status"],
            )
            for value, bucket in run_status_buckets.items()
            if int(bucket["count"]) > 0
        ]
        reason_counts = sorted(
            (
                PublishedInvocationFacet(
                    value=value,
                    count=int(bucket["count"]),
                    last_invoked_at=bucket["last_invoked_at"],
                    last_status=bucket["last_status"],
                )
                for value, bucket in reason_buckets.items()
            ),
            key=lambda item: (
                -item.count,
                -(item.last_invoked_at.timestamp() if item.last_invoked_at else 0),
                item.value,
            ),
        )
        api_key_usage: list[PublishedInvocationApiKeyUsage] = []
        for key_id, bucket in api_key_buckets.items():
            key_record = api_key_lookup.get(key_id)
            api_key_usage.append(
                PublishedInvocationApiKeyUsage(
                    api_key_id=key_id,
                    name=key_record.name if key_record else None,
                    key_prefix=key_record.key_prefix if key_record else None,
                    status=key_record.status if key_record else None,
                    invocation_count=int(bucket["count"]),
                    succeeded_count=int(bucket["succeeded_count"]),
                    failed_count=int(bucket["failed_count"]),
                    rejected_count=int(bucket["rejected_count"]),
                    last_invoked_at=bucket["last_invoked_at"],
                    last_status=bucket["last_status"],
                )
            )
        api_key_usage.sort(
            key=lambda item: (
                -item.invocation_count,
                -(item.last_invoked_at.timestamp() if item.last_invoked_at else 0),
                item.api_key_id,
            ),
        )
        recent_failure_reasons = sorted(
            (
                PublishedInvocationFailureReason(
                    message=message,
                    count=int(bucket["count"]),
                    last_invoked_at=bucket["last_invoked_at"],
                )
                for message, bucket in failure_reason_buckets.items()
            ),
            key=lambda item: (
                -item.count,
                -(item.last_invoked_at.timestamp() if item.last_invoked_at else 0),
                item.message,
            ),
        )[:5]
        timeline_granularity = _resolve_timeline_granularity(
            created_from=created_from,
            created_to=created_to,
            records=records,
        )

        return PublishedInvocationAudit(
            summary=summary,
            status_counts=status_counts,
            request_source_counts=request_source_counts,
            request_surface_counts=request_surface_counts,
            cache_status_counts=cache_status_counts,
            run_status_counts=run_status_counts,
            reason_counts=reason_counts,
            api_key_usage=api_key_usage,
            recent_failure_reasons=recent_failure_reasons,
            timeline_granularity=timeline_granularity,
            timeline=_build_timeline(
                records,
                granularity=timeline_granularity,
                api_key_lookup=api_key_lookup,
            ),
        )

    def summarize_for_bindings(
        self,
        db: Session,
        *,
        workflow_id: str,
        binding_ids: list[str],
    ) -> dict[str, PublishedInvocationSummary]:
        if not binding_ids:
            return {}

        records = db.scalars(
            select(WorkflowPublishedInvocation)
            .where(
                WorkflowPublishedInvocation.workflow_id == workflow_id,
                WorkflowPublishedInvocation.binding_id.in_(binding_ids),
            )
            .order_by(
                WorkflowPublishedInvocation.created_at.desc(),
                WorkflowPublishedInvocation.id.desc(),
            )
        ).all()

        summaries: dict[str, PublishedInvocationSummary] = {}
        counts: dict[str, dict[str, int]] = {}
        last_seen: set[str] = set()

        for record in records:
            bucket = counts.setdefault(
                record.binding_id,
                {
                    "total_count": 0,
                    "succeeded_count": 0,
                    "failed_count": 0,
                    "rejected_count": 0,
                    "cache_hit_count": 0,
                    "cache_miss_count": 0,
                    "cache_bypass_count": 0,
                },
            )
            bucket["total_count"] += 1
            bucket[f"{record.status}_count"] += 1
            cache_status = record.cache_status or "bypass"
            bucket[f"cache_{cache_status}_count"] += 1

            if record.binding_id in last_seen:
                continue

            summaries[record.binding_id] = PublishedInvocationSummary(
                total_count=bucket["total_count"],
                succeeded_count=bucket["succeeded_count"],
                failed_count=bucket["failed_count"],
                rejected_count=bucket["rejected_count"],
                cache_hit_count=bucket["cache_hit_count"],
                cache_miss_count=bucket["cache_miss_count"],
                cache_bypass_count=bucket["cache_bypass_count"],
                last_invoked_at=record.created_at,
                last_status=record.status,
                last_cache_status=record.cache_status or "bypass",
                last_run_id=record.run_id,
                last_run_status=record.run_status,
                last_reason_code=classify_invocation_reason(
                    status=record.status,
                    error_message=record.error_message,
                    run_status=record.run_status,
                ),
            )
            last_seen.add(record.binding_id)

        for binding_id, bucket in counts.items():
            existing = summaries.get(binding_id)
            if existing is None:
                summaries[binding_id] = PublishedInvocationSummary(
                    total_count=bucket["total_count"],
                    succeeded_count=bucket["succeeded_count"],
                    failed_count=bucket["failed_count"],
                    rejected_count=bucket["rejected_count"],
                    cache_hit_count=bucket["cache_hit_count"],
                    cache_miss_count=bucket["cache_miss_count"],
                    cache_bypass_count=bucket["cache_bypass_count"],
                )
                continue
            summaries[binding_id] = PublishedInvocationSummary(
                total_count=bucket["total_count"],
                succeeded_count=bucket["succeeded_count"],
                failed_count=bucket["failed_count"],
                rejected_count=bucket["rejected_count"],
                cache_hit_count=bucket["cache_hit_count"],
                cache_miss_count=bucket["cache_miss_count"],
                cache_bypass_count=bucket["cache_bypass_count"],
                last_invoked_at=existing.last_invoked_at,
                last_status=existing.last_status,
                last_cache_status=existing.last_cache_status,
                last_run_id=existing.last_run_id,
                last_run_status=existing.last_run_status,
                last_reason_code=existing.last_reason_code,
            )

        return summaries
