import type {
  WorkflowDefinitionPreflightIssue,
  WorkflowListItem
} from "@/lib/get-workflows";
import type { WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot } from "@/lib/workflow-publish-types";

type WorkflowLegacyAuthGovernanceSummaryLike = NonNullable<
  WorkflowListItem["legacy_auth_governance"]
>;
type WorkflowLegacyAuthGovernanceSnapshotLike = WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot;
type WorkflowLegacyAuthGovernanceValueLike =
  | WorkflowLegacyAuthGovernanceSummaryLike
  | WorkflowLegacyAuthGovernanceSnapshotLike;
type WorkflowLegacyAuthGovernanceLike = {
  definition_issues?: WorkflowDefinitionPreflightIssue[];
  legacy_auth_governance?: WorkflowLegacyAuthGovernanceValueLike | null;
};
type WorkflowMissingToolGovernanceLike = {
  tool_governance?: WorkflowListItem["tool_governance"] | null;
};
export type WorkflowLibraryGovernanceLike = WorkflowLegacyAuthGovernanceLike &
  WorkflowMissingToolGovernanceLike;
type WorkflowToolReferenceIssueLike = Pick<WorkflowDefinitionPreflightIssue, "message">;

function readLegacyAuthGovernanceCounts(
  legacyAuthGovernance: WorkflowLegacyAuthGovernanceValueLike | null | undefined
) {
  if (!legacyAuthGovernance) {
    return null;
  }

  if ("summary" in legacyAuthGovernance) {
    return {
      bindingCount: legacyAuthGovernance.binding_count,
      draftCandidateCount: legacyAuthGovernance.summary.draft_candidate_count,
      publishedBlockerCount: legacyAuthGovernance.summary.published_blocker_count,
      offlineInventoryCount: legacyAuthGovernance.summary.offline_inventory_count
    };
  }

  return {
    bindingCount: legacyAuthGovernance.binding_count,
    draftCandidateCount: legacyAuthGovernance.draft_candidate_count,
    publishedBlockerCount: legacyAuthGovernance.published_blocker_count,
    offlineInventoryCount: legacyAuthGovernance.offline_inventory_count
  };
}

export function isLegacyPublishAuthModeIssue(
  issue: WorkflowDefinitionPreflightIssue
): boolean {
  return issue.category === "publish_draft" && issue.field === "authMode";
}

export function getWorkflowLegacyPublishAuthIssues(
  workflow: Pick<WorkflowListItem, "definition_issues">
): WorkflowDefinitionPreflightIssue[] {
  return (workflow.definition_issues ?? []).filter(isLegacyPublishAuthModeIssue);
}

export function getWorkflowLegacyPublishAuthBacklogCount(
  workflow: WorkflowLegacyAuthGovernanceLike
): number {
  const legacyAuthGovernance = readLegacyAuthGovernanceCounts(
    workflow.legacy_auth_governance
  );

  if (legacyAuthGovernance && legacyAuthGovernance.bindingCount > 0) {
    return legacyAuthGovernance.bindingCount;
  }

  return getWorkflowLegacyPublishAuthIssues(workflow).length;
}

export function getWorkflowLegacyPublishAuthStatusLabel(
  workflow: WorkflowLegacyAuthGovernanceLike
): "publish auth blocker" | "legacy auth cleanup" | null {
  if (getWorkflowLegacyPublishAuthBacklogCount(workflow) <= 0) {
    return null;
  }

  return (readLegacyAuthGovernanceCounts(workflow.legacy_auth_governance)?.publishedBlockerCount ?? 0) >
    0
    ? "publish auth blocker"
    : "legacy auth cleanup";
}

export function formatWorkflowLegacyPublishAuthBacklogSummary(
  workflow: WorkflowLegacyAuthGovernanceLike
): string | null {
  const legacyAuthGovernance = readLegacyAuthGovernanceCounts(
    workflow.legacy_auth_governance
  );

  if (legacyAuthGovernance && legacyAuthGovernance.bindingCount > 0) {
    const summaryParts = [
      `${legacyAuthGovernance.draftCandidateCount} 条 draft cleanup`,
      `${legacyAuthGovernance.publishedBlockerCount} 条 published blocker`,
      `${legacyAuthGovernance.offlineInventoryCount} 条 offline inventory`
    ].filter((value): value is string => Boolean(value));

    return summaryParts.join("、");
  }

  const publishDraftIssueCount = getWorkflowLegacyPublishAuthIssues(workflow).length;
  return publishDraftIssueCount > 0 ? `${publishDraftIssueCount} 个 publish draft` : null;
}

export function hasWorkflowLegacyPublishAuthIssues(
  workflow: WorkflowLegacyAuthGovernanceLike
): boolean {
  return getWorkflowLegacyPublishAuthBacklogCount(workflow) > 0;
}

export function hasOnlyLegacyPublishAuthModeIssues(
  issues: WorkflowDefinitionPreflightIssue[]
): boolean {
  return issues.length > 0 && issues.every(isLegacyPublishAuthModeIssue);
}

export function getWorkflowMissingToolIds(
  workflow: WorkflowMissingToolGovernanceLike
): string[] {
  return normalizeCatalogGapToolIds(workflow.tool_governance?.missing_tool_ids ?? []);
}

export function hasWorkflowMissingToolIssues(
  workflow: WorkflowMissingToolGovernanceLike
): boolean {
  return getWorkflowMissingToolIds(workflow).length > 0;
}

export function formatWorkflowMissingToolSummary(
  workflow: WorkflowMissingToolGovernanceLike,
  maxVisibleToolIds = 2
): string | null {
  return formatCatalogGapSummary(getWorkflowMissingToolIds(workflow), maxVisibleToolIds);
}

export function formatCatalogGapToolSummary(
  toolIds: readonly unknown[],
  maxVisibleToolIds = 2
): string | null {
  const normalizedToolIds = normalizeCatalogGapToolIds(toolIds);
  if (normalizedToolIds.length === 0) {
    return null;
  }

  if (normalizedToolIds.length <= maxVisibleToolIds) {
    return normalizedToolIds.join("、");
  }

  return `${normalizedToolIds.slice(0, maxVisibleToolIds).join("、")} 等 ${normalizedToolIds.length} 个 tool`;
}

export function formatCatalogGapSummary(
  toolIds: readonly unknown[],
  maxVisibleToolIds = 2
): string | null {
  const toolSummary = formatCatalogGapToolSummary(toolIds, maxVisibleToolIds);
  return toolSummary ? `catalog gap · ${toolSummary}` : null;
}

export function formatCatalogGapResourceSummary(
  resourceLabel: string,
  toolIds: readonly unknown[],
  maxVisibleToolIds = 2
): string | null {
  const catalogGapSummary = formatCatalogGapSummary(toolIds, maxVisibleToolIds);
  return catalogGapSummary ? `${resourceLabel} · ${catalogGapSummary}` : null;
}

export function getToolReferenceMissingToolIds(
  issues: readonly WorkflowToolReferenceIssueLike[]
): string[] {
  const missingToolIds = issues.flatMap((issue) => {
    const singleToolMatch = issue.message.match(/missing catalog tool '([^']+)'/i);
    if (singleToolMatch?.[1]) {
      return [singleToolMatch[1]];
    }

    const multiToolMatch = issue.message.match(/missing catalog tools:\s+(.+?)\.?$/i);
    if (!multiToolMatch?.[1]) {
      return [];
    }

    return multiToolMatch[1]
      .split(",")
      .map((toolId) => toolId.trim().replace(/\.$/, ""))
      .filter(Boolean);
  });

  return normalizeCatalogGapToolIds(missingToolIds);
}

export function formatToolReferenceIssueSummary(
  issues: readonly WorkflowToolReferenceIssueLike[],
  options?: { maxVisibleToolIds?: number }
): string | null {
  const missingToolIds = getToolReferenceMissingToolIds(issues);
  if (missingToolIds.length > 0) {
    return formatCatalogGapSummary(missingToolIds, options?.maxVisibleToolIds);
  }

  const firstMessage = issues[0]?.message?.trim();
  return firstMessage ? `tool catalog reference：${firstMessage}` : null;
}

function normalizeCatalogGapToolIds(toolIds: readonly unknown[]): string[] {
  return [...new Set(toolIds.map((toolId) => String(toolId).trim()).filter(Boolean))];
}
