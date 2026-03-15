from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.notification_dispatch_scheduler import NotificationDispatchScheduler


def test_notification_dispatch_scheduler_dispatches_after_commit(
    sqlite_session: Session,
) -> None:
    scheduled_dispatches = []
    scheduler = NotificationDispatchScheduler(dispatcher=scheduled_dispatches.append)

    sqlite_session.execute(text("SELECT 1"))
    scheduler.schedule(
        db=sqlite_session,
        dispatch_id="dispatch-after-commit",
        source="test",
    )

    assert scheduled_dispatches == []

    sqlite_session.commit()

    assert len(scheduled_dispatches) == 1
    assert scheduled_dispatches[0].dispatch_id == "dispatch-after-commit"
    assert scheduled_dispatches[0].source == "test"


def test_notification_dispatch_scheduler_clears_pending_requests_on_rollback(
    sqlite_session: Session,
) -> None:
    scheduled_dispatches = []
    scheduler = NotificationDispatchScheduler(dispatcher=scheduled_dispatches.append)

    sqlite_session.execute(text("SELECT 1"))
    scheduler.schedule(
        db=sqlite_session,
        dispatch_id="dispatch-rollback",
        source="test",
    )

    assert scheduled_dispatches == []

    sqlite_session.rollback()

    assert scheduled_dispatches == []

    sqlite_session.execute(text("SELECT 1"))
    sqlite_session.commit()

    assert scheduled_dispatches == []
