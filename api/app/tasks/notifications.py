from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.notification_delivery import (
    NotificationDeliveryError,
    NotificationDeliveryService,
)


@celery_app.task(name="notifications.deliver_dispatch")
def deliver_notification_dispatch_task(
    dispatch_id: str,
    source: str = "sensitive_access",
) -> dict[str, str]:
    with SessionLocal() as db:
        try:
            context = NotificationDeliveryService().deliver_dispatch(
                db,
                dispatch_id=dispatch_id,
            )
        except NotificationDeliveryError as exc:
            db.rollback()
            return {
                "dispatch_id": dispatch_id,
                "status": "missing",
                "source": source,
                "error": str(exc),
            }

        db.commit()
        return {
            "dispatch_id": context.notification.id,
            "status": context.notification.status,
            "channel": context.notification.channel,
            "source": source,
            "target": context.notification.target,
            "error": context.notification.error or "",
        }
