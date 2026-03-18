from collections.abc import Iterable

from app.schemas.explanations import SignalFollowUpExplanation
from app.schemas.operator_follow_up import OperatorRunFollowUpSummary, OperatorRunSnapshot


def _join_parts(parts: Iterable[str | None]) -> str | None:
    normalized = [part.strip() for part in parts if isinstance(part, str) and part.strip()]
    if not normalized:
        return None
    return " ".join(normalized)


def _select_primary_snapshot(
    summary: OperatorRunFollowUpSummary,
) -> OperatorRunSnapshot | None:
    for item in summary.sampled_runs:
        if item.snapshot is not None:
            return item.snapshot
    return None


def build_manual_resume_outcome_explanation(
    summary: OperatorRunFollowUpSummary,
) -> SignalFollowUpExplanation:
    snapshot = _select_primary_snapshot(summary)
    if snapshot is None or not snapshot.status:
        return SignalFollowUpExplanation(
            primary_signal="已发起手动恢复；当前还未读取到最新 run 快照。",
            follow_up="请立即回看当前 run 时间线，确认是否真正离开 waiting 状态。",
        )

    status = snapshot.status.strip()
    shared_follow_up = (
        summary.explanation.follow_up.strip()
        if summary.explanation is not None and summary.explanation.follow_up
        else None
    )

    if status == "waiting":
        return SignalFollowUpExplanation(
            primary_signal="已发起手动恢复，但 run 仍处于 waiting。",
            follow_up=_join_parts(
                [
                    "请继续检查 callback ticket、审批进度或定时恢复是否仍在阻塞。",
                    shared_follow_up,
                ]
            ),
        )

    if status == "running":
        return SignalFollowUpExplanation(
            primary_signal="已发起手动恢复，run 已重新进入 running。",
            follow_up=_join_parts(
                [
                    "接下来重点确认节点是否继续推进，而不只是停留在恢复事件。",
                    shared_follow_up,
                ]
            ),
        )

    if status == "succeeded":
        return SignalFollowUpExplanation(
            primary_signal="已发起手动恢复，run 已完成 succeeded。",
            follow_up=_join_parts(
                [
                    "当前阻塞链路已经解除，可回看时间线确认恢复从哪个节点继续完成。",
                    shared_follow_up,
                ]
            ),
        )

    if status == "failed":
        return SignalFollowUpExplanation(
            primary_signal="已发起手动恢复，但 run 已落到 failed。",
            follow_up=_join_parts(
                [
                    "请结合 blocker timeline 与节点错误继续排障。",
                    shared_follow_up,
                ]
            ),
        )

    return SignalFollowUpExplanation(
        primary_signal=f"已发起手动恢复，当前 run 状态：{status}。",
        follow_up=_join_parts(
            [
                "请继续回看时间线确认这次恢复是否真正推动了执行。",
                shared_follow_up,
            ]
        ),
    )
