from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.sensitive_access_control import SensitiveAccessControlService


@celery_app.task(name="sensitive_access.expire_approval_tickets")
def expire_approval_tickets_task(
    limit: int | None = None,
    source: str = "scheduler_expiry",
) -> dict[str, object]:
    with SessionLocal() as db:
        result = SensitiveAccessControlService().expire_pending_tickets(
            db,
            source=source,
            limit=limit,
        )
        db.commit()
        return {
            "source": result.source,
            "limit": result.limit,
            "matched_count": result.matched_count,
            "expired_count": result.expired_count,
            "scheduled_resume_count": result.scheduled_resume_count,
            "ticket_ids": result.ticket_ids,
            "run_ids": result.run_ids,
        }
