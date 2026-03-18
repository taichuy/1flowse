from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.run import Run
from app.models.scheduler import ScheduledTaskRunRecord
from app.services.run_callback_ticket_cleanup import RunCallbackTicketCleanupService
from app.services.runtime import RuntimeService, WorkflowExecutionError
from app.services.scheduled_task_activity import ScheduledTaskActivityService
from app.services.waiting_resume_monitor import WaitingResumeMonitorService

_SCHEDULED_TASK_ACTIVITY = ScheduledTaskActivityService()


def _mark_scheduled_task_failure(
    db,
    *,
    task_run_id: str,
    detail: str,
    summary_payload: dict | None = None,
) -> None:
    db.rollback()
    task_run = db.get(ScheduledTaskRunRecord, task_run_id)
    if task_run is None:
        return
    _SCHEDULED_TASK_ACTIVITY.record_failed(
        task_run,
        detail=detail,
        summary_payload=summary_payload,
    )
    db.commit()


@celery_app.task(name="runtime.resume_run")
def resume_run_task(
    run_id: str,
    reason: str | None = None,
    source: str = "scheduler",
) -> dict[str, str]:
    with SessionLocal() as db:
        run = db.get(Run, run_id)
        if run is None:
            return {
                "run_id": run_id,
                "status": "missing",
                "reason": reason or "",
                "source": source,
            }
        if run.status != "waiting":
            return {
                "run_id": run_id,
                "status": run.status,
                "reason": reason or "",
                "source": source,
            }

        try:
            artifacts = RuntimeService().resume_run(
                db,
                run_id,
                source=source,
                reason=reason,
            )
        except WorkflowExecutionError as exc:
            return {
                "run_id": run_id,
                "status": "failed",
                "reason": str(exc),
                "source": source,
            }

        return {
            "run_id": run_id,
            "status": artifacts.run.status,
            "reason": reason or "",
            "source": source,
        }


@celery_app.task(name="runtime.cleanup_callback_tickets")
def cleanup_callback_tickets_task(
    limit: int | None = None,
    source: str = "scheduler_cleanup",
) -> dict[str, object]:
    with SessionLocal() as db:
        task_run = _SCHEDULED_TASK_ACTIVITY.record_started(
            db,
            task_name="runtime.cleanup_callback_tickets",
            source=source,
        )
        db.commit()
        try:
            result = RunCallbackTicketCleanupService().cleanup_stale_tickets(
                db,
                limit=limit,
                source=source,
                schedule_resumes=True,
                resume_source="callback_ticket_monitor",
            )
            _SCHEDULED_TASK_ACTIVITY.record_succeeded(
                task_run,
                matched_count=result.matched_count,
                affected_count=result.expired_count,
                detail=(
                    "最近一次 cleanup 已完成；"
                    "即使 expired_count 为 0，也说明 scheduler 至少跑过一次该任务。"
                ),
                summary_payload={
                    "limit": result.limit,
                    "scheduled_resume_count": result.scheduled_resume_count,
                    "terminated_count": result.terminated_count,
                    "run_ids": result.run_ids,
                },
            )
            db.commit()
            return {
                "source": result.source,
                "limit": result.limit,
                "matched_count": result.matched_count,
                "expired_count": result.expired_count,
                "run_ids": result.run_ids,
                "tickets": [item.ticket for item in result.items],
            }
        except Exception as exc:
            _mark_scheduled_task_failure(
                db,
                task_run_id=task_run.id,
                detail=str(exc),
                summary_payload={"limit": limit, "source": source},
            )
            raise


@celery_app.task(name="runtime.monitor_waiting_resumes")
def monitor_waiting_resumes_task(
    limit: int | None = None,
    source: str = "scheduler_waiting_resume_monitor",
) -> dict[str, object]:
    with SessionLocal() as db:
        task_run = _SCHEDULED_TASK_ACTIVITY.record_started(
            db,
            task_name="runtime.monitor_waiting_resumes",
            source=source,
        )
        db.commit()
        try:
            result = WaitingResumeMonitorService().schedule_due_resumes(
                db,
                limit=limit,
                source=source,
            )
            _SCHEDULED_TASK_ACTIVITY.record_succeeded(
                task_run,
                matched_count=result.matched_count,
                affected_count=result.scheduled_count,
                detail=(
                    "最近一次 waiting resume monitor 已完成；"
                    "即使 scheduled_count 为 0，也说明 scheduler 至少跑过一次该任务。"
                ),
                summary_payload={
                    "limit": result.limit,
                    "run_ids": result.run_ids,
                    "node_run_ids": [item.node_run_id for item in result.items],
                },
            )
            db.commit()
            return {
                "source": result.source,
                "limit": result.limit,
                "matched_count": result.matched_count,
                "scheduled_count": result.scheduled_count,
                "run_ids": result.run_ids,
                "node_run_ids": [item.node_run_id for item in result.items],
            }
        except Exception as exc:
            _mark_scheduled_task_failure(
                db,
                task_run_id=task_run.id,
                detail=str(exc),
                summary_payload={"limit": limit, "source": source},
            )
            raise
