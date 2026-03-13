import { WorkspaceStarterSourceCard } from "@/components/workspace-starter-library/source-status-card";
import type { WorkspaceStarterTemplateItem } from "@/lib/get-workspace-starters";
import type { WorkspaceStarterSourceStatus } from "@/lib/workspace-starter-source-status";

import { formatTimestamp } from "./shared";

type WorkspaceStarterDefinitionSnapshotPanelProps = {
  selectedTemplate: WorkspaceStarterTemplateItem | null;
  sourceStatus: WorkspaceStarterSourceStatus | null;
  sourceStatusMessage: string | null;
  isLoadingSourceWorkflow: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function WorkspaceStarterDefinitionSnapshotPanel({
  selectedTemplate,
  sourceStatus,
  sourceStatusMessage,
  isLoadingSourceWorkflow,
  isRefreshing,
  onRefresh
}: WorkspaceStarterDefinitionSnapshotPanelProps) {
  return (
    <article className="diagnostic-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Definition snapshot</h2>
        </div>
      </div>

      {!selectedTemplate ? (
        <p className="empty-state">当前没有可预览的模板定义。</p>
      ) : (
        <>
          <div className="meta-grid">
            <div className="summary-card">
              <span>Updated</span>
              <strong>{formatTimestamp(selectedTemplate.updated_at)}</strong>
            </div>
            <div className="summary-card">
              <span>Workflow version</span>
              <strong>{selectedTemplate.created_from_workflow_version ?? "n/a"}</strong>
            </div>
            <div className="summary-card">
              <span>Source status</span>
              <strong>{sourceStatus?.label ?? "-"}</strong>
            </div>
          </div>

          <div className="starter-tag-row">
            {selectedTemplate.tags.map((tag) => (
              <span className="event-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <WorkspaceStarterSourceCard
            template={selectedTemplate}
            sourceStatus={sourceStatus}
            sourceStatusMessage={sourceStatusMessage}
            isLoadingSourceWorkflow={isLoadingSourceWorkflow}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
          />

          <div className="governance-node-list">
            {(selectedTemplate.definition.nodes ?? []).map((node) => (
              <div className="binding-card compact-card" key={node.id}>
                <div className="binding-card-header">
                  <div>
                    <p className="entry-card-title">{node.name ?? node.id}</p>
                    <p className="binding-meta">
                      {node.type} · {node.id}
                    </p>
                  </div>
                  <span className="health-pill">{node.type}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
