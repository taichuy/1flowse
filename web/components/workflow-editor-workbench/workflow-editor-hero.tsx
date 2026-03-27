"use client";

import React from "react";

import { OperatorRecommendedNextStepCard } from "@/components/operator-recommended-next-step-card";
import { WorkflowPersistBlockerNotice } from "@/components/workflow-persist-blocker-notice";
import { WorkbenchEntryLink, WorkbenchEntryLinks } from "@/components/workbench-entry-links";
import type { OperatorRecommendedNextStep } from "@/lib/operator-follow-up-presenters";
import { buildWorkflowEditorHeroSurfaceCopy } from "@/lib/workbench-entry-surfaces";
import type { UnsupportedWorkflowNodeSummary } from "@/lib/workflow-node-catalog";
import type { WorkflowPersistBlocker } from "./persist-blockers";

type WorkflowEditorHeroProps = {
  currentHref?: string | null;
  workflowId: string;
  workflowVersion: string;
  nodesCount: number;
  edgesCount: number;
  toolsCount: number;
  availableRunsCount: number;
  isDirty: boolean;
  selectedNodeLabel: string | null;
  selectedEdgeId: string | null;
  workflowsCount: number;
  selectedRunAttached: boolean;
  plannedNodeLabels: string[];
  unsupportedNodes: UnsupportedWorkflowNodeSummary[];
  contractValidationIssuesCount: number;
  toolReferenceValidationIssuesCount: number;
  nodeExecutionValidationIssuesCount: number;
  toolExecutionValidationIssuesCount: number;
  publishDraftValidationIssuesCount: number;
  persistBlockedMessage: string | null;
  persistBlockerSummary: string | null;
  persistBlockers: WorkflowPersistBlocker[];
  persistBlockerRecommendedNextStep?: OperatorRecommendedNextStep | null;
  isSaving: boolean;
  isSavingStarter: boolean;
  workflowLibraryHref?: string;
  createWorkflowHref?: string;
  workspaceStarterLibraryHref?: string;
  hasScopedWorkspaceStarterFilters?: boolean;
  onSave: () => void;
  onSaveAsWorkspaceStarter: () => void;
};

export function WorkflowEditorHero({
  currentHref = null,
  workflowId,
  workflowVersion,
  nodesCount,
  edgesCount,
  toolsCount,
  availableRunsCount,
  isDirty,
  selectedNodeLabel,
  selectedEdgeId,
  workflowsCount,
  selectedRunAttached,
  plannedNodeLabels,
  unsupportedNodes,
  contractValidationIssuesCount,
  toolReferenceValidationIssuesCount,
  nodeExecutionValidationIssuesCount,
  toolExecutionValidationIssuesCount,
  publishDraftValidationIssuesCount,
  persistBlockedMessage,
  persistBlockerSummary,
  persistBlockers,
  persistBlockerRecommendedNextStep = null,
  isSaving,
  isSavingStarter,
  workflowLibraryHref = "/workflows",
  createWorkflowHref = "/workflows/new",
  workspaceStarterLibraryHref = "/workspace-starters",
  hasScopedWorkspaceStarterFilters = false,
  onSave,
  onSaveAsWorkspaceStarter
}: WorkflowEditorHeroProps) {
  const plannedNodeSummary = plannedNodeLabels.join(" / ");
  const heroSurfaceCopy = buildWorkflowEditorHeroSurfaceCopy({
    workflowLibraryHref,
    createWorkflowHref,
    workspaceStarterLibraryHref,
    plannedNodeSummary
  });

  return (
    <section className="hero editor-hero">
      <div className="hero-copy">
        <p className="eyebrow">Workflow Editor</p>
        <h1>让设计态正式长出画布骨架</h1>
        <p className="hero-text">
          这一版先把 workflow definition 和 `xyflow` 画布接起来，支持最小节点编排、
          边元数据编辑和保存回后端版本链路。更细的节点表单、调试联动和发布配置会继续沿着
          同一条 definition 演进。
        </p>
        <div className="pill-row">
          <span className="pill">workflow {workflowId}</span>
          <span className="pill">version {workflowVersion}</span>
          <span className="pill">{nodesCount} nodes</span>
          <span className="pill">{edgesCount} edges</span>
          <span className="pill">{toolsCount} catalog tools</span>
          <span className="pill">{availableRunsCount} recent runs</span>
          {unsupportedNodes.length > 0 ? (
            <span className="pill">{unsupportedNodes.length} unsupported node types</span>
          ) : null}
          {contractValidationIssuesCount > 0 ? (
            <span className="pill">{contractValidationIssuesCount} contract issues</span>
          ) : null}
          {toolReferenceValidationIssuesCount > 0 ? (
            <span className="pill">{toolReferenceValidationIssuesCount} catalog gap issues</span>
          ) : null}
          {nodeExecutionValidationIssuesCount > 0 ? (
            <span className="pill">{nodeExecutionValidationIssuesCount} node execution issues</span>
          ) : null}
          {toolExecutionValidationIssuesCount > 0 ? (
            <span className="pill">{toolExecutionValidationIssuesCount} execution capability issues</span>
          ) : null}
          {publishDraftValidationIssuesCount > 0 ? (
            <span className="pill">{publishDraftValidationIssuesCount} publish draft issues</span>
          ) : null}
        </div>
        <div className="hero-actions">
          <WorkbenchEntryLinks {...heroSurfaceCopy.heroLinks} />
          <button className="sync-button" type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存 workflow"}
          </button>
          <button
            className="sync-button secondary"
            type="button"
            onClick={onSaveAsWorkspaceStarter}
            disabled={isSavingStarter}
          >
            {isSavingStarter ? "模板保存中..." : "保存为 workspace starter"}
          </button>
        </div>
        <OperatorRecommendedNextStepCard recommendedNextStep={persistBlockerRecommendedNextStep} />
      </div>

      <div className="hero-panel">
        <div className="panel-label">Editor state</div>
        <div className="panel-value">{isDirty ? "Dirty" : "Synced"}</div>
        <p className="panel-text">
          当前保存链路：<strong>{heroSurfaceCopy.saveChainValue}</strong>
        </p>
        <p className="panel-text">
          当前节点边界：
          <strong>{heroSurfaceCopy.plannedNodeBoundaryValue}</strong>
        </p>
        {unsupportedNodes.length > 0 ? (
          <p className="panel-text">
            当前 workflow 已载入未进入执行主链的节点：
            <strong>
              {unsupportedNodes.map((item) => `${item.label} x${item.count}`).join(" / ")}
            </strong>
          </p>
        ) : null}
        {persistBlockedMessage ? (
          <>
            <p className="panel-text">
              当前保存策略：<strong>{persistBlockerSummary}</strong>
            </p>
            <WorkflowPersistBlockerNotice
              title="Hero save gate"
              summary={persistBlockerSummary}
              blockers={persistBlockers}
              currentHref={currentHref}
              hideRecommendedNextStep
              limit={3}
            />
          </>
        ) : null}
        <p className="panel-text">
          当前治理入口：<strong>{heroSurfaceCopy.governanceEntryValue}</strong>
        </p>
        {hasScopedWorkspaceStarterFilters ? (
          <p className="panel-text">
            {heroSurfaceCopy.scopedGovernancePrefix}
            {" "}
            <WorkbenchEntryLink
              className="inline-link secondary"
              linkKey="workspaceStarterLibrary"
              override={{ href: workspaceStarterLibraryHref }}
            >
              {heroSurfaceCopy.scopedGovernanceBackLinkLabel}
            </WorkbenchEntryLink>
            {" "}
            {heroSurfaceCopy.scopedGovernanceInfix}
            {" "}
            <WorkbenchEntryLink
              className="inline-link secondary"
              linkKey="createWorkflow"
              override={{ href: createWorkflowHref }}
            >
              {heroSurfaceCopy.scopedGovernanceCreateWorkflowLabel}
            </WorkbenchEntryLink>
            。
          </p>
        ) : null}
        <dl className="signal-list">
          <div>
            <dt>Selected node</dt>
            <dd>{selectedNodeLabel ?? "-"}</dd>
          </div>
          <div>
            <dt>Selected edge</dt>
            <dd>{selectedEdgeId ?? "-"}</dd>
          </div>
          <div>
            <dt>Workflows</dt>
            <dd>{workflowsCount}</dd>
          </div>
          <div>
            <dt>Selected run</dt>
            <dd>{selectedRunAttached ? "Attached" : "-"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
