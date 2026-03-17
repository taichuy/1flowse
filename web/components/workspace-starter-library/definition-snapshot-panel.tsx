import { ToolGovernanceSummary } from "@/components/tool-governance-summary";
import { WorkspaceStarterSourceCard } from "@/components/workspace-starter-library/source-status-card";
import type { WorkspaceStarterTemplateItem } from "@/lib/get-workspace-starters";
import type { WorkflowDefinitionToolGovernance } from "@/lib/workflow-definition-tool-governance";
import type { WorkspaceStarterSourceStatus } from "@/lib/workspace-starter-source-status";

import { formatTimestamp } from "./shared";

type WorkspaceStarterDefinitionSnapshotPanelProps = {
  selectedTemplate: WorkspaceStarterTemplateItem | null;
  selectedTemplateToolGovernance: WorkflowDefinitionToolGovernance;
  sourceStatus: WorkspaceStarterSourceStatus | null;
  sourceStatusMessage: string | null;
  isLoadingSourceWorkflow: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function WorkspaceStarterDefinitionSnapshotPanel({
  selectedTemplate,
  selectedTemplateToolGovernance,
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
            <div className="summary-card">
              <span>Governed tools</span>
              <strong>{selectedTemplateToolGovernance.governedToolCount}</strong>
            </div>
            <div className="summary-card">
              <span>Strong isolation</span>
              <strong>{selectedTemplateToolGovernance.strongIsolationToolCount}</strong>
            </div>
            <div className="summary-card">
              <span>Missing catalog tools</span>
              <strong>{selectedTemplateToolGovernance.missingToolIds.length}</strong>
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

          <div className="section-heading">
            <div>
              <p className="eyebrow">Governance</p>
              <h3>Referenced tools</h3>
            </div>
            <p className="section-copy">
              这里直接暴露 starter definition 实际引用到的工具治理事实，避免模板治理只停留在节点数量和来源状态。
            </p>
          </div>

          {selectedTemplateToolGovernance.referencedTools.length === 0 ? (
            <p className="empty-state">
              当前模板还没有引用 tool 节点或 `llm_agent.allowedToolIds`，因此这里没有额外的工具治理摘要。
            </p>
          ) : (
            <div className="governance-node-list">
              {selectedTemplateToolGovernance.referencedTools.map((tool) => (
                <ToolGovernanceSummary
                  key={`${selectedTemplate.id}-${tool.id}`}
                  tool={tool}
                  title={tool.name}
                  subtitle={tool.id}
                  trailingChip={tool.ecosystem}
                />
              ))}
            </div>
          )}

          {selectedTemplateToolGovernance.missingToolIds.length > 0 ? (
            <div className="payload-card compact-card">
              <div className="payload-card-header">
                <div>
                  <span className="status-meta">Catalog gap</span>
                  <p className="binding-meta">
                    这些工具仍被模板引用，但当前 workspace plugin catalog 里还看不到对应定义。
                  </p>
                </div>
                <span className="event-chip">
                  {selectedTemplateToolGovernance.missingToolIds.length} missing
                </span>
              </div>
              <div className="tool-badge-row">
                {selectedTemplateToolGovernance.missingToolIds.map((toolId) => (
                  <span className="event-chip" key={`${selectedTemplate.id}-missing-${toolId}`}>
                    {toolId}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

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
