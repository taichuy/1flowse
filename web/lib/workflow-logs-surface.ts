import type { WorkflowRunListItem } from "@/lib/get-workflow-runs";

export type WorkflowLogsSelectionSource = "latest" | "query" | "fallback";

export type WorkflowLogsSelection = {
  activeRun: WorkflowRunListItem | null;
  requestedRunId: string | null;
  selectionSource: WorkflowLogsSelectionSource;
  selectionNotice: string | null;
};

export function readWorkflowLogsRequestedRunId(
  rawValue: string | string[] | undefined
) {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

export function selectWorkflowLogsRun(
  runs: WorkflowRunListItem[],
  requestedRunId: string | null
): WorkflowLogsSelection {
  if (runs.length === 0) {
    return {
      activeRun: null,
      requestedRunId,
      selectionSource: "latest",
      selectionNotice: null
    };
  }

  if (!requestedRunId) {
    return {
      activeRun: runs[0],
      requestedRunId: null,
      selectionSource: "latest",
      selectionNotice: null
    };
  }

  const matchedRun = runs.find((run) => run.id === requestedRunId);
  if (matchedRun) {
    return {
      activeRun: matchedRun,
      requestedRunId,
      selectionSource: "query",
      selectionNotice: null
    };
  }

  return {
    activeRun: runs[0],
    requestedRunId,
    selectionSource: "fallback",
    selectionNotice:
      "请求的 run 不在当前 workflow recent runs 列表中，页面已回退到最新一条 run，避免伪造跨 workflow 的日志内容。"
  };
}
