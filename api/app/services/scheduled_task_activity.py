from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.scheduler import ScheduledTaskRunRecord


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ScheduledTaskActivityService:
    def record_started(
        self,
        db: Session,
        *,
        task_name: str,
        source: str | None,
        started_at: datetime | None = None,
    ) -> ScheduledTaskRunRecord:
        record = ScheduledTaskRunRecord(
            id=str(uuid4()),
            task_name=task_name,
            source=source,
            status="running",
            matched_count=0,
            affected_count=0,
            summary_payload={},
            started_at=started_at or _utcnow(),
        )
        db.add(record)
        db.flush()
        return record

    def record_succeeded(
        self,
        record: ScheduledTaskRunRecord,
        *,
        matched_count: int = 0,
        affected_count: int = 0,
        detail: str | None = None,
        summary_payload: dict | None = None,
        finished_at: datetime | None = None,
    ) -> ScheduledTaskRunRecord:
        record.status = "succeeded"
        record.matched_count = max(int(matched_count), 0)
        record.affected_count = max(int(affected_count), 0)
        record.detail = detail
        record.summary_payload = dict(summary_payload or {})
        record.finished_at = finished_at or _utcnow()
        return record

    def record_failed(
        self,
        record: ScheduledTaskRunRecord,
        *,
        detail: str,
        summary_payload: dict | None = None,
        finished_at: datetime | None = None,
    ) -> ScheduledTaskRunRecord:
        record.status = "failed"
        record.detail = detail
        record.summary_payload = dict(summary_payload or {})
        record.finished_at = finished_at or _utcnow()
        return record

    def latest_runs_by_task(
        self,
        db: Session,
        *,
        task_names: Iterable[str],
    ) -> dict[str, ScheduledTaskRunRecord]:
        names = [str(task_name) for task_name in task_names if str(task_name).strip()]
        if not names:
            return {}
        records = db.scalars(
            select(ScheduledTaskRunRecord)
            .where(ScheduledTaskRunRecord.task_name.in_(names))
            .order_by(
                ScheduledTaskRunRecord.task_name.asc(),
                ScheduledTaskRunRecord.started_at.desc(),
                ScheduledTaskRunRecord.id.desc(),
            )
        ).all()
        latest: dict[str, ScheduledTaskRunRecord] = {}
        for record in records:
            latest.setdefault(record.task_name, record)
        return latest

