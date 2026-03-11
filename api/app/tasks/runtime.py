from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.run import Run
from app.services.run_callback_ticket_cleanup import RunCallbackTicketCleanupService
from app.services.runtime import RuntimeService, WorkflowExecutionError


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
        result = RunCallbackTicketCleanupService().cleanup_stale_tickets(
            db,
            limit=limit,
            source=source,
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
