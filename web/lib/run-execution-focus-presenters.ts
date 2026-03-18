import type {
  RunCallbackTicketItem,
  RunExecutionFocusReason,
  RunExecutionNodeItem
} from "@/lib/get-run-views";

type ExecutionFocusExplainableNode = Pick<
  RunExecutionNodeItem,
  | "execution_blocking_reason"
  | "execution_fallback_reason"
  | "execution_blocked_count"
  | "execution_unavailable_count"
  | "waiting_reason"
  | "scheduled_resume_delay_seconds"
  | "scheduled_resume_due_at"
  | "callback_tickets"
  | "sensitive_access_entries"
>;

export function formatMetricSummary(metrics: Record<string, number>) {
  return Object.entries(metrics)
    .map(([key, count]) => `${key} ${count}`)
    .join(" · ");
}

export function formatExecutionFocusReasonLabel(
  reason: RunExecutionFocusReason | null | undefined
) {
  switch (reason) {
    case "blocking_node_run":
      return "blocking node run";
    case "blocked_execution":
      return "blocked execution";
    case "current_node":
      return "current node";
    case "fallback_node":
      return "execution fallback";
    default:
      return "execution focus";
  }
}

function countPendingCallbackTickets(callbackTickets: RunCallbackTicketItem[]) {
  return callbackTickets.filter((ticket) => ticket.status === "pending").length;
}

function countPendingApprovalTickets(node: ExecutionFocusExplainableNode) {
  return node.sensitive_access_entries.filter((entry) => entry.approval_ticket?.status === "pending")
    .length;
}

export function formatExecutionFocusPrimarySignal(node: ExecutionFocusExplainableNode): string | null {
  if (node.execution_blocking_reason) {
    return `执行阻断：${node.execution_blocking_reason}`;
  }
  if (node.waiting_reason) {
    return `等待原因：${node.waiting_reason}`;
  }
  if (node.execution_fallback_reason) {
    return `执行降级：${node.execution_fallback_reason}`;
  }
  if (node.execution_unavailable_count > 0) {
    return `当前节点记录了 ${node.execution_unavailable_count} 次 execution unavailable。`;
  }
  if (node.execution_blocked_count > 0) {
    return `当前节点记录了 ${node.execution_blocked_count} 次 execution blocked。`;
  }
  return null;
}

export function formatExecutionFocusFollowUp(node: ExecutionFocusExplainableNode): string | null {
  const pendingApprovalCount = countPendingApprovalTickets(node);
  if (pendingApprovalCount > 0) {
    return pendingApprovalCount === 1
      ? "下一步：优先处理这条 sensitive access 审批票据，再观察 waiting 节点是否恢复。"
      : `下一步：当前有 ${pendingApprovalCount} 条 sensitive access 审批仍待处理，优先清掉审批阻塞。`;
  }

  const pendingCallbackTicketCount = countPendingCallbackTickets(node.callback_tickets);
  if (pendingCallbackTicketCount > 0) {
    return pendingCallbackTicketCount === 1
      ? "下一步：优先确认 callback ticket 是否已回调；若尚未回调，继续沿 ticket / inbox 事实链跟进。"
      : `下一步：当前有 ${pendingCallbackTicketCount} 条 callback ticket 仍待回调，优先沿 ticket / inbox 事实链排查。`;
  }

  if (typeof node.scheduled_resume_delay_seconds === "number") {
    const dueCopy = node.scheduled_resume_due_at
      ? `，预计在 ${node.scheduled_resume_due_at} 左右触发`
      : "";
    return `下一步：当前节点已安排自动 resume（${node.scheduled_resume_delay_seconds}s）${dueCopy}，优先观察调度补偿是否恢复。`;
  }

  if (node.execution_blocking_reason || node.execution_unavailable_count > 0) {
    return "下一步：优先核对 execution class、sandbox backend readiness 和 tool governance 是否匹配。";
  }

  if (node.waiting_reason) {
    return "下一步：优先沿 waiting / callback 事实链排查，不要只盯单次 invocation 返回。";
  }

  if (node.execution_fallback_reason) {
    return "下一步：确认 fallback 是否可接受；若不可接受，再回到原始 execution backend / capability 做治理。";
  }

  return null;
}
