"use client";

import { WorkbenchEntryLinks } from "@/components/workbench-entry-links";
import { WorkspaceStarterFollowUpCard } from "@/components/workspace-starter-library/follow-up-card";
import type { WorkspaceStarterTemplateItem } from "@/lib/get-workspace-starters";
import type { UnsupportedWorkflowNodeSummary } from "@/lib/workflow-node-catalog";
import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import type { OperatorRecommendedNextStep } from "@/lib/operator-follow-up-presenters";
import type { WorkflowListItem } from "@/lib/get-workflows";
import {
  buildWorkflowCreateHrefFromWorkspaceStarterViewState,
  buildWorkspaceStarterLibraryHrefFromWorkspaceStarterViewState,
  type WorkspaceStarterGovernanceQueryScope
} from "@/lib/workspace-starter-governance-query";
import {
  buildLegacyPublishAuthModeContractSummary,
  buildLegacyPublishAuthModeFollowUp
} from "@/lib/legacy-publish-auth-contract";
import type { WorkflowValidationNavigatorItem } from "@/lib/workflow-validation-navigation";
import { buildWorkflowCatalogGapDetail } from "@/lib/workflow-governance-handoff";
import { SandboxReadinessOverviewCard } from "@/components/sandbox-readiness-overview-card";
import { WorkflowPersistBlockerNotice } from "@/components/workflow-persist-blocker-notice";
import { WorkflowValidationRemediationCard } from "@/components/workflow-validation-remediation-card";
import { buildWorkflowEditorStarterSaveSurfaceCopy } from "@/lib/workbench-entry-surfaces";
import {
  buildWorkspaceStarterMissingToolGovernanceSurface,
  buildWorkspaceStarterTemplateFollowUpSurface
} from "@/components/workspace-starter-library/shared";

import {
  buildWorkflowPersistBlockerRecommendedNextStep,
  type WorkflowPersistBlocker
} from "../persist-blockers";
import type { WorkflowEditorMessageKind, WorkflowEditorMessageTone } from "../shared";

export type WorkflowEditorDiagnosticsPanelProps = {
  currentHref?: string;
  workflows: WorkflowListItem[];
  unsupportedNodes: UnsupportedWorkflowNodeSummary[];
  message: string | null;
  messageTone: WorkflowEditorMessageTone;
  messageKind?: WorkflowEditorMessageKind;
  savedWorkspaceStarter?: WorkspaceStarterTemplateItem | null;
  persistBlockerSummary: string | null;
  persistBlockers: WorkflowPersistBlocker[];
  persistBlockerRecommendedNextStep?: OperatorRecommendedNextStep | null;
  executionPreflightMessage: string | null;
  toolExecutionValidationIssueCount: number;
  focusedValidationItem?: WorkflowValidationNavigatorItem | null;
  preflightValidationItem?: WorkflowValidationNavigatorItem | null;
  validationNavigatorItems: WorkflowValidationNavigatorItem[];
  traceError: string | null;
  sandboxReadiness?: SandboxReadinessCheck | null;
  workspaceStarterGovernanceQueryScope?: WorkspaceStarterGovernanceQueryScope | null;
  createWorkflowHref?: string;
  workspaceStarterLibraryHref?: string;
  hasScopedWorkspaceStarterFilters?: boolean;
  onNavigateValidationIssue: (item: WorkflowValidationNavigatorItem) => void;
};

function buildValidationIssueGovernancePreview(item: WorkflowValidationNavigatorItem) {
  const chips: string[] = [];
  const details: string[] = [];
  const catalogGapToolIds = Array.from(new Set(item.catalogGapToolIds ?? []));

  if (catalogGapToolIds.length > 0) {
    chips.push("catalog gap");
    const catalogGapDetail = buildWorkflowCatalogGapDetail({
      toolGovernance: {
        referenced_tool_ids: catalogGapToolIds,
        missing_tool_ids: catalogGapToolIds,
        governed_tool_count: 0,
        strong_isolation_tool_count: 0
      },
      subjectLabel: "这条校验项",
      returnDetail:
        "点击这条校验项后，编辑器会跳到对应字段，并继续沿同一份 workflow governance handoff 收口。"
    });

    if (catalogGapDetail) {
      details.push(catalogGapDetail);
    }
  }

  if (item.hasLegacyPublishAuthModeIssues) {
    chips.push("publish auth blocker");
    details.push(
      `${buildLegacyPublishAuthModeContractSummary()} ${buildLegacyPublishAuthModeFollowUp()}`
    );
  }

  if (chips.length === 0 && details.length === 0) {
    return null;
  }

  return {
    chips: Array.from(new Set(chips)),
    details: Array.from(new Set(details))
  };
}

function mergeWorkspaceStarterSelectionIntoHref(href: string, starterId: string) {
  const [pathWithQuery, hash = ""] = href.split("#");
  const [pathname, query = ""] = pathWithQuery.split("?");
  const searchParams = new URLSearchParams(query);

  searchParams.set("starter", starterId);
  searchParams.sort();

  const resolvedQuery = searchParams.toString();
  const resolvedPath = resolvedQuery ? `${pathname}?${resolvedQuery}` : pathname;

  return hash ? `${resolvedPath}#${hash}` : resolvedPath;
}

export function WorkflowEditorDiagnosticsPanel({
  currentHref,
  workflows,
  unsupportedNodes,
  message,
  messageTone,
  messageKind = "default",
  savedWorkspaceStarter = null,
  persistBlockerSummary,
  persistBlockers,
  persistBlockerRecommendedNextStep = null,
  executionPreflightMessage,
  toolExecutionValidationIssueCount,
  focusedValidationItem = null,
  preflightValidationItem = null,
  validationNavigatorItems,
  traceError,
  sandboxReadiness,
  workspaceStarterGovernanceQueryScope = null,
  createWorkflowHref = "/workflows/new",
  workspaceStarterLibraryHref = "/workspace-starters",
  hasScopedWorkspaceStarterFilters = false,
  onNavigateValidationIssue
}: WorkflowEditorDiagnosticsPanelProps) {
  const remediationItem = focusedValidationItem ?? preflightValidationItem;
  const resolvedPersistBlockerRecommendedNextStep =
    persistBlockerRecommendedNextStep ??
    buildWorkflowPersistBlockerRecommendedNextStep(
      persistBlockers,
      sandboxReadiness,
      currentHref
    );
  const feedbackMessage =
    message ??
    (persistBlockers.length > 0
      ? "选择一个待修正项或点击保存，编辑器会跳到首个阻断点。"
      : "选中节点后即可编辑配置，或在画布里点 + 插入下一节点。");
  const savedWorkspaceStarterLibraryHref = savedWorkspaceStarter
    ? workspaceStarterGovernanceQueryScope
      ? buildWorkspaceStarterLibraryHrefFromWorkspaceStarterViewState({
          ...workspaceStarterGovernanceQueryScope,
          selectedTemplateId: savedWorkspaceStarter.id
        })
      : mergeWorkspaceStarterSelectionIntoHref(
          workspaceStarterLibraryHref,
          savedWorkspaceStarter.id
        )
    : workspaceStarterLibraryHref;
  const savedWorkspaceStarterCreateWorkflowHref = savedWorkspaceStarter
    ? workspaceStarterGovernanceQueryScope
      ? buildWorkflowCreateHrefFromWorkspaceStarterViewState({
          ...workspaceStarterGovernanceQueryScope,
          selectedTemplateId: savedWorkspaceStarter.id
        })
      : mergeWorkspaceStarterSelectionIntoHref(createWorkflowHref, savedWorkspaceStarter.id)
    : createWorkflowHref;
  const savedWorkspaceStarterSourceWorkflowId = savedWorkspaceStarter
    ? savedWorkspaceStarter.source_governance?.source_workflow_id ??
      savedWorkspaceStarter.created_from_workflow_id ??
      null
    : null;
  const savedWorkspaceStarterSourceWorkflowSummary = savedWorkspaceStarterSourceWorkflowId
    ? workflows.find((item) => item.id === savedWorkspaceStarterSourceWorkflowId) ?? null
    : null;
  const savedWorkspaceStarterFollowUpSurface = savedWorkspaceStarter
    ? buildWorkspaceStarterMissingToolGovernanceSurface({
        template: savedWorkspaceStarter,
        missingToolIds:
          savedWorkspaceStarterSourceWorkflowSummary?.tool_governance?.missing_tool_ids ?? [],
        sourceWorkflowSummariesById: savedWorkspaceStarterSourceWorkflowSummary
          ? {
              [savedWorkspaceStarterSourceWorkflowSummary.id]:
                savedWorkspaceStarterSourceWorkflowSummary
            }
          : null,
        workspaceStarterGovernanceQueryScope
      }) ??
      buildWorkspaceStarterTemplateFollowUpSurface({
        template: savedWorkspaceStarter,
        createWorkflowHref: savedWorkspaceStarterCreateWorkflowHref,
        workspaceStarterGovernanceQueryScope
      })
    : null;
  const starterSaveSurfaceCopy =
    messageKind === "workspace_starter_saved"
      ? buildWorkflowEditorStarterSaveSurfaceCopy({
          createWorkflowHref: savedWorkspaceStarterCreateWorkflowHref,
          workspaceStarterLibraryHref: savedWorkspaceStarterLibraryHref,
          hasScopedWorkspaceStarterFilters,
          savedStarterName: savedWorkspaceStarter?.name ?? null,
          recommendedNextStepDetail: savedWorkspaceStarterFollowUpSurface?.detail ?? null,
          primaryResourceSummary:
            savedWorkspaceStarterFollowUpSurface?.primaryResourceSummary ?? null,
          workspaceStarterLibraryLabel: savedWorkspaceStarter
            ? `打开刚保存的 starter：${savedWorkspaceStarter.name}`
            : null,
          createWorkflowLabel:
            savedWorkspaceStarterFollowUpSurface?.entryKey === "createWorkflow"
              ? savedWorkspaceStarterFollowUpSurface.entryOverride?.label ??
                savedWorkspaceStarterFollowUpSurface.label
              : null
        })
      : null;

  return (
    <article
      className="diagnostic-panel editor-panel"
      data-component="workflow-editor-diagnostics-panel"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">编辑器反馈</p>
          <h2>当前阻断与下一步</h2>
        </div>
      </div>

      {unsupportedNodes.length > 0 ? (
        <div className="sync-message error">
          <p>当前 workflow 已包含未进入执行主链的节点类型，编辑器会保留它们，但不能假装已可运行：</p>
          <ul className="roadmap-list compact-list">
            {unsupportedNodes.map((item) => (
              <li key={`unsupported-${item.type}`}>
                {item.label} x{item.count}：{item.supportSummary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {persistBlockers.length > 0 ? (
        <WorkflowPersistBlockerNotice
          title="保存阻断"
          summary={persistBlockerSummary}
          blockers={persistBlockers}
          sandboxReadiness={sandboxReadiness}
          currentHref={currentHref}
          hideRecommendedNextStep={Boolean(persistBlockerRecommendedNextStep)}
        />
      ) : null}

      <p className={`sync-message ${messageTone}`}>{feedbackMessage}</p>

      {starterSaveSurfaceCopy ? (
        <WorkspaceStarterFollowUpCard
          title={starterSaveSurfaceCopy.nextStepTitle}
          label={savedWorkspaceStarterFollowUpSurface?.label ?? "继续推进"}
          detail={starterSaveSurfaceCopy.description}
          primaryResourceSummary={starterSaveSurfaceCopy.primaryResourceSummary}
          workflowGovernanceHandoff={savedWorkspaceStarterFollowUpSurface?.workflowGovernanceHandoff}
          actions={<WorkbenchEntryLinks {...starterSaveSurfaceCopy.nextStepLinks} />}
        />
      ) : null}

      <SandboxReadinessOverviewCard
        currentHref={currentHref}
        readiness={sandboxReadiness}
        title="执行前检查"
        intro={executionPreflightMessage}
        hideWhenHealthy={toolExecutionValidationIssueCount === 0}
        hideRecommendedNextStep={Boolean(resolvedPersistBlockerRecommendedNextStep)}
      />

      {remediationItem ? (
        <WorkflowValidationRemediationCard
          currentHref={currentHref}
          item={remediationItem}
          sandboxReadiness={sandboxReadiness}
        />
      ) : null}

      {validationNavigatorItems.length > 0 ? (
        <div className="validation-issue-list">
          {validationNavigatorItems.slice(0, 8).map((item) => {
            const governancePreview = buildValidationIssueGovernancePreview(item);

            return (
              <button
                key={item.key}
                className="validation-issue-button"
                type="button"
                onClick={() => onNavigateValidationIssue(item)}
              >
                <strong>{item.target.label}</strong>
                <span>{item.message}</span>
                {governancePreview ? (
                  <div className="compact-stack">
                    {governancePreview.chips.length > 0 ? (
                      <div className="tool-badge-row">
                        {governancePreview.chips.map((chip) => (
                          <span className="event-chip" key={`${item.key}-${chip}`}>
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {governancePreview.details.map((detail) => (
                      <small className="section-copy" key={`${item.key}-${detail}`}>
                        {detail}
                      </small>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {traceError ? <small className="section-copy">{traceError}</small> : null}
    </article>
  );
}
