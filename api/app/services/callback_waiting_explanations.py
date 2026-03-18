from __future__ import annotations

from datetime import UTC, datetime

from app.schemas.run_views import (
    CallbackWaitingLifecycleSummary,
    RunExecutionFocusExplanation,
)


def _normalize_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, str):
        normalized_value = value.strip()
        if not normalized_value:
            return None
        try:
            value = datetime.fromisoformat(normalized_value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _format_copy_datetime(value: datetime | str | None) -> str | None:
    normalized = _normalize_datetime(value)
    if normalized is None:
        return None
    return normalized.isoformat().replace("+00:00", "Z")


def _is_overdue(value: datetime | str | None) -> bool:
    normalized = _normalize_datetime(value)
    if normalized is None:
        return False
    return normalized <= datetime.now(UTC)


def build_callback_waiting_explanation(
    *,
    lifecycle: CallbackWaitingLifecycleSummary | None,
    pending_callback_ticket_count: int = 0,
    pending_approval_count: int = 0,
    failed_notification_count: int = 0,
    scheduled_resume_delay_seconds: float | None = None,
    scheduled_resume_due_at: datetime | str | None = None,
    scheduled_resume_requeued_at: datetime | str | None = None,
    scheduled_resume_requeue_source: str | None = None,
) -> RunExecutionFocusExplanation | None:
    if pending_approval_count > 0:
        primary_signal = (
            f"当前 callback waiting 仍卡在 {pending_approval_count} 条待处理审批。"
            if pending_approval_count > 1
            else "当前 callback waiting 仍卡在 1 条待处理审批。"
        )
        follow_up = (
            "下一步：先重试或改投审批通知，再处理审批结果；不要直接强制恢复 run。"
            if failed_notification_count > 0
            else "下一步：先在当前 operator 入口完成审批或拒绝，再观察 waiting 节点是否自动恢复。"
        )
        return RunExecutionFocusExplanation(
            primary_signal=primary_signal,
            follow_up=follow_up,
        )

    if lifecycle is not None and lifecycle.terminated:
        termination_reason = (lifecycle.termination_reason or "callback waiting terminated").strip()
        terminated_at = _format_copy_datetime(lifecycle.terminated_at)
        follow_up = (
            f"下一步：先确认终止原因 {termination_reason} 和终止时间 {terminated_at}，不要直接 resume。"
            if terminated_at
            else f"下一步：先确认终止原因 {termination_reason}，不要直接 resume。"
        )
        return RunExecutionFocusExplanation(
            primary_signal="当前 callback waiting 已终止。",
            follow_up=follow_up,
        )

    expired_ticket_count = lifecycle.expired_ticket_count if lifecycle is not None else 0
    if expired_ticket_count > 0:
        return RunExecutionFocusExplanation(
            primary_signal=(
                f"当前 callback waiting 已出现 {expired_ticket_count} 条过期 callback ticket。"
            ),
            follow_up=(
                "下一步：先清理过期 ticket 并重排 scheduled resume，再判断是否需要手动恢复。"
            ),
        )

    if pending_callback_ticket_count > 0:
        primary_signal = (
            f"当前仍有 {pending_callback_ticket_count} 条 callback ticket 等待外部回调。"
            if pending_callback_ticket_count > 1
            else "当前仍有 1 条 callback ticket 等待外部回调。"
        )
        return RunExecutionFocusExplanation(
            primary_signal=primary_signal,
            follow_up=(
                "下一步：优先确认外部系统是否已经回调，不要重复触发 resume 或额外发起同类请求。"
            ),
        )

    late_callback_count = lifecycle.late_callback_count if lifecycle is not None else 0
    if late_callback_count > 0:
        return RunExecutionFocusExplanation(
            primary_signal=(
                f"已有 {late_callback_count} 条 late callback 到达，但 run 还没有继续推进。"
            ),
            follow_up=(
                "下一步：可以优先尝试手动 resume，并检查 worker 是否已经消费到最新 callback。"
            ),
        )

    requeued_at = _format_copy_datetime(scheduled_resume_requeued_at)
    requeue_source = (scheduled_resume_requeue_source or "").strip() or None
    if requeued_at is not None or requeue_source is not None:
        due_at = _format_copy_datetime(scheduled_resume_due_at)
        follow_up_parts = ["下一步：先观察 worker 是否消费这次 requeue。"]
        if due_at is not None:
            follow_up_parts.append(f"最近一次 due_at 为 {due_at}。")
        if requeued_at is not None:
            follow_up_parts.append(f"requeue 时间为 {requeued_at}。")
        if requeue_source is not None:
            follow_up_parts.append(f"来源为 {requeue_source}。")
        follow_up_parts.append("若仍无推进，再考虑手动 resume。")
        return RunExecutionFocusExplanation(
            primary_signal="最近一次到期的 scheduled resume 已被重新入队，waiting 节点正在等待新的恢复尝试。",
            follow_up="".join(follow_up_parts),
        )

    if _is_overdue(scheduled_resume_due_at):
        due_at = _format_copy_datetime(scheduled_resume_due_at)
        return RunExecutionFocusExplanation(
            primary_signal="当前 scheduled resume 已超窗，waiting 节点没有按计划自动恢复。",
            follow_up=(
                f"下一步：先检查 scheduler / worker 健康度；最近一次 due_at 为 {due_at}，必要时执行手动 resume。"
                if due_at
                else "下一步：先检查 scheduler / worker 健康度，必要时执行手动 resume。"
            ),
        )

    if scheduled_resume_delay_seconds is not None:
        return RunExecutionFocusExplanation(
            primary_signal=(
                f"系统已经安排 {scheduled_resume_delay_seconds:g}s 后再次尝试恢复 callback waiting。"
            ),
            follow_up=(
                "下一步：先观察自动恢复链路；只有在需要绕过当前 backoff 时，再手动 resume 或 cleanup。"
            ),
        )

    return None
