import Link from "next/link";

import { WorkflowCreateWizard } from "@/components/workflow-create-wizard";
import type { WorkspaceQuickCreateEntry } from "@/components/workspace-apps-workbench/shared";
import type { WorkflowCreateWizardProps } from "@/components/workflow-create-wizard/types";

export function WorkspaceCreateStrip({
  focusedCreateHref,
  requestedKeyword,
  starterCount,
  workflowCreateWizardProps,
  workspaceUtilityEntry
}: {
  focusedCreateHref: string;
  requestedKeyword: string;
  starterCount: number;
  workflowCreateWizardProps: WorkflowCreateWizardProps;
  workspaceUtilityEntry: WorkspaceQuickCreateEntry | null;
}) {
  return (
    <section
      className="workspace-create-strip workspace-catalog-card"
      aria-label="Workspace create strip"
      data-component="workspace-create-strip"
    >
      <div className="workspace-create-strip-copy">
        <p className="workspace-app-card-caption">Create</p>
        <h3>工作台直接新建</h3>
        <p className="workspace-muted workspace-card-copy workspace-create-strip-summary">
          主 CTA 直接复用 `/workflows/new` 的 create launcher，在工作台就完成选模式、选 starter、命名并进入 Studio。
        </p>
        <div className="workspace-create-strip-footnotes">
          <span className="workspace-app-footnote">Starter {starterCount} 个</span>
          <span className="workspace-app-footnote">
            {requestedKeyword ? `当前搜索：${requestedKeyword}` : "创建入口沿用当前筛选范围"}
          </span>
        </div>
      </div>

      <WorkflowCreateWizard {...workflowCreateWizardProps} surface="workspace" />

      <div className="workspace-create-strip-footer">
        <div className="workspace-create-strip-secondary-list workspace-create-strip-utility-list">
          <Link className="workspace-create-strip-action" href={focusedCreateHref}>
            <div>
              <span>打开全屏创建页</span>
              <small>需要专注处理 starter 治理、深链或分享当前筛选时，再切到 `/workflows/new`。</small>
            </div>
            <strong>Full page</strong>
          </Link>

          {workspaceUtilityEntry ? (
            <Link className="workspace-create-strip-action" href={workspaceUtilityEntry.href}>
              <div>
                <span>{workspaceUtilityEntry.title}</span>
                <small>{workspaceUtilityEntry.detail}</small>
              </div>
              <strong>{workspaceUtilityEntry.badge}</strong>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
