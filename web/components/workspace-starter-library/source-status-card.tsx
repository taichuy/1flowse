"use client";

import type { WorkspaceStarterTemplateItem } from "@/lib/get-workspace-starters";
import type { WorkspaceStarterSourceStatus } from "@/lib/workspace-starter-source-status";

type WorkspaceStarterSourceCardProps = {
  template: WorkspaceStarterTemplateItem;
  sourceStatus: WorkspaceStarterSourceStatus | null;
  sourceStatusMessage: string | null;
  isLoadingSourceWorkflow: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function WorkspaceStarterSourceCard({
  template,
  sourceStatus,
  sourceStatusMessage,
  isLoadingSourceWorkflow,
  isRefreshing,
  onRefresh
}: WorkspaceStarterSourceCardProps) {
  const canRefresh = Boolean(template.created_from_workflow_id) && !isLoadingSourceWorkflow;

  return (
    <div className="binding-card compact-card">
      <div className="binding-card-header">
        <div>
          <p className="entry-card-title">Source workflow drift</p>
          <p className="binding-meta">
            {template.created_from_workflow_id ?? "no workflow binding"}
          </p>
        </div>
        <span className="health-pill">
          {isLoadingSourceWorkflow ? "loading" : sourceStatus?.label ?? "-"}
        </span>
      </div>
      <p className="section-copy starter-summary-copy">
        {sourceStatusMessage ?? sourceStatus?.summary ?? "暂无来源状态。"}
      </p>
      <div className="binding-actions">
        <button
          className="sync-button secondary"
          type="button"
          onClick={onRefresh}
          disabled={!canRefresh || isRefreshing}
        >
          {isRefreshing ? "刷新中..." : "从源 workflow 刷新快照"}
        </button>
      </div>
      {sourceStatus ? (
        <div className="summary-strip compact-strip">
          <div className="summary-card">
            <span>Template ver</span>
            <strong>{sourceStatus.templateVersion ?? "n/a"}</strong>
          </div>
          <div className="summary-card">
            <span>Source ver</span>
            <strong>{sourceStatus.sourceVersion ?? "n/a"}</strong>
          </div>
          <div className="summary-card">
            <span>Node delta</span>
            <strong>{sourceStatus.sourceNodeCount - sourceStatus.templateNodeCount}</strong>
          </div>
          <div className="summary-card">
            <span>Edge delta</span>
            <strong>{sourceStatus.sourceEdgeCount - sourceStatus.templateEdgeCount}</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
