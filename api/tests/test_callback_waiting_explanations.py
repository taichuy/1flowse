from datetime import UTC, datetime

from app.services.callback_waiting_explanations import build_callback_waiting_explanation


def test_callback_waiting_explanation_prefers_requeue_over_overdue_resume() -> None:
    explanation = build_callback_waiting_explanation(
        lifecycle=None,
        scheduled_resume_delay_seconds=30,
        scheduled_resume_due_at=datetime(2026, 3, 18, 10, 5, tzinfo=UTC),
        scheduled_resume_requeued_at=datetime(2026, 3, 18, 10, 6, tzinfo=UTC),
        scheduled_resume_requeue_source="scheduler_waiting_resume_monitor",
    )

    assert explanation is not None
    assert explanation.primary_signal == (
        "最近一次到期的 scheduled resume 已被重新入队，waiting 节点正在等待新的恢复尝试。"
    )
    assert explanation.follow_up == (
        "下一步：先观察 worker 是否消费这次 requeue。"
        "最近一次 due_at 为 2026-03-18T10:05:00Z。"
        "requeue 时间为 2026-03-18T10:06:00Z。"
        "来源为 scheduler_waiting_resume_monitor。"
        "若仍无推进，再考虑手动 resume。"
    )


def test_callback_waiting_explanation_keeps_pending_callback_priority() -> None:
    explanation = build_callback_waiting_explanation(
        lifecycle=None,
        pending_callback_ticket_count=1,
        scheduled_resume_due_at=datetime(2026, 3, 18, 10, 5, tzinfo=UTC),
        scheduled_resume_requeued_at=datetime(2026, 3, 18, 10, 6, tzinfo=UTC),
        scheduled_resume_requeue_source="scheduler_waiting_resume_monitor",
    )

    assert explanation is not None
    assert explanation.primary_signal == "当前仍有 1 条 callback ticket 等待外部回调。"
