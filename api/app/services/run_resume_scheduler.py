from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class ScheduledRunResume:
    run_id: str
    delay_seconds: float
    reason: str
    source: str = "runtime"


RunResumeDispatcher = Callable[[ScheduledRunResume], None]


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
    ) -> ScheduledRunResume:
        request = ScheduledRunResume(
            run_id=run_id,
            delay_seconds=max(float(delay_seconds), 0.0),
            reason=reason,
            source=source,
        )
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
