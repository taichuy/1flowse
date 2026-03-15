from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache

from sqlalchemy import event
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ScheduledNotificationDispatch:
    dispatch_id: str
    delay_seconds: float
    source: str = "sensitive_access"


NotificationDispatchDispatcher = Callable[[ScheduledNotificationDispatch], None]


_PENDING_NOTIFICATION_DISPATCHES_KEY = "pending_notification_dispatches"
_SESSION_HOOKS_REGISTERED = False


PendingNotificationDispatch = tuple[
    NotificationDispatchDispatcher,
    ScheduledNotificationDispatch,
]


def _drain_pending_notification_dispatches(
    session: Session,
) -> list[PendingNotificationDispatch]:
    pending = session.info.pop(_PENDING_NOTIFICATION_DISPATCHES_KEY, [])
    if isinstance(pending, list):
        return pending
    return []


def _dispatch_pending_notification_dispatches_after_commit(session: Session) -> None:
    for dispatcher, request in _drain_pending_notification_dispatches(session):
        dispatcher(request)


def _clear_pending_notification_dispatches(session: Session, *_args: object) -> None:
    session.info.pop(_PENDING_NOTIFICATION_DISPATCHES_KEY, None)


def _ensure_session_hooks_registered() -> None:
    global _SESSION_HOOKS_REGISTERED
    if _SESSION_HOOKS_REGISTERED:
        return

    event.listen(
        Session,
        "after_commit",
        _dispatch_pending_notification_dispatches_after_commit,
    )
    event.listen(Session, "after_rollback", _clear_pending_notification_dispatches)
    event.listen(Session, "after_soft_rollback", _clear_pending_notification_dispatches)
    _SESSION_HOOKS_REGISTERED = True


class NotificationDispatchScheduler:
    def __init__(
        self,
        dispatcher: NotificationDispatchDispatcher | None = None,
    ) -> None:
        self._dispatcher = dispatcher or self._dispatch_via_celery

    def schedule(
        self,
        *,
        dispatch_id: str,
        delay_seconds: float = 0.0,
        source: str = "sensitive_access",
        db: Session | None = None,
    ) -> ScheduledNotificationDispatch:
        request = ScheduledNotificationDispatch(
            dispatch_id=dispatch_id,
            delay_seconds=max(float(delay_seconds), 0.0),
            source=source,
        )
        if db is not None:
            _ensure_session_hooks_registered()
            pending = db.info.setdefault(_PENDING_NOTIFICATION_DISPATCHES_KEY, [])
            if isinstance(pending, list):
                pending.append((self._dispatcher, request))
            else:
                db.info[_PENDING_NOTIFICATION_DISPATCHES_KEY] = [
                    (self._dispatcher, request)
                ]
            return request

        self._dispatcher(request)
        return request

    def _dispatch_via_celery(self, request: ScheduledNotificationDispatch) -> None:
        from app.tasks.notifications import deliver_notification_dispatch_task

        deliver_notification_dispatch_task.apply_async(
            kwargs={
                "dispatch_id": request.dispatch_id,
                "source": request.source,
            },
            countdown=request.delay_seconds,
        )


@lru_cache(maxsize=1)
def get_notification_dispatch_scheduler() -> NotificationDispatchScheduler:
    return NotificationDispatchScheduler()
