import type { RunExecutionNodeItem, RunExecutionView } from "@/lib/get-run-views";

export function countPendingApprovals(node: RunExecutionNodeItem): number {
  return node.sensitive_access_entries.filter((entry) => entry.approval_ticket?.status === "pending")
    .length;
}

export function countPendingTickets(node: RunExecutionNodeItem): number {
  return node.callback_tickets.filter((ticket) => ticket.status === "pending").length;
}

export function hasScheduledResume(node: RunExecutionNodeItem): boolean {
  return typeof node.scheduled_resume_delay_seconds === "number";
}

export function hasExecutionBlockingSignal(node: RunExecutionNodeItem): boolean {
  return Boolean(node.execution_blocking_reason) ||
    node.execution_unavailable_count > 0 ||
    node.execution_blocked_count > 0;
}

export function hasPriorityBlockerContext(node: RunExecutionNodeItem): boolean {
  return countPendingApprovals(node) > 0 ||
    countPendingTickets(node) > 0 ||
    hasScheduledResume(node) ||
    node.callback_tickets.length > 0 ||
    node.sensitive_access_entries.length > 0 ||
    Boolean(node.waiting_reason) ||
    hasExecutionBlockingSignal(node) ||
    Boolean(node.execution_fallback_reason);
}

function getNodePriorityScore(node: RunExecutionNodeItem): number {
  const pendingApprovals = countPendingApprovals(node);
  const pendingTickets = countPendingTickets(node);
  const lifecycle = node.callback_waiting_lifecycle;

  let score = 0;
  score += pendingApprovals * 100;
  score += pendingTickets * 80;
  score += (lifecycle?.expired_ticket_count ?? 0) * 20;
  score += (lifecycle?.late_callback_count ?? 0) * 15;
  score += node.execution_unavailable_count * 18;
  score += node.execution_blocked_count * 15;
  score += node.callback_tickets.length * 5;
  score += node.sensitive_access_entries.length * 3;
  if (node.execution_blocking_reason) {
    score += 70;
  }
  if (node.execution_fallback_reason) {
    score += 8;
  }
  if (node.waiting_reason) {
    score += 10;
  }
  if (node.status.includes("waiting")) {
    score += 10;
  }
  if (hasScheduledResume(node)) {
    score -= 20;
  }
  if (lifecycle?.terminated) {
    score -= 25;
  }
  return score;
}

export function pickTopBlockerNodes(
  executionView: RunExecutionView,
  limit = 3
): RunExecutionNodeItem[] {
  return executionView.nodes
    .filter((node) => hasPriorityBlockerContext(node))
    .sort((left, right) => getNodePriorityScore(right) - getNodePriorityScore(left))
    .slice(0, limit);
}
