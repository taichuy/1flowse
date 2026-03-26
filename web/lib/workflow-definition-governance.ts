import type { WorkflowDefinitionPreflightIssue, WorkflowListItem } from "@/lib/get-workflows";

type WorkflowLegacyAuthGovernanceLike = Pick<
  WorkflowListItem,
  "definition_issues" | "legacy_auth_governance"
>;
type WorkflowMissingToolGovernanceLike = {
  tool_governance?: WorkflowListItem["tool_governance"] | null;
};
type WorkflowToolReferenceIssueLike = Pick<WorkflowDefinitionPreflightIssue, "message">;

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

export function getWorkflowLegacyPublishAuthBlockerCount(
  workflow: WorkflowLegacyAuthGovernanceLike
): number {
  const legacyAuthGovernance = workflow.legacy_auth_governance;
  const publishDraftIssueCount = getWorkflowLegacyPublishAuthIssues(workflow).length;

  return publishDraftIssueCount + (legacyAuthGovernance?.binding_count ?? 0);
}

export function formatWorkflowLegacyPublishAuthBacklogSummary(
  workflow: WorkflowLegacyAuthGovernanceLike
): string | null {
  const legacyAuthGovernance = workflow.legacy_auth_governance;
  const publishDraftIssueCount = getWorkflowLegacyPublishAuthIssues(workflow).length;

  if (legacyAuthGovernance && legacyAuthGovernance.binding_count > 0) {
    const summaryParts = [
      publishDraftIssueCount > 0 ? `${publishDraftIssueCount} 个当前 publish draft` : null,
      `${legacyAuthGovernance.draft_candidate_count} 条 draft cleanup`,
      `${legacyAuthGovernance.published_blocker_count} 条 published blocker`,
      `${legacyAuthGovernance.offline_inventory_count} 条 offline inventory`
    ].filter((value): value is string => Boolean(value));

    return summaryParts.join("、");
  }

  return publishDraftIssueCount > 0 ? `${publishDraftIssueCount} 个 publish draft` : null;
}

export function hasWorkflowLegacyPublishAuthIssues(
  workflow: WorkflowLegacyAuthGovernanceLike
): boolean {
  return getWorkflowLegacyPublishAuthBlockerCount(workflow) > 0;
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
  resourceLabel: string | null | undefined,
  toolIds: readonly unknown[],
  maxVisibleToolIds = 2
): string | null {
  const normalizedResourceLabel = normalizeString(resourceLabel);
  const catalogGapSummary = formatCatalogGapSummary(toolIds, maxVisibleToolIds);
  const summaryParts = [normalizedResourceLabel, catalogGapSummary].filter(
    (value): value is string => Boolean(value)
  );

  return summaryParts.length > 0 ? summaryParts.join(" · ") : null;
}

export function getToolReferenceMissingToolIds(
  issues: readonly WorkflowToolReferenceIssueLike[]
): string[] {
  return normalizeCatalogGapToolIds(
    issues.flatMap((issue) => extractToolReferenceMissingToolIds(issue.message))
  );
}

export function formatToolReferenceIssueSummary(
  issues: readonly WorkflowToolReferenceIssueLike[],
  {
    fallbackLabel = "tool catalog reference",
    maxVisibleToolIds = 2
  }: {
    fallbackLabel?: string;
    maxVisibleToolIds?: number;
  } = {}
): string | null {
  if (issues.length === 0) {
    return null;
  }

  const catalogGapSummary = formatCatalogGapSummary(
    getToolReferenceMissingToolIds(issues),
    maxVisibleToolIds
  );
  if (catalogGapSummary) {
    return catalogGapSummary;
  }

  const descriptions = Array.from(
    new Set(
      issues
        .map((issue) => normalizeString(issue.message))
        .filter((message): message is string => message !== null)
    )
  );
  if (descriptions.length === 0) {
    return fallbackLabel;
  }

  const visibleDescriptions = descriptions.slice(0, 2);
  const suffix =
    descriptions.length > visibleDescriptions.length
      ? `；另有 ${descriptions.length - visibleDescriptions.length} 项同类问题`
      : "";
  return `${fallbackLabel}：${visibleDescriptions.join("；")}${suffix}`;
}

function normalizeCatalogGapToolIds(toolIds: readonly unknown[]): string[] {
  return Array.from(
    new Set(
      toolIds
        .map((toolId) => normalizeString(toolId))
        .filter((toolId): toolId is string => toolId !== null)
    )
  );
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractToolReferenceMissingToolIds(message: string): string[] {
  const normalizedMessage = normalizeString(message);
  if (!normalizedMessage) {
    return [];
  }

  const capturedToolIds = Array.from(
    normalizedMessage.matchAll(/missing catalog tool '([^']+)'/g),
    (match) => match[1]
  );

  const multipleToolMatches = Array.from(
    normalizedMessage.matchAll(/missing catalog tools:\s*(.+?)(?:\.$|$)/g),
    (match) => match[1]
  );
  multipleToolMatches.forEach((renderedToolIds) => {
    capturedToolIds.push(...splitToolReferenceToolIds(renderedToolIds));
  });

  const localizedMatches = Array.from(
    normalizedMessage.matchAll(/不存在的工具[:：]?\s*([^。]+)/g),
    (match) => match[1]
  );
  localizedMatches.forEach((renderedToolIds) => {
    capturedToolIds.push(...splitToolReferenceToolIds(renderedToolIds));
  });

  return capturedToolIds;
}

function splitToolReferenceToolIds(renderedToolIds: string): string[] {
  return renderedToolIds
    .split(/[，,、]/)
    .map((toolId) => normalizeString(toolId.replace(/[.。]$/, "")))
    .filter((toolId): toolId is string => toolId !== null);
}
