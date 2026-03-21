import type { Metadata } from "next";
import Link from "next/link";

import { WorkbenchEntryLinks } from "@/components/workbench-entry-links";
import { WorkflowChipLink } from "@/components/workflow-chip-link";
import { getWorkflows, type WorkflowListItem } from "@/lib/get-workflows";
import { formatCountMap } from "@/lib/runtime-presenters";

export const metadata: Metadata = {
  title: "Workflows | 7Flows Studio"
};

export default async function WorkflowsPage() {
  const workflows = await getWorkflows();
  const summary = buildWorkflowLibrarySummary(workflows);

  return (
    <main className="page-shell workspace-page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Workflow library</p>
          <h1>作者、operator 与运行入口统一收口</h1>
          <p className="hero-copy">
            这里汇总可编辑 workflow、工具治理信号与下一步动作，避免从 sensitive access 或首页回链时落到不存在的 workflows 路由。
          </p>
        </div>
        <WorkbenchEntryLinks
          keys={["createWorkflow", "workspaceStarterLibrary", "runLibrary", "home"]}
        />
      </section>

      <section className="diagnostics-layout">
        <article className="diagnostic-panel panel-span">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Editor entry</p>
              <h2>可编辑 workflow 列表</h2>
            </div>
            <p className="section-copy">
              列表继续复用 editor chip 语义，优先暴露节点数、工具治理与强隔离信号，让作者与 operator 都能直接进入正确的 workflow 详情。
            </p>
          </div>

          <div className="summary-strip">
            <article className="summary-card">
              <span>Workflows</span>
              <strong>{summary.workflowCount}</strong>
            </article>
            <article className="summary-card">
              <span>Total nodes</span>
              <strong>{summary.totalNodeCount}</strong>
            </article>
            <article className="summary-card">
              <span>Statuses</span>
              <strong>{formatCountMap(summary.statusCounts)}</strong>
            </article>
          </div>

          {workflows.length === 0 ? (
            <div className="empty-state-block">
              <p className="empty-state">
                当前还没有可编辑的 workflow。现在可以从 workspace starter 或新建向导继续补主链，而不用再回退到 API 层手工创建。
              </p>
              <Link className="inline-link" href="/workflows/new">
                进入新建向导
              </Link>
            </div>
          ) : (
            <div className="workflow-chip-row">
              {workflows.map((workflow) => (
                <WorkflowChipLink
                  key={`workflow-library-${workflow.id}`}
                  workflow={workflow}
                  href={`/workflows/${encodeURIComponent(workflow.id)}`}
                />
              ))}
            </div>
          )}
        </article>

        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Governance</p>
              <h2>工具与隔离信号</h2>
            </div>
            <p className="section-copy">
              workflow 列表不再只是跳板；它同时提示当前还有多少 workflow 需要继续处理缺失工具、强隔离或运行 follow-up。
            </p>
          </div>

          <div className="summary-strip">
            <article className="summary-card">
              <span>Governed tools</span>
              <strong>{summary.governedToolCount}</strong>
            </article>
            <article className="summary-card">
              <span>Strong isolation</span>
              <strong>{summary.strongIsolationToolCount}</strong>
            </article>
            <article className="summary-card">
              <span>Missing tool workflows</span>
              <strong>{summary.workflowMissingToolCount}</strong>
            </article>
          </div>

          <div className="event-type-strip">
            {summary.workflowsWithMissingTools.length === 0 ? (
              <p className="empty-state compact">当前 workflow 列表里没有缺失 catalog tool 的条目。</p>
            ) : (
              summary.workflowsWithMissingTools.map((workflow) => (
                <span className="event-chip" key={workflow.id}>
                  {workflow.name} · missing tools
                </span>
              ))
            )}
          </div>

          <div className="entry-card">
            <p className="entry-card-title">继续推进主链</p>
            <p className="section-copy entry-copy">
              如果还需要补 starter 来源治理或回到 operator 收件箱，可以从这里继续进入 workspace starter library 或 sensitive access inbox。
            </p>
            <WorkbenchEntryLinks
              keys={["workspaceStarterLibrary", "operatorInbox", "runLibrary"]}
              overrides={{
                workspaceStarterLibrary: {
                  label: "打开 workspace starter library"
                },
                operatorInbox: {
                  label: "打开 sensitive access inbox"
                }
              }}
              primaryKey="workspaceStarterLibrary"
              variant="inline"
            />
          </div>
        </article>
      </section>
    </main>
  );
}

function buildWorkflowLibrarySummary(workflows: WorkflowListItem[]) {
  const statusCounts: Record<string, number> = {};
  let totalNodeCount = 0;
  let governedToolCount = 0;
  let strongIsolationToolCount = 0;
  const workflowsWithMissingTools: WorkflowListItem[] = [];

  for (const workflow of workflows) {
    statusCounts[workflow.status] = (statusCounts[workflow.status] ?? 0) + 1;
    totalNodeCount += workflow.node_count;
    governedToolCount += workflow.tool_governance?.governed_tool_count ?? 0;
    strongIsolationToolCount += workflow.tool_governance?.strong_isolation_tool_count ?? 0;

    if ((workflow.tool_governance?.missing_tool_ids.length ?? 0) > 0) {
      workflowsWithMissingTools.push(workflow);
    }
  }

  return {
    workflowCount: workflows.length,
    totalNodeCount,
    governedToolCount,
    strongIsolationToolCount,
    workflowMissingToolCount: workflowsWithMissingTools.length,
    workflowsWithMissingTools,
    statusCounts
  };
}
