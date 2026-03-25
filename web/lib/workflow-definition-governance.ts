import type { WorkflowDefinitionPreflightIssue, WorkflowListItem } from "@/lib/get-workflows";

type WorkflowMissingToolGovernanceLike = Pick<WorkflowListItem, "tool_governance">;

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

export function hasWorkflowLegacyPublishAuthIssues(
  workflow: Pick<WorkflowListItem, "definition_issues">
): boolean {
  return getWorkflowLegacyPublishAuthIssues(workflow).length > 0;
}

export function hasOnlyLegacyPublishAuthModeIssues(
  issues: WorkflowDefinitionPreflightIssue[]
): boolean {
  return issues.length > 0 && issues.every(isLegacyPublishAuthModeIssue);
}

export function getWorkflowMissingToolIds(
  workflow: WorkflowMissingToolGovernanceLike
): string[] {
  return Array.from(
    new Set(
      (workflow.tool_governance?.missing_tool_ids ?? [])
        .map((toolId) => normalizeString(toolId))
        .filter((toolId): toolId is string => toolId !== null)
    )
  );
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
  const missingToolIds = getWorkflowMissingToolIds(workflow);
  if (missingToolIds.length === 0) {
    return null;
  }

  if (missingToolIds.length <= maxVisibleToolIds) {
    return `catalog gap · ${missingToolIds.join("、")}`;
  }

  return `catalog gap · ${missingToolIds
    .slice(0, maxVisibleToolIds)
    .join("、")} 等 ${missingToolIds.length} 个 tool`;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
