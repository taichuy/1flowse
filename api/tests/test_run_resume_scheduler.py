from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.run_resume_scheduler import RunResumeScheduler


def test_run_resume_scheduler_dispatches_after_commit(sqlite_session: Session) -> None:
    scheduled_resumes = []
    scheduler = RunResumeScheduler(dispatcher=scheduled_resumes.append)

    sqlite_session.execute(text("SELECT 1"))
    scheduler.schedule(
        db=sqlite_session,
        run_id="run-after-commit",
        reason="after commit",
        source="test",
    )

    assert scheduled_resumes == []

    sqlite_session.commit()

    assert len(scheduled_resumes) == 1
    assert scheduled_resumes[0].run_id == "run-after-commit"
    assert scheduled_resumes[0].reason == "after commit"
    assert scheduled_resumes[0].source == "test"


def test_run_resume_scheduler_clears_pending_requests_on_rollback(sqlite_session: Session) -> None:
    scheduled_resumes = []
    scheduler = RunResumeScheduler(dispatcher=scheduled_resumes.append)

    sqlite_session.execute(text("SELECT 1"))
    scheduler.schedule(
        db=sqlite_session,
        run_id="run-rollback",
        reason="rollback",
        source="test",
    )

    assert scheduled_resumes == []

    sqlite_session.rollback()

    assert scheduled_resumes == []

    sqlite_session.execute(text("SELECT 1"))
    sqlite_session.commit()

    assert scheduled_resumes == []
