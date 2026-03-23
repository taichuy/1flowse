import type { WorkflowDefinitionPreflightIssue, WorkflowListItem } from "@/lib/get-workflows";

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
