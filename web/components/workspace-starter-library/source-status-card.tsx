"use client";

import type { WorkspaceStarterSourceDiff, WorkspaceStarterTemplateItem } from "@/lib/get-workspace-starters";
import type { WorkspaceStarterSourceStatus } from "@/lib/workspace-starter-source-status";

import { buildWorkspaceStarterSourceActionDecision } from "./shared";

type WorkspaceStarterSourceCardProps = {
  template: WorkspaceStarterTemplateItem;
  sourceStatus: WorkspaceStarterSourceStatus | null;
  sourceStatusMessage: string | null;
  isLoadingSourceWorkflow: boolean;
  sourceDiff: WorkspaceStarterSourceDiff | null;
  isLoadingSourceDiff: boolean;
  isRefreshing: boolean;
  isRebasing: boolean;
  onRefresh: () => void;
  onRebase: () => void;
};

export function WorkspaceStarterSourceCard({
  template,
  sourceStatus,
  sourceStatusMessage,
  isLoadingSourceWorkflow,
  sourceDiff,
  isLoadingSourceDiff,
  isRefreshing,
  isRebasing,
  onRefresh,
  onRebase
}: WorkspaceStarterSourceCardProps) {
  const hasSourceBinding = Boolean(template.created_from_workflow_id);
  const actionDecision = buildWorkspaceStarterSourceActionDecision(sourceDiff);
  const canRefresh =
    hasSourceBinding &&
    !isLoadingSourceWorkflow &&
    !isLoadingSourceDiff &&
    actionDecision.canRefresh;
  const canRebase =
    hasSourceBinding &&
    !isLoadingSourceWorkflow &&
    !isLoadingSourceDiff &&
    actionDecision.canRebase;
  const templateNextStep = template.recommended_next_step.trim();

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
      {hasSourceBinding ? (
        <>
          <div className="starter-tag-row">
            <span className="health-pill">
              {isLoadingSourceDiff ? "loading diff" : actionDecision.statusLabel}
            </span>
            {!isLoadingSourceDiff
              ? actionDecision.factChips.map((item) => (
                  <span className="event-chip" key={`${template.id}-${item}`}>
                    {item}
                  </span>
                ))
              : null}
          </div>
          <p className="section-copy starter-summary-copy">
            {isLoadingSourceDiff
              ? "正在加载 source diff，稍后会把 refresh / rebase 建议收口到这里。"
              : actionDecision.summary}
          </p>
          {templateNextStep ? (
            <p className="section-copy starter-summary-copy">
              <strong>Template note:</strong> {templateNextStep}
            </p>
          ) : null}
          <div className="binding-actions">
            <button
              className={
                actionDecision.recommendedAction === "refresh"
                  ? "sync-button"
                  : "sync-button secondary"
              }
              type="button"
              onClick={onRefresh}
              disabled={!canRefresh || isRefreshing}
            >
              {isRefreshing ? "刷新中..." : "从源 workflow 刷新快照"}
            </button>
            <button
              className={
                actionDecision.recommendedAction === "rebase"
                  ? "sync-button"
                  : "sync-button secondary"
              }
              type="button"
              onClick={onRebase}
              disabled={!canRebase || isRebasing}
            >
              {isRebasing ? "Rebase 中..." : "执行 rebase"}
            </button>
          </div>
        </>
      ) : null}
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
