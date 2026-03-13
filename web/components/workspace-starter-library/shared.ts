import {
  getWorkspaceStarterBulkActionLabel
} from "@/components/workspace-starter-library/bulk-governance-card";
import type { WorkflowBusinessTrack } from "@/lib/workflow-business-tracks";
import type {
  WorkspaceStarterBulkAction,
  WorkspaceStarterBulkActionResult,
  WorkspaceStarterTemplateItem
} from "@/lib/get-workspace-starters";

export type TrackFilter = "all" | WorkflowBusinessTrack;
export type ArchiveFilter = "active" | "archived" | "all";

export type WorkspaceStarterFormState = {
  name: string;
  description: string;
  businessTrack: WorkflowBusinessTrack;
  defaultWorkflowName: string;
  workflowFocus: string;
  recommendedNextStep: string;
  tagsText: string;
};

export type WorkspaceStarterMessageTone = "idle" | "success" | "error";

export function buildFormState(
  template: WorkspaceStarterTemplateItem
): WorkspaceStarterFormState {
  return {
    name: template.name,
    description: template.description,
    businessTrack: template.business_track,
    defaultWorkflowName: template.default_workflow_name,
    workflowFocus: template.workflow_focus,
    recommendedNextStep: template.recommended_next_step,
    tagsText: template.tags.join(", ")
  };
}

export function buildUpdatePayload(formState: WorkspaceStarterFormState) {
  return {
    name: formState.name.trim(),
    description: formState.description.trim(),
    business_track: formState.businessTrack,
    default_workflow_name: formState.defaultWorkflowName.trim(),
    workflow_focus: formState.workflowFocus.trim(),
    recommended_next_step: formState.recommendedNextStep.trim(),
    tags: formState.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  };
}

export function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function buildBulkActionMessage(
  result: Pick<
    WorkspaceStarterBulkActionResult,
    "action" | "updated_count" | "skipped_count" | "deleted_items" | "skipped_reason_summary"
  >
) {
  const actionLabel = getWorkspaceStarterBulkActionLabel(result.action as WorkspaceStarterBulkAction);
  const deletedCount = result.deleted_items?.length ?? 0;
  const updatedPart =
    result.updated_count > 0 ? `已${actionLabel} ${result.updated_count} 个模板` : `没有模板被${actionLabel}`;
  const deletedPart = deletedCount > 0 ? `，删除 ${deletedCount} 个模板` : "";
  const skippedPart =
    result.skipped_count > 0
      ? `，跳过 ${result.skipped_count} 个模板${
          result.skipped_reason_summary?.length
            ? `（${result.skipped_reason_summary
                .map((item) => `${item.reason} ${item.count}`)
                .join(" / ")}）`
            : ""
        }`
      : "";

  return `${updatedPart}${deletedPart}${skippedPart}。`;
}
