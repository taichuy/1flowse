from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.run import NodeRun, Run, RunEvent
from app.services.callback_waiting_lifecycle import (
    load_callback_waiting_lifecycle,
    load_callback_waiting_scheduled_resume,
    record_callback_waiting_resume_requeued,
    resolve_callback_waiting_scheduled_resume_due_at,
)
from app.services.run_resume_scheduler import RunResumeScheduler, get_run_resume_scheduler


def _utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class WaitingResumeMonitorItem:
    run_id: str
    node_run_id: str
    node_id: str
    waiting_status: str
    waiting_reason: str | None
    scheduled_resume_delay_seconds: float
    scheduled_resume_reason: str | None
    scheduled_resume_source: str | None
    scheduled_resume_backoff_attempt: int
    scheduled_resume_scheduled_at: datetime | None
    scheduled_resume_due_at: datetime | None


@dataclass(frozen=True)
class WaitingResumeMonitorResult:
    source: str
    limit: int
    matched_count: int
    scheduled_count: int
    run_ids: list[str]
    items: list[WaitingResumeMonitorItem]


class WaitingResumeMonitorService:
    def __init__(
        self,
        *,
        resume_scheduler: RunResumeScheduler | None = None,
        batch_size: int | None = None,
        recent_requeue_window_seconds: float | None = None,
    ) -> None:
        settings = get_settings()
        resolved_batch_size = (
            settings.waiting_resume_monitor_batch_size if batch_size is None else batch_size
        )
        self._resume_scheduler = resume_scheduler or get_run_resume_scheduler()
        self._batch_size = max(int(resolved_batch_size), 1)
        resolved_recent_requeue_window_seconds = (
            settings.waiting_resume_monitor_interval_seconds
            if recent_requeue_window_seconds is None
            else recent_requeue_window_seconds
        )
        self._recent_requeue_window_seconds = max(
            float(resolved_recent_requeue_window_seconds),
            0.0,
        )

    def schedule_due_resumes(
        self,
        db: Session,
        *,
        source: str = "waiting_resume_monitor",
        limit: int | None = None,
        now: datetime | None = None,
    ) -> WaitingResumeMonitorResult:
        effective_limit = max(int(limit or self._batch_size), 1)
        effective_now = now or _utcnow()
        records = self._list_waiting_callback_candidates(db)

        run_ids: list[str] = []
        seen_run_ids: set[str] = set()
        items: list[WaitingResumeMonitorItem] = []

        for run, node_run in records:
            if len(items) >= effective_limit:
                break
            if not self._is_active_waiting_callback(run=run, node_run=node_run):
                continue

            lifecycle = load_callback_waiting_lifecycle(node_run.checkpoint_payload)
            if lifecycle["terminated"]:
                continue

            scheduled_resume = load_callback_waiting_scheduled_resume(
                node_run.checkpoint_payload
            )
            due_at = resolve_callback_waiting_scheduled_resume_due_at(
                node_run.checkpoint_payload
            )
            if due_at is None or due_at > effective_now:
                continue
            if self._was_recently_requeued(
                scheduled_resume=scheduled_resume,
                now=effective_now,
            ):
                continue

            waiting_status = str(
                scheduled_resume["waiting_status"]
                or node_run.phase
                or node_run.status
                or ""
            ).strip()
            if waiting_status != "waiting_callback":
                continue

            reason = (
                scheduled_resume["reason"]
                or node_run.waiting_reason
                or "scheduled waiting resume pending delivery"
            )
            self._resume_scheduler.schedule(
                run_id=run.id,
                reason=reason,
                source=source,
                db=db,
            )
            node_run.checkpoint_payload = record_callback_waiting_resume_requeued(
                node_run.checkpoint_payload,
                requeued_at=effective_now,
                source=source,
            )
            db.add(
                RunEvent(
                    run_id=run.id,
                    node_run_id=node_run.id,
                    event_type="run.resume.requeued",
                    payload={
                        "node_id": node_run.node_id,
                        "reason": reason,
                        "source": source,
                        "waiting_status": waiting_status,
                        "scheduled_resume_delay_seconds": scheduled_resume[
                            "delay_seconds"
                        ],
                        "scheduled_resume_source": scheduled_resume["source"],
                        "scheduled_resume_backoff_attempt": scheduled_resume[
                            "backoff_attempt"
                        ],
                        "scheduled_resume_scheduled_at": scheduled_resume[
                            "scheduled_at"
                        ],
                        "scheduled_resume_due_at": scheduled_resume["due_at"],
                        "scheduled_resume_requeued_at": effective_now.isoformat().replace(
                            "+00:00", "Z"
                        ),
                    },
                )
            )

            item = WaitingResumeMonitorItem(
                run_id=run.id,
                node_run_id=node_run.id,
                node_id=node_run.node_id,
                waiting_status=waiting_status,
                waiting_reason=node_run.waiting_reason,
                scheduled_resume_delay_seconds=float(
                    scheduled_resume["delay_seconds"] or 0.0
                ),
                scheduled_resume_reason=scheduled_resume["reason"],
                scheduled_resume_source=scheduled_resume["source"],
                scheduled_resume_backoff_attempt=scheduled_resume["backoff_attempt"],
                scheduled_resume_scheduled_at=self._parse_datetime(
                    scheduled_resume["scheduled_at"]
                ),
                scheduled_resume_due_at=due_at,
            )
            items.append(item)
            if run.id not in seen_run_ids:
                seen_run_ids.add(run.id)
                run_ids.append(run.id)

        return WaitingResumeMonitorResult(
            source=source,
            limit=effective_limit,
            matched_count=len(items),
            scheduled_count=len(items),
            run_ids=run_ids,
            items=items,
        )

    def _list_waiting_callback_candidates(
        self,
        db: Session,
    ) -> list[tuple[Run, NodeRun]]:
        return list(
            db.execute(
                select(Run, NodeRun)
                .join(NodeRun, NodeRun.run_id == Run.id)
                .where(Run.status == "waiting")
                .where(
                    or_(
                        NodeRun.status == "waiting_callback",
                        NodeRun.phase == "waiting_callback",
                    )
                )
                .order_by(Run.created_at.asc(), NodeRun.created_at.asc(), NodeRun.id.asc())
            ).all()
        )

    def _is_active_waiting_callback(self, *, run: Run, node_run: NodeRun) -> bool:
        if run.status != "waiting":
            return False
        checkpoint_payload = dict(run.checkpoint_payload or {})
        if checkpoint_payload.get("waiting_node_run_id") != node_run.id:
            return False
        waiting_status = str(node_run.phase or node_run.status or "").strip()
        return waiting_status == "waiting_callback"

    def _parse_datetime(self, value: str | None) -> datetime | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        try:
            parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)

    def _was_recently_requeued(
        self,
        *,
        scheduled_resume: dict[str, object],
        now: datetime,
    ) -> bool:
        if self._recent_requeue_window_seconds <= 0:
            return False
        requeued_at = self._parse_datetime(
            str(scheduled_resume.get("requeued_at") or "").strip() or None
        )
        if requeued_at is None:
            return False
        return (now - requeued_at).total_seconds() < self._recent_requeue_window_seconds
