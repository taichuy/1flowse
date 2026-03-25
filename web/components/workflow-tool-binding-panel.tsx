import Link from "next/link";

import { updateWorkflowToolBinding } from "@/app/actions/workflow";
import { ToolGovernanceSummary } from "@/components/tool-governance-summary";
import { WorkflowChipLink } from "@/components/workflow-chip-link";
import { WorkflowToolBindingForm } from "@/components/workflow-tool-binding-form";
import type { PluginToolRegistryItem } from "@/lib/get-plugin-registry";
import type { WorkflowDetail, WorkflowListItem } from "@/lib/get-workflows";
import {
  formatCatalogGapSummary,
  formatCatalogGapToolSummary,
  getWorkflowMissingToolIds
} from "@/lib/workflow-definition-governance";
import { getToolGovernanceSummary } from "@/lib/tool-governance";
import { appendWorkflowLibraryViewState } from "@/lib/workflow-library-query";
import { buildWorkflowDetailHref } from "@/lib/workbench-links";

type WorkflowToolBindingPanelProps = {
  workflows: WorkflowListItem[];
  selectedWorkflow: WorkflowDetail | null;
  tools: PluginToolRegistryItem[];
};

type ToolNodeBinding = {
  id: string;
  name: string;
  currentToolId: string;
  currentEcosystem: string;
  currentBindingMode: string;
  currentTool: PluginToolRegistryItem | null;
  missingCatalogEntry: boolean;
};

export function WorkflowToolBindingPanel({
  workflows,
  selectedWorkflow,
  tools
}: WorkflowToolBindingPanelProps) {
  const toolNodes = getToolNodeBindings(selectedWorkflow, tools);
  const workflowMissingToolIds = selectedWorkflow
    ? getWorkflowMissingToolIds(selectedWorkflow)
    : [];
  const boundToolNodes = toolNodes.filter((node) => node.currentToolId);
  const governedToolNodes = boundToolNodes.filter((node) => node.currentTool).length;
  const strongIsolationToolNodes = boundToolNodes.filter((node) => {
    if (!node.currentTool) {
      return false;
    }
    return getToolGovernanceSummary(node.currentTool).requiresStrongIsolationByDefault;
  }).length;
  const missingCatalogBindings = toolNodes.filter((node) => node.missingCatalogEntry).length;
  const bindingMissingToolIds = Array.from(
    new Set(
      toolNodes
        .filter((node) => node.missingCatalogEntry)
        .map((node) => node.currentToolId.trim())
        .filter(Boolean)
    )
  );
  const workflowCatalogGapSummary = formatCatalogGapSummary(workflowMissingToolIds, 3);
  const workflowCatalogGapToolSummary = formatCatalogGapToolSummary(workflowMissingToolIds, 3);
  const bindingCatalogGapToolSummary = formatCatalogGapToolSummary(bindingMissingToolIds, 3);
  const workflowCatalogGapHref = selectedWorkflow
    ? appendWorkflowLibraryViewState(buildWorkflowDetailHref(selectedWorkflow.id), {
        definitionIssue: "missing_tool"
      })
    : null;

  return (
    <article className="diagnostic-panel panel-span" id="workflow-binding">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Workflow</p>
          <h2>Tool node binding</h2>
        </div>
        <p className="section-copy">
          这里继续接住 workflow 级 `catalog gap` 与 tool node binding 状态，避免作者和 AI
          只在首页看到局部节点绑定数量，却错过其它 tool 引用已经脱离当前 catalog 的事实。
        </p>
      </div>

      {workflows.length === 0 ? (
        <p className="empty-state">当前还没有 workflow，可先通过后端 API 创建一个草稿。</p>
      ) : (
        <>
          <div className="workflow-chip-row">
            {workflows.map((workflow) => {
              const selected = workflow.id === selectedWorkflow?.id;

              return (
                <WorkflowChipLink
                  key={workflow.id}
                  workflow={workflow}
                  href={`/?workflow=${encodeURIComponent(workflow.id)}#workflow-binding`}
                  selected={selected}
                />
              );
            })}
          </div>

          {selectedWorkflow ? (
            <div className="binding-workbench">
              <div className="binding-overview">
                <div className="entry-card compact-card">
                  <p className="entry-card-title">{selectedWorkflow.name}</p>
                  <p className="section-copy entry-copy">
                    workflow {selectedWorkflow.id} · 当前版本 {selectedWorkflow.version}
                  </p>
                  <div className="summary-strip compact-strip">
                    <article className="summary-card">
                      <span>Tool nodes</span>
                      <strong>{toolNodes.length}</strong>
                    </article>
                    <article className="summary-card">
                      <span>Catalog tools</span>
                      <strong>{tools.length}</strong>
                    </article>
                    <article className="summary-card">
                      <span>Versions</span>
                      <strong>{selectedWorkflow.versions.length}</strong>
                    </article>
                    <article className="summary-card">
                      <span>Governed bindings</span>
                      <strong>{governedToolNodes}</strong>
                    </article>
                    <article className="summary-card">
                      <span>Strong isolation</span>
                      <strong>{strongIsolationToolNodes}</strong>
                    </article>
                    <article className="summary-card">
                      <span>Catalog gaps</span>
                      <strong>{workflowMissingToolIds.length}</strong>
                    </article>
                  </div>
                  <p className="binding-meta">
                    这里现在直接暴露 workflow 级 catalog gap 与当前绑定节点的治理状态，避免作者只有进入编辑器后才发现某些节点默认需要
                    `sandbox / microvm`，或 workflow 里其它 tool 引用已经脱离当前 catalog。
                  </p>

                  {workflowMissingToolIds.length > 0 ? (
                    <article className="payload-card compact-card">
                      <div className="payload-card-header">
                        <span className="status-meta">
                          {workflowCatalogGapSummary ?? "catalog gap"}
                        </span>
                        {workflowCatalogGapHref ? (
                          <Link className="event-chip inbox-filter-link" href={workflowCatalogGapHref}>
                            回到 workflow 编辑器
                          </Link>
                        ) : null}
                      </div>
                      <p className="binding-meta">{selectedWorkflow.name}</p>
                      <p className="section-copy entry-copy">
                        {buildWorkflowCatalogGapDetail({
                          bindingCatalogGapToolSummary,
                          missingCatalogBindings,
                          workflowMissingToolCount: workflowMissingToolIds.length,
                          workflowCatalogGapToolSummary
                        })}
                      </p>
                      <div className="event-type-strip">
                        {workflowMissingToolIds.slice(0, 4).map((toolId) => (
                          <span className="event-chip" key={`${selectedWorkflow.id}-catalog-gap-${toolId}`}>
                            {toolId}
                          </span>
                        ))}
                      </div>
                    </article>
                  ) : null}
                </div>
              </div>

              <div className="binding-list">
                {toolNodes.length === 0 ? (
                  <p className="empty-state">
                    这个 workflow 里暂时没有 `tool` 节点，因此没有可绑定的目录项。
                  </p>
                ) : (
                  toolNodes.map((node) => (
                    <article className="binding-card" key={node.id}>
                      <div className="binding-card-header">
                        <div>
                          <p className="status-meta">Tool node</p>
                          <h3>{node.name}</h3>
                        </div>
                        <span className={`health-pill ${node.currentToolId ? "up" : "disabled"}`}>
                          {node.currentToolId ? "bound" : "empty"}
                        </span>
                      </div>
                      <p className="binding-meta">
                        当前绑定：
                        {node.currentToolId ? (
                          <>
                            {" "}
                            <strong>{node.currentToolId}</strong> · {node.currentEcosystem} ·{" "}
                            {node.currentBindingMode}
                          </>
                        ) : (
                          " 未设置"
                        )}
                      </p>
                      {node.currentTool ? (
                        <ToolGovernanceSummary
                          tool={node.currentTool}
                          title="Current tool governance"
                          subtitle="当前绑定会沿既有 workflow 版本链继续生效。保存改绑前先确认默认执行边界。"
                          trailingChip={node.currentToolId}
                        />
                      ) : null}
                      {node.missingCatalogEntry ? (
                        <p className="sync-message error">
                          {buildBindingCatalogGapMessage(node.currentToolId)}
                        </p>
                      ) : null}
                      <WorkflowToolBindingForm
                        workflowId={selectedWorkflow.id}
                        nodeId={node.id}
                        nodeName={node.name}
                        currentToolId={node.currentToolId}
                        tools={tools}
                        action={updateWorkflowToolBinding}
                      />
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="empty-state">无法加载所选 workflow 详情，请刷新后重试。</p>
          )}
        </>
      )}
    </article>
  );
}

function buildWorkflowCatalogGapDetail({
  bindingCatalogGapToolSummary,
  missingCatalogBindings,
  workflowMissingToolCount,
  workflowCatalogGapToolSummary
}: {
  bindingCatalogGapToolSummary: string | null;
  missingCatalogBindings: number;
  workflowMissingToolCount: number;
  workflowCatalogGapToolSummary: string | null;
}) {
  const renderedWorkflowCatalogGap = workflowCatalogGapToolSummary ?? "unknown tool";

  if (missingCatalogBindings === 0) {
    return (
      `当前 workflow 仍有 catalog gap（${renderedWorkflowCatalogGap}）；` +
      "当前列表里暂时看不到直接失配的 tool 节点，先回 editor 排查 LLM Agent tool policy 或其它 tool 引用。"
    );
  }

  if (bindingCatalogGapToolSummary && missingCatalogBindings > 0) {
    if (missingCatalogBindings >= workflowMissingToolCount) {
      return (
        `当前 workflow 仍有 catalog gap（${renderedWorkflowCatalogGap}）；` +
        "先回 editor 补齐当前 tool binding，再继续保存和发布。"
      );
    }

    return (
      `当前 workflow 仍有 catalog gap（${renderedWorkflowCatalogGap}）；` +
      `其中 ${missingCatalogBindings} 个已经直接暴露在当前 tool node binding（${bindingCatalogGapToolSummary}），` +
      "其余缺口还要回 editor 继续排查其它 tool 引用。"
    );
  }

  return (
    `当前 workflow 仍有 catalog gap（${renderedWorkflowCatalogGap}）；` +
    "先回 editor 补齐当前 tool binding，再继续保存和发布。"
  );
}

function buildBindingCatalogGapMessage(toolId: string) {
  return `当前 binding 仍有 catalog gap（${toolId}）。请先同步目录，或改绑到仍可用的工具定义。`;
}

function getToolNodeBindings(
  selectedWorkflow: WorkflowDetail | null,
  tools: PluginToolRegistryItem[]
): ToolNodeBinding[] {
  if (!selectedWorkflow?.definition?.nodes) {
    return [];
  }

  return selectedWorkflow.definition.nodes
    .filter((node) => node.type === "tool")
    .map((node) => {
      const toolConfig =
        typeof node.config?.tool === "object" && node.config.tool !== null
          ? (node.config.tool as Record<string, unknown>)
          : null;
      const flatToolId =
        typeof node.config?.toolId === "string" ? String(node.config.toolId) : "";
      const boundToolId =
        typeof toolConfig?.toolId === "string" ? String(toolConfig.toolId) : flatToolId;
      const ecosystem =
        typeof toolConfig?.ecosystem === "string" ? String(toolConfig.ecosystem) : "native";
      const currentTool = boundToolId
        ? tools.find((tool) => tool.id === boundToolId) ?? null
        : null;

      return {
        id: node.id,
        name: node.name,
        currentToolId: boundToolId,
        currentEcosystem: boundToolId ? ecosystem : "-",
        currentBindingMode: toolConfig ? "config.tool" : flatToolId ? "config.toolId" : "-",
        currentTool,
        missingCatalogEntry: Boolean(boundToolId) && !currentTool
      };
    });
}
