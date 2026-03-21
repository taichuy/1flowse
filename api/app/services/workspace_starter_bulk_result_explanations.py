from __future__ import annotations

from app.schemas.explanations import SignalFollowUpExplanation
from app.schemas.workspace_starter import (
    WorkspaceStarterBulkAction,
    WorkspaceStarterBulkReceiptItem,
    WorkspaceStarterBulkSkippedSummary,
    WorkspaceStarterSourceDiffSummary,
)

_ACTION_LABELS: dict[WorkspaceStarterBulkAction, str] = {
    "archive": "归档",
    "restore": "恢复",
    "refresh": "刷新",
    "rebase": "rebase",
    "delete": "删除",
}

_REASON_LABELS = {
    "not_found": "不存在",
    "already_archived": "已归档",
    "not_archived": "未归档",
    "no_source_workflow": "无来源",
    "source_workflow_missing": "来源缺失",
    "source_workflow_invalid": "来源无效",
    "delete_requires_archive": "需先归档",
    "already_aligned": "已对齐",
    "name_drift_only": "仅名称漂移",
}

_FOLLOW_UP_REASON_PRIORITY = {
    "name_drift_only": 0,
    "delete_requires_archive": 1,
    "source_workflow_invalid": 2,
    "source_workflow_missing": 2,
    "no_source_workflow": 2,
    "not_archived": 3,
    "already_archived": 4,
    "not_found": 9,
    "already_aligned": 99,
}


def build_workspace_starter_bulk_outcome_explanation(
    *,
    action: WorkspaceStarterBulkAction,
    requested_count: int,
    processed_count: int,
    deleted_count: int,
    skipped_reason_summary: list[WorkspaceStarterBulkSkippedSummary],
    sandbox_dependency_changes: WorkspaceStarterSourceDiffSummary | None,
    sandbox_dependency_item_count: int,
) -> SignalFollowUpExplanation:
    action_label = _ACTION_LABELS[action]
    skipped_count = sum(item.count for item in skipped_reason_summary)
    skip_summary_text = _format_skip_summary(skipped_reason_summary)
    sandbox_node_count = _count_summary_changes(sandbox_dependency_changes)
    sandbox_template_count = sandbox_dependency_item_count

    primary_parts = [
        f"本次批量{action_label}请求 {requested_count} 个 starter；"
        f"实际处理 {processed_count} 个"
        f"{f'（其中删除 {deleted_count} 个）' if deleted_count > 0 else ''}。"
    ]
    if skipped_count > 0:
        skipped_summary_suffix = f"（{skip_summary_text}）" if skip_summary_text else ""
        primary_parts.append(
            f"结果回执里还有 {skipped_count} 个跳过项{skipped_summary_suffix}。"
        )
    if sandbox_node_count > 0:
        primary_parts.append(
            "其中 "
            f"{sandbox_template_count} 个 starter / {sandbox_node_count} 个 "
            "sandbox 依赖漂移节点已沉淀进同一份 result receipt。"
        )

    follow_up_parts: list[str] = []
    reason_counts = {item.reason: item.count for item in skipped_reason_summary}
    if reason_counts.get("name_drift_only", 0) > 0:
        follow_up_parts.append(
            "优先对标记为“仅名称漂移”的 starter 执行 rebase，让命名与来源 workflow 保持一致。"
        )
    if reason_counts.get("delete_requires_archive", 0) > 0:
        follow_up_parts.append(
            "删除失败的 starter 需要先归档，再重新执行批量删除。"
        )
    if any(
        reason_counts.get(reason, 0) > 0
        for reason in ("source_workflow_invalid", "source_workflow_missing", "no_source_workflow")
    ):
        follow_up_parts.append(
            f"先修复来源 workflow 的缺失或无效问题，再重新执行批量{action_label}。"
        )
    if sandbox_node_count > 0:
        follow_up_parts.append(
            "优先复核 result receipt 中带 sandbox drift 的 starter，"
            "确认依赖节点与隔离策略是否仍符合预期。"
        )

    if not follow_up_parts and skipped_count > 0:
        follow_up_parts.append(
            "优先沿 result receipt focus 逐项处理跳过原因，再继续后续批量治理。"
        )
    if not follow_up_parts and processed_count > 0:
        follow_up_parts.append(
            "可继续沿 result receipt 核对 source version、action decision "
            "与历史记录，确认本轮批量治理已经对齐。"
        )
    if not follow_up_parts:
        follow_up_parts.append("当前无额外后续动作。")

    return SignalFollowUpExplanation(
        primary_signal=" ".join(part.strip() for part in primary_parts if part.strip()),
        follow_up=" ".join(part.strip() for part in follow_up_parts if part.strip()),
    )


def build_workspace_starter_bulk_follow_up_template_ids(
    *,
    action: WorkspaceStarterBulkAction,
    receipt_items: list[WorkspaceStarterBulkReceiptItem],
) -> list[str]:
    prioritized: list[tuple[int, int, str]] = []
    seen_template_ids: set[str] = set()

    for index, item in enumerate(receipt_items):
        template_id = item.template_id.strip()
        if not template_id or template_id in seen_template_ids or item.outcome == "deleted":
            continue

        priority = _resolve_follow_up_priority(action=action, item=item)
        if priority is None:
            continue

        prioritized.append((priority, index, template_id))
        seen_template_ids.add(template_id)

    prioritized.sort(key=lambda candidate: (candidate[0], candidate[1]))
    return [template_id for _, _, template_id in prioritized]


def _count_summary_changes(summary: WorkspaceStarterSourceDiffSummary | None) -> int:
    if summary is None:
        return 0
    return summary.added_count + summary.removed_count + summary.changed_count


def _format_skip_summary(
    skipped_reason_summary: list[WorkspaceStarterBulkSkippedSummary],
) -> str | None:
    if not skipped_reason_summary:
        return None
    parts = []
    for item in skipped_reason_summary:
        parts.append(f"{_REASON_LABELS.get(item.reason, item.reason)} {item.count}")
    return " / ".join(parts)


def _resolve_follow_up_priority(
    *,
    action: WorkspaceStarterBulkAction,
    item: WorkspaceStarterBulkReceiptItem,
) -> int | None:
    if item.outcome == "skipped":
        reason = item.reason or ""
        priority = _FOLLOW_UP_REASON_PRIORITY.get(reason, 8)
        return None if priority >= 99 else priority

    recommended_action = item.action_decision.recommended_action if item.action_decision else None
    if recommended_action and recommended_action not in {"none", action}:
        return 5
    if item.sandbox_dependency_nodes:
        return 6
    if item.changed:
        return 7
    return None
