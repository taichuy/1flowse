from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache

from sqlalchemy import event
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ScheduledRunResume:
    run_id: str
    delay_seconds: float
    reason: str
    source: str = "runtime"


RunResumeDispatcher = Callable[[ScheduledRunResume], None]


_PENDING_RUN_RESUMES_KEY = "pending_run_resumes"
_SESSION_HOOKS_REGISTERED = False


PendingRunResume = tuple[RunResumeDispatcher, ScheduledRunResume]


def _drain_pending_run_resumes(session: Session) -> list[PendingRunResume]:
    pending = session.info.pop(_PENDING_RUN_RESUMES_KEY, [])
    if isinstance(pending, list):
        return pending
    return []


def _dispatch_pending_run_resumes_after_commit(session: Session) -> None:
    for dispatcher, request in _drain_pending_run_resumes(session):
        dispatcher(request)


def _clear_pending_run_resumes(session: Session, *_args: object) -> None:
    session.info.pop(_PENDING_RUN_RESUMES_KEY, None)


def _ensure_session_hooks_registered() -> None:
    global _SESSION_HOOKS_REGISTERED
    if _SESSION_HOOKS_REGISTERED:
        return

    event.listen(Session, "after_commit", _dispatch_pending_run_resumes_after_commit)
    event.listen(Session, "after_rollback", _clear_pending_run_resumes)
    event.listen(Session, "after_soft_rollback", _clear_pending_run_resumes)
    _SESSION_HOOKS_REGISTERED = True


class RunResumeScheduler:
    def __init__(self, dispatcher: RunResumeDispatcher | None = None) -> None:
        self._dispatcher = dispatcher or self._dispatch_via_celery

    def schedule(
        self,
        *,
        run_id: str,
        delay_seconds: float = 0.0,
        reason: str,
        source: str = "runtime",
        db: Session | None = None,
    ) -> ScheduledRunResume:
        request = ScheduledRunResume(
            run_id=run_id,
            delay_seconds=max(float(delay_seconds), 0.0),
            reason=reason,
            source=source,
        )
        if db is not None:
            _ensure_session_hooks_registered()
            pending = db.info.setdefault(_PENDING_RUN_RESUMES_KEY, [])
            if isinstance(pending, list):
                pending.append((self._dispatcher, request))
            else:
                db.info[_PENDING_RUN_RESUMES_KEY] = [(self._dispatcher, request)]
            return request

        self._dispatcher(request)
        return request

    def _dispatch_via_celery(self, request: ScheduledRunResume) -> None:
        from app.tasks.runtime import resume_run_task

        resume_run_task.apply_async(
            kwargs={
                "run_id": request.run_id,
                "reason": request.reason,
                "source": request.source,
            },
            countdown=request.delay_seconds,
        )


@lru_cache(maxsize=1)
def get_run_resume_scheduler() -> RunResumeScheduler:
    return RunResumeScheduler()
