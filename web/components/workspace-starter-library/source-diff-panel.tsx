"use client";

import type { WorkspaceStarterSourceDiff } from "@/lib/get-workspace-starters";

import { buildWorkspaceStarterSourceActionDecision } from "./shared";

type WorkspaceStarterSourceDiffPanelProps = {
  sourceDiff: WorkspaceStarterSourceDiff | null;
  isLoading: boolean;
  isRebasing: boolean;
  onRebase: () => void;
};

export function WorkspaceStarterSourceDiffPanel({
  sourceDiff,
  isLoading,
  isRebasing,
  onRebase
}: WorkspaceStarterSourceDiffPanelProps) {
  const actionDecision = buildWorkspaceStarterSourceActionDecision(sourceDiff);

  return (
    <article className="diagnostic-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Diff</p>
          <h2>Source drift detail</h2>
        </div>
        <p className="section-copy">
          用后端统一 diff 结果展示 template snapshot 与 source workflow 的差异，避免治理页继续各自拼接判断逻辑。
        </p>
      </div>

      {isLoading ? (
        <p className="empty-state">正在加载 source diff...</p>
      ) : !sourceDiff ? (
        <p className="empty-state">当前模板没有可用的 source diff。</p>
      ) : (
        <>
          <div className="summary-strip compact-strip">
            <div className="summary-card">
              <span>Node changes</span>
              <strong>
                {getSummaryChangeCount(sourceDiff.node_summary)}
              </strong>
            </div>
            <div className="summary-card">
              <span>Edge changes</span>
              <strong>{getSummaryChangeCount(sourceDiff.edge_summary)}</strong>
            </div>
            <div className="summary-card">
              <span>Workflow name</span>
              <strong>{sourceDiff.workflow_name_changed ? "Drifted" : "Synced"}</strong>
            </div>
            <div className="summary-card">
              <span>Sandbox drift</span>
              <strong>{getSummaryChangeCount(sourceDiff.sandbox_dependency_summary)}</strong>
            </div>
            <div className="summary-card">
              <span>Rebase fields</span>
              <strong>{sourceDiff.rebase_fields.length}</strong>
            </div>
          </div>

          <div className="binding-card compact-card">
            <div className="binding-card-header">
              <div>
                <p className="entry-card-title">Suggested rebase fields</p>
                <p className="binding-meta">
                  {sourceDiff.changed
                    ? "当源 workflow 已发生演进时，rebase 会同步这些 source-derived 字段。"
                    : "当前 template snapshot 已与 source workflow 对齐。"}
                </p>
              </div>
              <span className="health-pill">{actionDecision.statusLabel}</span>
            </div>
            <p className="section-copy starter-summary-copy">{actionDecision.summary}</p>
            <div className="starter-tag-row">
              {sourceDiff.rebase_fields.length > 0 ? (
                sourceDiff.rebase_fields.map((field) => (
                  <span className="event-chip" key={field}>
                    {field}
                  </span>
                ))
              ) : (
                <span className="event-chip">no rebase needed</span>
              )}
              {actionDecision.factChips.map((item) => (
                <span className="event-chip" key={`decision-${item}`}>
                  {item}
                </span>
              ))}
            </div>
            <div className="binding-actions">
              <button
                className="sync-button secondary"
                type="button"
                onClick={onRebase}
                disabled={!actionDecision.canRebase || isRebasing}
              >
                {isRebasing ? "Rebase 中..." : "执行 rebase"}
              </button>
            </div>
          </div>

          <DiffSection
            title="Node diff"
            summary={sourceDiff.node_summary}
            entries={sourceDiff.node_entries}
          />
          <DiffSection
            title="Edge diff"
            summary={sourceDiff.edge_summary}
            entries={sourceDiff.edge_entries}
          />
          <DiffSection
            title="Sandbox dependency drift"
            summary={sourceDiff.sandbox_dependency_summary}
            entries={sourceDiff.sandbox_dependency_entries}
          />
        </>
      )}
    </article>
  );
}

function DiffSection({
  title,
  summary,
  entries
}: {
  title: string;
  summary: WorkspaceStarterSourceDiff["node_summary"];
  entries: WorkspaceStarterSourceDiff["node_entries"];
}) {
  return (
    <div className="binding-card compact-card">
      <div className="binding-card-header">
        <div>
          <p className="entry-card-title">{title}</p>
          <p className="binding-meta">
            template {summary.template_count} / source {summary.source_count}
          </p>
        </div>
        <span className="health-pill">
          +{summary.added_count} / -{summary.removed_count} / ~{summary.changed_count}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="section-copy starter-summary-copy">当前这一层没有差异。</p>
      ) : (
        <div className="governance-node-list">
          {entries.map((entry) => (
            <div className="binding-card compact-card" key={`${entry.status}-${entry.id}`}>
              <div className="binding-card-header">
                <div>
                  <p className="entry-card-title">{entry.label}</p>
                  <p className="binding-meta">{entry.id}</p>
                </div>
                <span className="health-pill">{entry.status}</span>
              </div>
              {entry.changed_fields.length > 0 ? (
                <div className="starter-tag-row">
                  {entry.changed_fields.map((field) => (
                    <span className="event-chip" key={`${entry.id}-${field}`}>
                      {field}
                    </span>
                  ))}
                </div>
              ) : null}
              {entry.template_facts.length > 0 ? (
                <>
                  <p className="binding-meta">template facts</p>
                  <div className="starter-tag-row">
                    {entry.template_facts.map((fact) => (
                      <span className="event-chip" key={`${entry.id}-template-${fact}`}>
                        {fact}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {entry.source_facts.length > 0 ? (
                <>
                  <p className="binding-meta">source facts</p>
                  <div className="starter-tag-row">
                    {entry.source_facts.map((fact) => (
                      <span className="event-chip" key={`${entry.id}-source-${fact}`}>
                        {fact}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getSummaryChangeCount(summary: WorkspaceStarterSourceDiff["node_summary"]) {
  return summary.added_count + summary.removed_count + summary.changed_count;
}
