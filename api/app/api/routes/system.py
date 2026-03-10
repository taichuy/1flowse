import json
from collections import Counter
from collections.abc import Callable

import boto3
import redis
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import check_database, get_db
from app.models.run import Run, RunEvent
from app.schemas.system import (
    CompatibilityAdapterCheck,
    PluginToolCheck,
    RecentRunCheck,
    RecentRunEventCheck,
    RuntimeActivityCheck,
    ServiceCheck,
    SystemOverview,
)
from app.services.plugin_runtime import (
    get_compatibility_adapter_health_checker,
    get_plugin_registry,
)

router = APIRouter(tags=["system"])

_RECENT_RUN_LIMIT = 5
_RECENT_EVENT_LIMIT = 8
_PAYLOAD_PREVIEW_LIMIT = 180


def _probe(name: str, handler: Callable[[], None]) -> ServiceCheck:
    try:
        handler()
        return ServiceCheck(name=name, status="up")
    except Exception as exc:
        return ServiceCheck(name=name, status="down", detail=str(exc))


def _summarize_payload(payload: dict) -> tuple[list[str], str, int]:
    payload_keys = sorted(str(key) for key in payload.keys())[:6]
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    payload_size = len(raw)
    if payload_size <= _PAYLOAD_PREVIEW_LIMIT:
        return payload_keys, raw, payload_size
    return payload_keys, f"{raw[:_PAYLOAD_PREVIEW_LIMIT]}...", payload_size


def _serialize_recent_event(event: RunEvent) -> RecentRunEventCheck:
    payload_keys, payload_preview, payload_size = _summarize_payload(event.payload)
    return RecentRunEventCheck(
        id=event.id,
        run_id=event.run_id,
        node_run_id=event.node_run_id,
        event_type=event.event_type,
        payload_keys=payload_keys,
        payload_preview=payload_preview,
        payload_size=payload_size,
        created_at=event.created_at,
    )


def _build_runtime_activity(db: Session) -> RuntimeActivityCheck:
    recent_runs = db.query(Run).order_by(Run.created_at.desc()).limit(_RECENT_RUN_LIMIT).all()
    run_ids = [run.id for run in recent_runs]

    event_counts: dict[str, int] = {}
    if run_ids:
        counts = (
            db.query(RunEvent.run_id, func.count(RunEvent.id))
            .filter(RunEvent.run_id.in_(run_ids))
            .group_by(RunEvent.run_id)
            .all()
        )
        event_counts = {run_id: count for run_id, count in counts}

    recent_events = (
        db.query(RunEvent).order_by(RunEvent.created_at.desc()).limit(_RECENT_EVENT_LIMIT).all()
    )
    run_statuses = dict(sorted(Counter(run.status for run in recent_runs).items()))
    event_types = dict(sorted(Counter(event.event_type for event in recent_events).items()))

    return RuntimeActivityCheck(
        summary={
            "recent_run_count": len(recent_runs),
            "recent_event_count": len(recent_events),
            "run_statuses": run_statuses,
            "event_types": event_types,
        },
        recent_runs=[
            RecentRunCheck(
                id=run.id,
                workflow_id=run.workflow_id,
                workflow_version=run.workflow_version,
                status=run.status,
                created_at=run.created_at,
                finished_at=run.finished_at,
                event_count=event_counts.get(run.id, 0),
            )
            for run in recent_runs
        ],
        recent_events=[
            _serialize_recent_event(event)
            for event in recent_events
        ],
    )


@router.get("/system/overview", response_model=SystemOverview)
def system_overview(db: Session = Depends(get_db)) -> SystemOverview:
    settings = get_settings()

    def verify_database() -> None:
        if not check_database():
            raise RuntimeError("database unavailable")

    postgres = _probe(
        "postgres",
        verify_database,
    )

    redis_service = _probe(
        "redis",
        lambda: redis.from_url(settings.redis_url).ping(),
    )

    s3_service = _probe(
        "object-storage",
        lambda: boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            use_ssl=settings.s3_use_ssl,
        ).list_buckets(),
    )

    adapter_healths = get_compatibility_adapter_health_checker().probe_all(get_plugin_registry())
    registry = get_plugin_registry()
    adapter_services = [
        ServiceCheck(
            name=f"plugin-adapter:{adapter.id}",
            status="up" if adapter.status == "up" else "down",
            detail=adapter.detail,
        )
        for adapter in adapter_healths
        if adapter.enabled
    ]

    services = [postgres, redis_service, s3_service, *adapter_services]
    status = "degraded" if any(item.status == "down" for item in services) else "ok"

    return SystemOverview(
        status=status,
        environment=settings.env,
        services=services,
        capabilities=[
            "workflow-crud-skeleton",
            "runtime-worker-skeleton",
            "runtime-run-tracking",
            "sandbox-ready",
            "plugin-call-proxy-foundation",
            "plugin-adapter-health-probe",
            "plugin-tool-catalog-visible",
            "runtime-events-visible",
        ],
        plugin_adapters=[
            CompatibilityAdapterCheck(
                id=adapter.id,
                ecosystem=adapter.ecosystem,
                endpoint=adapter.endpoint,
                enabled=adapter.enabled,
                status=adapter.status,
                detail=adapter.detail,
            )
            for adapter in adapter_healths
        ],
        plugin_tools=[
            PluginToolCheck(
                id=tool.id,
                name=tool.name,
                ecosystem=tool.ecosystem,
                source=tool.source,
                callable=(tool.ecosystem != "native") or registry.has_native_invoker(tool.id),
            )
            for tool in registry.list_tools()
        ],
        runtime_activity=_build_runtime_activity(db),
    )


@router.get("/system/plugin-adapters", response_model=list[CompatibilityAdapterCheck])
def list_plugin_adapters() -> list[CompatibilityAdapterCheck]:
    adapter_healths = get_compatibility_adapter_health_checker().probe_all(get_plugin_registry())
    return [
        CompatibilityAdapterCheck(
            id=adapter.id,
            ecosystem=adapter.ecosystem,
            endpoint=adapter.endpoint,
            enabled=adapter.enabled,
            status=adapter.status,
            detail=adapter.detail,
        )
        for adapter in adapter_healths
    ]


@router.get("/system/runtime-activity", response_model=RuntimeActivityCheck)
def get_runtime_activity(db: Session = Depends(get_db)) -> RuntimeActivityCheck:
    return _build_runtime_activity(db)
