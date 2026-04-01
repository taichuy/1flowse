import type {
  PublishedEndpointInvocationListResponse,
  WorkflowPublishedEndpointItem
} from "@/lib/get-workflow-publish";
import type { WorkflowRunListItem } from "@/lib/get-workflow-runs";

export type WorkflowLogsSelectionSource = "latest" | "query" | "fallback";

type WorkflowLogsInvocationBindingLike = Pick<WorkflowPublishedEndpointItem, "id">;

export type WorkflowLogsInvocationSelection = {
  activeBindingId: string | null;
  selectedInvocationId: string | null;
  selectionSource: WorkflowLogsSelectionSource;
  selectionNotice: string | null;
};

function normalizeRequestedValue(rawValue: string | null | undefined) {
  const normalizedValue = rawValue?.trim();
  return normalizedValue ? normalizedValue : null;
}

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
  return normalizeRequestedValue(value);
}

export function selectWorkflowLogsInvocation(
  bindings: WorkflowLogsInvocationBindingLike[],
  invocationAuditsByBinding: Record<string, PublishedEndpointInvocationListResponse | null>,
  requestedBindingId: string | null,
  requestedInvocationId: string | null
): WorkflowLogsInvocationSelection {
  const normalizedRequestedBindingId = normalizeRequestedValue(requestedBindingId);
  const normalizedRequestedInvocationId = normalizeRequestedValue(requestedInvocationId);
  const bindingIds = new Set(bindings.map((binding) => binding.id));
  const bindingContainingRequestedInvocation = normalizedRequestedInvocationId
    ? bindings.find((binding) =>
        (invocationAuditsByBinding[binding.id]?.items ?? []).some(
          (item) => item.id === normalizedRequestedInvocationId
        )
      ) ?? null
    : null;
  const defaultBinding =
    bindings.find((binding) => (invocationAuditsByBinding[binding.id]?.items.length ?? 0) > 0) ??
    bindings[0] ??
    null;
  const notices: string[] = [];

  let activeBindingId =
    normalizedRequestedBindingId && bindingIds.has(normalizedRequestedBindingId)
      ? normalizedRequestedBindingId
      : bindingContainingRequestedInvocation?.id ?? defaultBinding?.id ?? null;
  let selectionSource: WorkflowLogsSelectionSource =
    normalizedRequestedBindingId || normalizedRequestedInvocationId ? "query" : "latest";

  if (normalizedRequestedBindingId && !bindingIds.has(normalizedRequestedBindingId)) {
    selectionSource = "fallback";
    notices.push(
      "请求的 published binding 不在当前 workflow 已发布端点中，页面已回退到可用的 workflow-scoped invocation 列表。"
    );
  }

  if (!activeBindingId) {
    return {
      activeBindingId: null,
      selectedInvocationId: null,
      selectionSource,
      selectionNotice: notices.join(" ") || null
    };
  }

  const activeItems = invocationAuditsByBinding[activeBindingId]?.items ?? [];
  if (!normalizedRequestedInvocationId) {
    return {
      activeBindingId,
      selectedInvocationId: activeItems[0]?.id ?? null,
      selectionSource,
      selectionNotice: notices.join(" ") || null
    };
  }

  if (activeItems.some((item) => item.id === normalizedRequestedInvocationId)) {
    return {
      activeBindingId,
      selectedInvocationId: normalizedRequestedInvocationId,
      selectionSource,
      selectionNotice: notices.join(" ") || null
    };
  }

  selectionSource = "fallback";
  notices.push(
    normalizedRequestedBindingId
      ? "请求的 invocation 不在当前 binding 的 recent invocation 列表中，页面已回退到该 binding 的最新一条记录，避免误读跨 binding 日志事实。"
      : "请求的 invocation 不在当前 workflow recent invocation 列表中，页面已回退到最新一条 published invocation。"
  );

  return {
    activeBindingId,
    selectedInvocationId: activeItems[0]?.id ?? null,
    selectionSource,
    selectionNotice: notices.join(" ") || null
  };
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
