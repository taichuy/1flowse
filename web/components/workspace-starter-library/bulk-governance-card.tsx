"use client";

import type {
  WorkspaceStarterBulkAction,
  WorkspaceStarterBulkActionResult
} from "@/lib/get-workspace-starters";

type WorkspaceStarterBulkGovernanceCardProps = {
  inScopeCount: number;
  candidateCounts: Record<WorkspaceStarterBulkAction, number>;
  isMutating: boolean;
  lastResult: WorkspaceStarterBulkActionResult | null;
  onAction: (action: WorkspaceStarterBulkAction) => void;
};

const BULK_ACTIONS: WorkspaceStarterBulkAction[] = [
  "archive",
  "restore",
  "refresh",
  "rebase",
  "delete"
];

export function WorkspaceStarterBulkGovernanceCard({
  inScopeCount,
  candidateCounts,
  isMutating,
  lastResult,
  onAction
}: WorkspaceStarterBulkGovernanceCardProps) {
  return (
    <div className="binding-card compact-card">
      <div className="binding-card-header">
        <div>
          <p className="entry-card-title">Bulk governance</p>
          <p className="binding-meta">
            先用筛选条件收敛模板范围，再对当前结果集批量治理。
          </p>
        </div>
        <span className="health-pill">{inScopeCount} in scope</span>
      </div>
      <div className="starter-tag-row">
        {BULK_ACTIONS.map((action) => (
          <span className="event-chip" key={action}>
            {action} {candidateCounts[action]}
          </span>
        ))}
      </div>
      <p className="section-copy starter-summary-copy">
        删除仍然遵循“先归档再删除”；rebase 会同步 source-derived 字段，批量操作前请先确认当前筛选范围。
      </p>
      {lastResult ? (
        <div className="starter-tag-row">
          <span className="health-pill">
            last run: {getWorkspaceStarterBulkActionLabel(lastResult.action)}
          </span>
          {lastResult.skipped_reason_summary.length > 0 ? (
            lastResult.skipped_reason_summary.map((item) => (
              <span className="event-chip" key={`${item.reason}-${item.count}`}>
                {item.reason} {item.count}
              </span>
            ))
          ) : (
            <span className="event-chip">no skips</span>
          )}
        </div>
      ) : null}
      <div className="binding-actions">
        {BULK_ACTIONS.map((action) => (
          <button
            key={action}
            className="sync-button secondary"
            type="button"
            onClick={() => onAction(action)}
            disabled={candidateCounts[action] === 0 || isMutating}
          >
            {isMutating ? "处理中..." : getWorkspaceStarterBulkActionButtonLabel(action)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function getWorkspaceStarterBulkActionLabel(action: WorkspaceStarterBulkAction) {
  return {
    archive: "归档",
    restore: "恢复",
    refresh: "刷新",
    rebase: "rebase",
    delete: "删除"
  }[action];
}

export function getWorkspaceStarterBulkActionButtonLabel(action: WorkspaceStarterBulkAction) {
  return {
    archive: "批量归档当前结果",
    restore: "批量恢复当前结果",
    refresh: "批量刷新来源快照",
    rebase: "批量执行 rebase",
    delete: "批量删除已归档"
  }[action];
}

export function getWorkspaceStarterBulkActionConfirmationMessage(
  action: WorkspaceStarterBulkAction,
  count: number
) {
  return {
    archive: `确认批量归档当前筛选结果中的 ${count} 个 starter 吗？`,
    restore: `确认批量恢复当前筛选结果中的 ${count} 个 starter 吗？`,
    refresh: `确认批量刷新当前筛选结果中的 ${count} 个 starter 来源快照吗？`,
    rebase: `确认对当前筛选结果中的 ${count} 个 starter 批量执行 rebase 吗？`,
    delete: `确认永久删除当前筛选结果中的 ${count} 个已归档 starter 吗？此操作不可撤销。`
  }[action];
}
