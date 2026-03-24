from datetime import UTC, datetime

from app.schemas.sensitive_access import SensitiveResourceItem
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


def test_callback_waiting_explanation_surfaces_primary_governed_resource() -> None:
    explanation = build_callback_waiting_explanation(
        lifecycle=None,
        pending_approval_count=1,
        primary_resource=SensitiveResourceItem(
            id="resource-1",
            label="Credential · Ops Key",
            description=None,
            sensitivity_level="L3",
            source="credential",
            metadata={},
            credential_governance={
                "credential_id": "cred-ops-key",
                "credential_name": "Ops Key",
                "credential_type": "api_key",
                "credential_status": "active",
                "sensitivity_level": "L3",
                "sensitive_resource_id": "resource-1",
                "sensitive_resource_label": "Credential · Ops Key",
                "credential_ref": "credential://cred-ops-key",
                "summary": "本次命中的凭据是 Ops Key（api_key）；当前治理级别 L3，状态 生效中。",
            },
            created_at=datetime(2026, 3, 18, 10, 0, tzinfo=UTC),
            updated_at=datetime(2026, 3, 18, 10, 0, tzinfo=UTC),
        ),
    )

    assert explanation is not None
    assert explanation.primary_signal == (
        "当前 callback waiting 仍卡在 1 条待处理审批；"
        "首要治理资源是 Credential · Ops Key · L3 治理 · 生效中。"
    )
    assert explanation.follow_up == (
        "下一步：先在当前 operator 入口完成 Credential · Ops Key · L3 治理 · 生效中 "
        "对应审批或拒绝，再观察 waiting 节点是否自动恢复。"
    )


def test_callback_waiting_explanation_mentions_resource_when_notification_retry_is_needed() -> None:
    explanation = build_callback_waiting_explanation(
        lifecycle=None,
        pending_approval_count=2,
        failed_notification_count=1,
        primary_resource=SensitiveResourceItem(
            id="resource-1",
            label="Trace Export",
            description=None,
            sensitivity_level="L2",
            source="local_capability",
            metadata={},
            credential_governance=None,
            created_at=datetime(2026, 3, 18, 10, 0, tzinfo=UTC),
            updated_at=datetime(2026, 3, 18, 10, 0, tzinfo=UTC),
        ),
    )

    assert explanation is not None
    assert explanation.primary_signal == (
        "当前 callback waiting 仍卡在 2 条待处理审批；首要治理资源是 Trace Export。"
    )
    assert explanation.follow_up == (
        "下一步：先重试或改投 Trace Export 对应审批通知，再处理审批结果；"
        "不要直接强制恢复 run。"
    )
