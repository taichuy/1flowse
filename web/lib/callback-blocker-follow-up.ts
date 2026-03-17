import {
  getCallbackWaitingRecommendedAction,
  listCallbackWaitingOperatorStatuses,
  type CallbackWaitingOperatorStatus,
  type CallbackWaitingRecommendedAction
} from "@/lib/callback-waiting-presenters";
import { getRunExecutionView, type RunExecutionNodeItem } from "@/lib/get-run-views";

export type CallbackBlockerSnapshot = {
  nodeRunId?: string | null;
  operatorStatuses: CallbackWaitingOperatorStatus[];
  recommendedAction?: CallbackWaitingRecommendedAction | null;
};

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" ");
}

function hasCallbackSignals(node: RunExecutionNodeItem) {
  return Boolean(
    node.waiting_reason ||
      node.callback_waiting_lifecycle ||
      node.callback_tickets.length > 0 ||
      node.sensitive_access_entries.length > 0
  );
}

function pickCallbackNode(
  nodes: RunExecutionNodeItem[],
  nodeRunId?: string | null
): RunExecutionNodeItem | null {
  const normalizedNodeRunId = nodeRunId?.trim() || null;
  if (normalizedNodeRunId) {
    return nodes.find((node) => node.node_run_id === normalizedNodeRunId) ?? null;
  }

  return (
    nodes.find((node) => node.status === "waiting_callback") ??
    nodes.find((node) => node.phase === "waiting_callback") ??
    nodes.find((node) => hasCallbackSignals(node)) ??
    null
  );
}

function formatLabels(statuses: CallbackWaitingOperatorStatus[]) {
  return statuses.map((status) => status.label).join("、");
}

export async function fetchCallbackBlockerSnapshot({
  runId,
  nodeRunId
}: {
  runId?: string | null;
  nodeRunId?: string | null;
}): Promise<CallbackBlockerSnapshot | null> {
  const normalizedRunId = runId?.trim();
  if (!normalizedRunId) {
    return null;
  }

  const executionView = await getRunExecutionView(normalizedRunId);
  if (!executionView) {
    return null;
  }

  const node = pickCallbackNode(executionView.nodes, nodeRunId);
  if (!node) {
    return null;
  }

  const operatorStatuses = listCallbackWaitingOperatorStatuses({
    lifecycle: node.callback_waiting_lifecycle,
    callbackTickets: node.callback_tickets,
    sensitiveAccessEntries: node.sensitive_access_entries
  });

  return {
    nodeRunId: node.node_run_id,
    operatorStatuses,
    recommendedAction: getCallbackWaitingRecommendedAction({
      lifecycle: node.callback_waiting_lifecycle,
      callbackTickets: node.callback_tickets,
      sensitiveAccessEntries: node.sensitive_access_entries
    })
  };
}

export function formatCallbackBlockerDeltaSummary({
  before,
  after
}: {
  before?: CallbackBlockerSnapshot | null;
  after?: CallbackBlockerSnapshot | null;
}): string | null {
  if (!before && !after) {
    return null;
  }

  const beforeStatuses = before?.operatorStatuses ?? [];
  const afterStatuses = after?.operatorStatuses ?? [];
  const afterKinds = new Set(afterStatuses.map((status) => status.kind));
  const beforeKinds = new Set(beforeStatuses.map((status) => status.kind));

  const clearedStatuses = beforeStatuses.filter((status) => !afterKinds.has(status.kind));
  const addedStatuses = afterStatuses.filter((status) => !beforeKinds.has(status.kind));
  const beforeActionLabel = before?.recommendedAction?.label?.trim() || null;
  const afterActionLabel = after?.recommendedAction?.label?.trim() || null;

  return joinParts([
    clearedStatuses.length > 0
      ? `阻塞变化：已解除 ${formatLabels(clearedStatuses)}。`
      : null,
    addedStatuses.length > 0 ? `新增 ${formatLabels(addedStatuses)}。` : null,
    clearedStatuses.length === 0 && addedStatuses.length === 0 && afterStatuses.length > 0
      ? `阻塞变化：当前仍是 ${formatLabels(afterStatuses)}。`
      : null,
    after && afterStatuses.length === 0
      ? "阻塞变化：当前 callback summary 已没有显式 operator blocker。"
      : null,
    !after && before
      ? "动作后暂未读到最新 blocker 快照，请刷新当前页确认阻塞是否真正减少。"
      : null,
    after && beforeActionLabel !== afterActionLabel && afterActionLabel
      ? `建议动作已切换为“${afterActionLabel}”。`
      : null,
    after && beforeActionLabel !== afterActionLabel && !afterActionLabel && beforeActionLabel
      ? "建议动作已清空；下一步应结合最新 run 状态确认是否真正离开 waiting。"
      : null,
    after && beforeActionLabel === afterActionLabel && afterActionLabel
      ? `建议动作仍是“${afterActionLabel}”。`
      : null
  ]);
}
