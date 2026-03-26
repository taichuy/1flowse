import type {
  WorkflowLegacyAuthGovernanceSummary,
  WorkflowToolGovernanceSummary
} from "@/lib/get-workflows";
import {
  buildLegacyPublishAuthWorkflowHandoff,
  type LegacyPublishAuthWorkflowHandoff
} from "@/lib/legacy-publish-auth-governance-presenters";
import {
  formatCatalogGapToolSummary,
  formatWorkflowMissingToolSummary,
  hasWorkflowLegacyPublishAuthIssues,
  hasWorkflowMissingToolIssues
} from "@/lib/workflow-definition-governance";
import {
  appendWorkflowLibraryViewState,
  readWorkflowLibraryViewState,
  type WorkflowLibraryViewState
} from "@/lib/workflow-library-query";
import {
  DEFAULT_WORKSPACE_STARTER_LIBRARY_VIEW_STATE,
  readWorkspaceStarterLibraryViewState
} from "@/lib/workspace-starter-governance-query";
import type { WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot } from "@/lib/workflow-publish-types";
import { buildAuthorFacingWorkflowDetailLinkSurface } from "@/lib/workbench-entry-surfaces";

type WorkflowLegacyAuthGovernanceHandoffInput =
  | WorkflowLegacyAuthGovernanceSummary
  | WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot;

function buildSingleWorkflowLegacyAuthSnapshot({
  workflowId,
  workflowName,
  toolGovernance,
  legacyAuthGovernance
}: {
  workflowId: string;
  workflowName?: string | null;
  toolGovernance?: WorkflowToolGovernanceSummary | null;
  legacyAuthGovernance: WorkflowLegacyAuthGovernanceSummary;
}): WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot {
  return {
    generated_at: "",
    workflow_count: 1,
    binding_count: legacyAuthGovernance.binding_count,
    summary: {
      draft_candidate_count: legacyAuthGovernance.draft_candidate_count,
      published_blocker_count: legacyAuthGovernance.published_blocker_count,
      offline_inventory_count: legacyAuthGovernance.offline_inventory_count
    },
    checklist: [],
    workflows: [
      {
        workflow_id: workflowId,
        workflow_name: normalizeText(workflowName) ?? workflowId,
        binding_count: legacyAuthGovernance.binding_count,
        draft_candidate_count: legacyAuthGovernance.draft_candidate_count,
        published_blocker_count: legacyAuthGovernance.published_blocker_count,
        offline_inventory_count: legacyAuthGovernance.offline_inventory_count,
        tool_governance: toolGovernance ?? {
          referenced_tool_ids: [],
          missing_tool_ids: [],
          governed_tool_count: 0,
          strong_isolation_tool_count: 0
        }
      }
    ],
    buckets: {
      draft_candidates: [],
      published_blockers: [],
      offline_inventory: []
    }
  };
}

export type WorkflowGovernanceHandoff = {
  workflowId: string | null;
  workflowGovernanceHref: string | null;
  workflowCatalogGapHref: string | null;
  workflowCatalogGapSummary: string | null;
  workflowCatalogGapDetail: string | null;
  legacyAuthHandoff: LegacyPublishAuthWorkflowHandoff | null;
};

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildWorkflowGovernanceDetailHrefFromCurrentHref({
  workflowId,
  currentHref
}: {
  workflowId?: string | null;
  currentHref?: string | null;
}) {
  const resolvedWorkflowId = normalizeText(workflowId);

  if (!resolvedWorkflowId) {
    return null;
  }

  const fallbackHref = buildAuthorFacingWorkflowDetailLinkSurface({
    workflowId: resolvedWorkflowId,
    variant: "editor"
  }).href;
  const normalizedCurrentHref = normalizeText(currentHref);

  if (!normalizedCurrentHref) {
    return fallbackHref;
  }

  try {
    const currentUrl = new URL(normalizedCurrentHref, "https://7flows.local");
    const [, currentWorkflowId] = currentUrl.pathname.split("/").filter(Boolean);

    if (currentUrl.pathname.startsWith("/workflows/") && currentWorkflowId === resolvedWorkflowId) {
      const workspaceStarterViewState = readWorkspaceStarterLibraryViewState(currentUrl.searchParams);
      const scopedWorkflowSearchParams = new URLSearchParams();

      if (
        workspaceStarterViewState.activeTrack !==
        DEFAULT_WORKSPACE_STARTER_LIBRARY_VIEW_STATE.activeTrack
      ) {
        scopedWorkflowSearchParams.set("track", workspaceStarterViewState.activeTrack);
      }
      if (
        workspaceStarterViewState.sourceGovernanceKind !==
        DEFAULT_WORKSPACE_STARTER_LIBRARY_VIEW_STATE.sourceGovernanceKind
      ) {
        scopedWorkflowSearchParams.set(
          "source_governance_kind",
          workspaceStarterViewState.sourceGovernanceKind
        );
      }
      if (workspaceStarterViewState.needsFollowUp) {
        scopedWorkflowSearchParams.set("needs_follow_up", "true");
      }

      const normalizedSearchQuery = workspaceStarterViewState.searchQuery.trim();
      if (normalizedSearchQuery) {
        scopedWorkflowSearchParams.set("q", normalizedSearchQuery);
      }
      if (workspaceStarterViewState.selectedTemplateId) {
        scopedWorkflowSearchParams.set("starter", workspaceStarterViewState.selectedTemplateId);
      }

      scopedWorkflowSearchParams.sort();
      const scopedWorkflowQuery = scopedWorkflowSearchParams.toString();
      const workflowDetailHref = scopedWorkflowQuery
        ? `${fallbackHref}?${scopedWorkflowQuery}`
        : fallbackHref;

      return appendWorkflowLibraryViewState(
        workflowDetailHref,
        readWorkflowLibraryViewState(currentUrl.searchParams)
      );
    }
  } catch {
    return fallbackHref;
  }

  return fallbackHref;
}

function isLegacyAuthGovernanceSnapshot(
  legacyAuthGovernance: WorkflowLegacyAuthGovernanceHandoffInput | null | undefined
): legacyAuthGovernance is WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot {
  return Boolean(legacyAuthGovernance && "workflows" in legacyAuthGovernance);
}

function resolveWorkflowGovernanceDefinitionIssue({
  requestedDefinitionIssue,
  hasLegacyAuthIssues,
  hasMissingToolIssues
}: {
  requestedDefinitionIssue: WorkflowLibraryViewState["definitionIssue"];
  hasLegacyAuthIssues: boolean;
  hasMissingToolIssues: boolean;
}): WorkflowLibraryViewState["definitionIssue"] {
  const availableDefinitionIssues: NonNullable<WorkflowLibraryViewState["definitionIssue"]>[] = [];

  if (hasLegacyAuthIssues) {
    availableDefinitionIssues.push("legacy_publish_auth");
  }

  if (hasMissingToolIssues) {
    availableDefinitionIssues.push("missing_tool");
  }

  if (
    requestedDefinitionIssue &&
    availableDefinitionIssues.includes(requestedDefinitionIssue) &&
    !(requestedDefinitionIssue === "missing_tool" && hasLegacyAuthIssues)
  ) {
    return requestedDefinitionIssue;
  }

  return availableDefinitionIssues[0] ?? null;
}

export function buildWorkflowCatalogGapDetail({
  toolGovernance,
  subjectLabel,
  returnDetail
}: {
  toolGovernance?: WorkflowToolGovernanceSummary | null;
  subjectLabel: string;
  returnDetail: string;
}) {
  const workflowCatalogGapSummary = toolGovernance
    ? formatWorkflowMissingToolSummary({ tool_governance: toolGovernance })
    : null;
  const workflowCatalogGapToolCopy = formatCatalogGapToolSummary(
    toolGovernance?.missing_tool_ids ?? []
  );

  if (!workflowCatalogGapSummary) {
    return null;
  }

  const normalizedSubjectLabel = subjectLabel.trim();
  const renderedSubjectLabel = /^[这该此本]/.test(normalizedSubjectLabel)
    ? normalizedSubjectLabel
    : ` ${normalizedSubjectLabel}`;

  return workflowCatalogGapToolCopy
    ? `当前${renderedSubjectLabel} 对应的 workflow 版本仍有 catalog gap（${workflowCatalogGapToolCopy}）；${returnDetail}`
    : `当前${renderedSubjectLabel} 对应的 workflow 版本仍有 catalog gap；${returnDetail}`;
}

export function buildWorkflowGovernanceHandoff({
  workflowId,
  workflowName,
  workflowDetailHref,
  toolGovernance,
  legacyAuthGovernance,
  workflowCatalogGapDetail = null
}: {
  workflowId?: string | null;
  workflowName?: string | null;
  workflowDetailHref?: string | null;
  toolGovernance?: WorkflowToolGovernanceSummary | null;
  legacyAuthGovernance?: WorkflowLegacyAuthGovernanceHandoffInput | null;
  workflowCatalogGapDetail?: string | null;
}): WorkflowGovernanceHandoff {
  const normalizedWorkflowId = normalizeText(workflowId);
  const legacyAuthSnapshot = isLegacyAuthGovernanceSnapshot(legacyAuthGovernance)
    ? legacyAuthGovernance
    : legacyAuthGovernance && normalizedWorkflowId
      ? buildSingleWorkflowLegacyAuthSnapshot({
          workflowId: normalizedWorkflowId,
          workflowName,
          toolGovernance,
          legacyAuthGovernance
        })
      : null;
  const resolvedWorkflowId =
    normalizedWorkflowId ?? normalizeText(legacyAuthSnapshot?.workflows[0]?.workflow_id);
  const resolvedWorkflowDetailHref =
    normalizeText(workflowDetailHref) ??
    (resolvedWorkflowId
      ? buildAuthorFacingWorkflowDetailLinkSurface({
          workflowId: resolvedWorkflowId,
          variant: "editor"
        }).href
      : null);
  const workflowCatalogGapSummary = toolGovernance
    ? formatWorkflowMissingToolSummary({ tool_governance: toolGovernance })
    : null;
  const workflowLibraryWorkflow = {
    workflow_id: resolvedWorkflowId,
    definition_issues: [],
    tool_governance: toolGovernance ?? null,
    legacy_auth_governance: legacyAuthGovernance ?? null
  };
  const workflowLibraryViewState: WorkflowLibraryViewState = resolvedWorkflowDetailHref
    ? readWorkflowLibraryViewState(
        new URLSearchParams(resolvedWorkflowDetailHref.split("?")[1] ?? "")
      )
    : { definitionIssue: null };
  const hasLegacyAuthIssues = hasWorkflowLegacyPublishAuthIssues(workflowLibraryWorkflow);
  const hasMissingToolIssues = hasWorkflowMissingToolIssues(workflowLibraryWorkflow);
  const workflowGovernanceDefinitionIssue = resolveWorkflowGovernanceDefinitionIssue({
    requestedDefinitionIssue: workflowLibraryViewState.definitionIssue,
    hasLegacyAuthIssues,
    hasMissingToolIssues
  });
  const workflowGovernanceViewState: WorkflowLibraryViewState = {
    ...workflowLibraryViewState,
    definitionIssue: workflowGovernanceDefinitionIssue
  };
  const hasWorkflowGovernanceIssues =
    workflowGovernanceViewState.definitionIssue !== null;
  const workflowGovernanceHref = resolvedWorkflowDetailHref
    ? hasWorkflowGovernanceIssues
      ? appendWorkflowLibraryViewState(
          resolvedWorkflowDetailHref,
          workflowGovernanceViewState
        )
      : resolvedWorkflowDetailHref
    : null;
  const workflowCatalogGapHref =
    resolvedWorkflowDetailHref && workflowCatalogGapSummary
      ? appendWorkflowLibraryViewState(resolvedWorkflowDetailHref, {
          definitionIssue: "missing_tool"
        })
      : null;

  return {
    workflowId: resolvedWorkflowId,
    workflowGovernanceHref,
    workflowCatalogGapHref,
    workflowCatalogGapSummary,
    workflowCatalogGapDetail: workflowCatalogGapSummary ? workflowCatalogGapDetail : null,
    legacyAuthHandoff: resolvedWorkflowId
      ? buildLegacyPublishAuthWorkflowHandoff(legacyAuthSnapshot, resolvedWorkflowId)
      : null
  };
}
