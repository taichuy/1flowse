import Link from "next/link";

import { WorkbenchEntryLinks } from "@/components/workbench-entry-links";
import {
  buildWorkflowCreateFirstScreenShellPresentation,
  type WorkflowCreateRecentDraftItem,
  type WorkflowCreateStarterNextStepSurface
} from "@/components/workflow-create-wizard/presentation";
import type { WorkflowCreateWizardProps } from "@/components/workflow-create-wizard/types";
import { buildWorkflowCreateFirstScreenShellSurfaceCopy } from "@/lib/workbench-entry-surfaces";

export function WorkflowCreateFirstScreenShell(props: WorkflowCreateWizardProps) {
  const {
    activeTrackPresentation,
    createSignalItems,
    currentWorkflowCreateHref,
    featuredNodes,
    hasScopedWorkspaceStarterFilters,
    recentDrafts,
    selectedStarter,
    selectedStarterFactPills,
    selectedStarterMissingToolBlockingSurface,
    selectedStarterNextStepSurface,
    selectedStarterPreviewNodes,
    selectedStarterPreviewOverflow,
    selectedStarterSourceGovernancePresenter,
    shouldRenderSelectedStarterNextStep,
    starterGovernanceHref,
    surfaceCopy,
    workspaceHref
  } = buildWorkflowCreateFirstScreenShellPresentation(props);
  const shellSurfaceCopy = buildWorkflowCreateFirstScreenShellSurfaceCopy({
    starterGovernanceHref
  });
  const governanceHref = resolveGovernanceHref(selectedStarterNextStepSurface, starterGovernanceHref);
  const governanceHrefLabel =
    selectedStarterNextStepSurface?.hrefLabel ?? shellSurfaceCopy.governanceLinkLabel;

  return (
    <section
      className="workflow-create-first-screen-shell panel-stack-gap"
      data-component="workflow-create-first-screen-shell"
      data-has-selected-starter={selectedStarter ? "true" : "false"}
    >
      <section className="workflow-create-topbar">
        <div className="workflow-create-topbar-left">
          <Link href={workspaceHref} className="workflow-create-inline-link workflow-create-inline-chip muted">
            返回工作台
          </Link>
          <div className="workflow-create-topbar-copy">
            <span>{shellSurfaceCopy.eyebrow}</span>
            <strong>{shellSurfaceCopy.title}</strong>
          </div>
        </div>
        <div className="workflow-create-topbar-summary" aria-label="创建页首屏摘要">
          {createSignalItems.map((item) => (
            <span className="workflow-create-inline-chip muted" key={item.label}>
              {item.value} {item.label}
            </span>
          ))}
        </div>
      </section>

      <section className="panel-card panel-stack-gap">
        <div className="section-heading">
          <div>
            <p className="workspace-eyebrow">{shellSurfaceCopy.eyebrow}</p>
            <h2>{shellSurfaceCopy.title}</h2>
            <p>{shellSurfaceCopy.description}</p>
          </div>
          <WorkbenchEntryLinks
            {...shellSurfaceCopy.heroLinks}
            currentHref={currentWorkflowCreateHref}
          />
        </div>

        <div className="panel-muted">
          <p>{shellSurfaceCopy.readyStateDetail}</p>
        </div>

        {hasScopedWorkspaceStarterFilters ? (
          <div className="workflow-create-scoped-banner">
            <strong>Scoped governance</strong>
            <span>{surfaceCopy.scopedGovernanceDescription}</span>
            <Link href={starterGovernanceHref} className="workflow-create-inline-link">
              {surfaceCopy.scopedGovernanceBackLinkLabel}
            </Link>
          </div>
        ) : null}

        <div className="dashboard-card-grid">
          <article className="diagnostic-card panel-stack-gap">
            <strong>{shellSurfaceCopy.activeTrackLabel}</strong>
            <p>{activeTrackPresentation.label}</p>
            <p>{activeTrackPresentation.summary}</p>
          </article>

          <article className="diagnostic-card panel-stack-gap">
            <strong>{shellSurfaceCopy.starterLabel}</strong>
            {selectedStarter ? (
              <>
                <p>{selectedStarter.name}</p>
                <p>{selectedStarter.workflowFocus}</p>
                <div className="workflow-create-signal-row">
                  {selectedStarterFactPills.map((pill) => (
                    <span className="workflow-create-fact-pill" key={pill}>
                      {pill}
                    </span>
                  ))}
                </div>
                <p>
                  预览：{selectedStarterPreviewNodes.join(" → ") || "等待 starter definition"}
                  {selectedStarterPreviewOverflow > 0
                    ? ` · 另有 ${selectedStarterPreviewOverflow} 个节点`
                    : ""}
                </p>
              </>
            ) : (
              <>
                <p>当前筛选范围里没有可复用的 active workspace starter。</p>
                <p>{surfaceCopy.emptyStateDescription}</p>
                <WorkbenchEntryLinks
                  {...surfaceCopy.emptyStateLinks}
                  currentHref={currentWorkflowCreateHref}
                />
              </>
            )}
          </article>

          <article className="diagnostic-card panel-stack-gap">
            <strong>{shellSurfaceCopy.governanceLabel}</strong>
            {selectedStarterMissingToolBlockingSurface ? (
              <>
                <p>{selectedStarterMissingToolBlockingSurface.blockedMessage}</p>
                {governanceHref ? (
                  <Link href={governanceHref} className="workflow-create-inline-link">
                    {governanceHrefLabel}
                  </Link>
                ) : null}
              </>
            ) : selectedStarterNextStepSurface && shouldRenderSelectedStarterNextStep ? (
              <>
                <p>{selectedStarterNextStepSurface.label}</p>
                <p>{selectedStarterNextStepSurface.detail}</p>
                {selectedStarterNextStepSurface.primaryResourceSummary ? (
                  <p>{selectedStarterNextStepSurface.primaryResourceSummary}</p>
                ) : null}
                {governanceHref ? (
                  <Link href={governanceHref} className="workflow-create-inline-link">
                    {governanceHrefLabel}
                  </Link>
                ) : null}
              </>
            ) : selectedStarterSourceGovernancePresenter ? (
              <>
                <p>{selectedStarterSourceGovernancePresenter.tagLabel}</p>
                <p>{selectedStarterSourceGovernancePresenter.summary}</p>
                <div className="workflow-create-signal-row">
                  {selectedStarterSourceGovernancePresenter.chips.map((chip) => (
                    <span className="workflow-create-fact-pill" key={chip}>
                      {chip}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p>当前 starter 已满足进入 Studio 的最小条件；交互表单挂载后即可命名并创建。</p>
            )}
          </article>
        </div>

        <article className="diagnostic-card panel-stack-gap">
          <strong>{shellSurfaceCopy.recentDraftsLabel}</strong>
          {recentDrafts.length > 0 ? (
            <div className="workflow-create-recent-list">
              {recentDrafts.map((workflow) => (
                <RecentDraftLink key={workflow.id} workflow={workflow} />
              ))}
            </div>
          ) : (
            <p>当前还没有历史草稿；命名后将直接创建第一份 workflow 草稿。</p>
          )}
        </article>

        <div className="panel-muted panel-stack-gap">
          <strong>{shellSurfaceCopy.featuredNodesLabel}</strong>
          {featuredNodes.length > 0 ? (
            <div className="workflow-create-signal-row">
              {featuredNodes.map((node) => (
                <span className="workflow-create-fact-pill" key={node.type}>
                  {node.label}
                  {node.supportStatus === "available" ? "" : "（规划中）"}
                </span>
              ))}
            </div>
          ) : null}
          <p>{shellSurfaceCopy.interactivePendingLabel}</p>
        </div>
      </section>
    </section>
  );
}

function RecentDraftLink({ workflow }: { workflow: WorkflowCreateRecentDraftItem }) {
  return (
    <Link className="workflow-create-recent-link" href={workflow.href}>
      <div>
        <strong>{workflow.name}</strong>
        <p>
          v{workflow.version} · {workflow.statusLabel} · {workflow.nodeCount} 个节点
        </p>
      </div>
      <span>{workflow.missingToolSummary ?? "继续编排"}</span>
    </Link>
  );
}

function resolveGovernanceHref(
  nextStepSurface: WorkflowCreateStarterNextStepSurface | null,
  starterGovernanceHref: string
) {
  return (
    nextStepSurface?.href ??
    nextStepSurface?.workflowGovernanceHandoff?.workflowCatalogGapHref ??
    nextStepSurface?.workflowGovernanceHandoff?.workflowGovernanceHref ??
    starterGovernanceHref
  );
}
