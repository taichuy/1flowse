import pytest
from sqlalchemy.orm import Session

from app.models.scheduler import ScheduledTaskRunRecord
from app.tasks import runtime as runtime_tasks


class _CleanupResult:
    source = "scheduler_cleanup"
    limit = 5
    matched_count = 3
    expired_count = 2
    scheduled_resume_count = 1
    terminated_count = 0
    run_ids = ["run-1"]
    items = []
def test_cleanup_callback_tickets_task_records_scheduled_task_run(
    sqlite_session: Session,
    monkeypatch,
) -> None:
    class _CleanupService:
        def cleanup_stale_tickets(self, db: Session, **kwargs):
            return _CleanupResult()

    monkeypatch.setattr(runtime_tasks, "SessionLocal", lambda: sqlite_session)
    monkeypatch.setattr(
        runtime_tasks,
        "RunCallbackTicketCleanupService",
        lambda: _CleanupService(),
    )

    result = runtime_tasks.cleanup_callback_tickets_task(limit=5)

    assert result["expired_count"] == 2
    task_run = sqlite_session.query(ScheduledTaskRunRecord).one()
    assert task_run is not None
    assert task_run.task_name == "runtime.cleanup_callback_tickets"
    assert task_run.status == "succeeded"
    assert task_run.matched_count == 3
    assert task_run.affected_count == 2
    assert task_run.finished_at is not None


def test_monitor_waiting_resumes_task_records_failure(
    sqlite_session: Session,
    monkeypatch,
) -> None:
    class _MonitorService:
        def schedule_due_resumes(self, db: Session, **kwargs):
            raise RuntimeError("monitor boom")

    monkeypatch.setattr(runtime_tasks, "SessionLocal", lambda: sqlite_session)
    monkeypatch.setattr(
        runtime_tasks,
        "WaitingResumeMonitorService",
        lambda: _MonitorService(),
    )

    with pytest.raises(RuntimeError, match="monitor boom"):
        runtime_tasks.monitor_waiting_resumes_task(limit=5)

    task_run = sqlite_session.query(ScheduledTaskRunRecord).one()
    assert task_run.task_name == "runtime.monitor_waiting_resumes"
    assert task_run.status == "failed"
    assert task_run.detail == "monitor boom"
    assert task_run.finished_at is not None
