"use client";

import type { WorkspaceStarterSourceDiff } from "@/lib/get-workspace-starters";

import {
  buildWorkspaceStarterSourceDiffSurface,
  type WorkspaceStarterSourceDiffSectionSurface
} from "./shared";

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
  const surface = buildWorkspaceStarterSourceDiffSurface(sourceDiff);

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
      ) : !surface ? (
        <p className="empty-state">当前模板没有可用的 source diff。</p>
      ) : (
        <>
          <div className="summary-strip compact-strip">
            {surface.summaryCards.map((item) => (
              <div className="summary-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="binding-card compact-card">
            <div className="binding-card-header">
              <div>
                <p className="entry-card-title">{surface.rebaseCard.title}</p>
                <p className="binding-meta">{surface.rebaseCard.meta}</p>
              </div>
              <span className="health-pill">{surface.rebaseCard.statusLabel}</span>
            </div>
            <p className="section-copy starter-summary-copy">{surface.rebaseCard.summary}</p>
            <div className="starter-tag-row">
              {surface.rebaseCard.chips.map((item) => (
                <span className="event-chip" key={`rebase-${item}`}>
                  {item}
                </span>
              ))}
            </div>
            <div className="binding-actions">
              <button
                className="sync-button secondary"
                type="button"
                onClick={onRebase}
                disabled={!surface.rebaseCard.canRebase || isRebasing}
              >
                {isRebasing ? "Rebase 中..." : "执行 rebase"}
              </button>
            </div>
          </div>

          {surface.sections.map((section) => (
            <DiffSection key={section.key} section={section} />
          ))}
        </>
      )}
    </article>
  );
}

function DiffSection({ section }: { section: WorkspaceStarterSourceDiffSectionSurface }) {
  return (
    <div className="binding-card compact-card">
      <div className="binding-card-header">
        <div>
          <p className="entry-card-title">{section.title}</p>
          <p className="binding-meta">{section.summary}</p>
        </div>
        <span className="health-pill">{section.changeBadge}</span>
      </div>
      {section.entries.length === 0 ? (
        <p className="section-copy starter-summary-copy">{section.emptyMessage}</p>
      ) : (
        <div className="governance-node-list">
          {section.entries.map((entry) => (
            <div className="binding-card compact-card" key={entry.key}>
              <div className="binding-card-header">
                <div>
                  <p className="entry-card-title">{entry.title}</p>
                  <p className="binding-meta">{entry.meta}</p>
                </div>
                <span className="health-pill">{entry.statusLabel}</span>
              </div>
              {entry.changedFields.length > 0 ? (
                <div className="starter-tag-row">
                  {entry.changedFields.map((field) => (
                    <span className="event-chip" key={`${entry.key}-${field}`}>
                      {field}
                    </span>
                  ))}
                </div>
              ) : null}
              {entry.templateFacts.length > 0 ? (
                <>
                  <p className="binding-meta">template facts</p>
                  <div className="starter-tag-row">
                    {entry.templateFacts.map((fact) => (
                      <span className="event-chip" key={`${entry.key}-template-${fact}`}>
                        {fact}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {entry.sourceFacts.length > 0 ? (
                <>
                  <p className="binding-meta">source facts</p>
                  <div className="starter-tag-row">
                    {entry.sourceFacts.map((fact) => (
                      <span className="event-chip" key={`${entry.key}-source-${fact}`}>
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
