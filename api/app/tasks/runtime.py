from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.run import Run
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
