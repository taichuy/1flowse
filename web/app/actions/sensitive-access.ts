"use server";

import { revalidatePath } from "next/cache";

import { getApiBaseUrl } from "@/lib/api-base-url";
import type {
  SensitiveAccessBulkAction,
  SensitiveAccessBulkActionResult,
  SensitiveAccessBulkSkipSummary
} from "@/lib/get-sensitive-access";
import {
  formatBulkApprovalDecisionResultMessage,
  formatBulkNotificationRetryResultMessage,
  formatApprovalDecisionResultMessage,
  formatNotificationRetryResultMessage,
  summarizeBulkRunFollowUp
} from "@/lib/operator-action-result-presenters";

import { fetchRunSnapshot, fetchRunSnapshots } from "./run-snapshot";

export type DecideSensitiveAccessApprovalTicketState = {
  status: "idle" | "success" | "error";
  message: string;
  ticketId: string;
};

export type RetrySensitiveAccessNotificationDispatchState = {
  status: "idle" | "success" | "error";
  message: string;
  dispatchId: string;
  target: string;
};

type ApprovalDecisionResponseBody = {
  detail?: string;
  request?: {
    decision_label?: string | null;
    reason_label?: string | null;
    policy_summary?: string | null;
  };
  approval_ticket?: {
    waiting_status?: "waiting" | "resumed" | "failed";
  };
};

type NotificationRetryResponseBody = {
  detail?: string;
  approval_ticket?: {
    waiting_status?: "waiting" | "resumed" | "failed";
  };
  notification?: {
    status?: "pending" | "delivered" | "failed";
    error?: string | null;
    target?: string | null;
  };
};

type ApprovalTicketBulkDecisionResponseBody = {
  requested_count: number;
  decided_count: number;
  skipped_count: number;
  decided_items: Array<{
    id: string;
    run_id?: string | null;
  }>;
  skipped_reason_summary: SensitiveAccessBulkSkipSummary[];
};

type NotificationDispatchBulkRetryResponseBody = {
  requested_count: number;
  retried_count: number;
  skipped_count: number;
  retried_items: Array<{
    approval_ticket: {
      id: string;
      run_id?: string | null;
    };
  }>;
  skipped_reason_summary: SensitiveAccessBulkSkipSummary[];
};

function buildBulkSkipSummaryMessage(summary: SensitiveAccessBulkSkipSummary[]) {
  if (summary.length === 0) {
    return null;
  }

  return `跳过原因：${summary.map((item) => `${item.reason} ${item.count}`).join("、")}。`;
}

function createEmptyBulkResultMetrics() {
  return {
    affectedRunCount: 0,
    sampledRunCount: 0,
    waitingRunCount: 0,
    runningRunCount: 0,
    succeededRunCount: 0,
    failedRunCount: 0,
    unknownRunCount: 0
  };
}

async function buildBulkRunFollowUpMetrics(runIds: Array<string | null | undefined>) {
  const normalizedRunIds = [...new Set(runIds.map((item) => item?.trim()).filter(Boolean))];
  const sampledRuns = await fetchRunSnapshots(normalizedRunIds);
  const followUpSummary = summarizeBulkRunFollowUp({
    affectedRunCount: normalizedRunIds.length,
    sampledRuns
  });

  return {
    sampledRuns,
    followUpSummary
  };
}

function revalidateSensitiveAccessPaths(runIds: Array<string | null | undefined>) {
  revalidatePath("/");
  revalidatePath("/sensitive-access");

  const uniqueRunIds = [...new Set(runIds.map((item) => item?.trim()).filter(Boolean))];
  for (const runId of uniqueRunIds) {
    revalidatePath(`/runs/${runId}`);
  }
}

export async function decideSensitiveAccessApprovalTicket(
  _: DecideSensitiveAccessApprovalTicketState,
  formData: FormData
): Promise<DecideSensitiveAccessApprovalTicketState> {
  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const runId = String(formData.get("runId") ?? "").trim();
  const decision = String(formData.get("status") ?? "").trim();
  const approvedBy = String(formData.get("approvedBy") ?? "").trim();

  if (!ticketId || (decision !== "approved" && decision !== "rejected") || !approvedBy) {
    return {
      status: "error",
      message: "缺少审批决策所需信息。",
      ticketId
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/sensitive-access/approval-tickets/${encodeURIComponent(ticketId)}/decision`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: decision,
          approved_by: approvedBy
        }),
        cache: "no-store"
      }
    );

    const body = (await response.json().catch(() => null)) as ApprovalDecisionResponseBody | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? "审批决策失败。",
        ticketId
      };
    }

    revalidateSensitiveAccessPaths([runId]);
    const runSnapshot = await fetchRunSnapshot(runId);

    return {
      status: "success",
      message: formatApprovalDecisionResultMessage(decision as "approved" | "rejected", {
        waitingStatus: body?.approval_ticket?.waiting_status,
        decisionLabel: body?.request?.decision_label,
        reasonLabel: body?.request?.reason_label,
        policySummary: body?.request?.policy_summary,
        runSnapshot
      }),
      ticketId
    };
  } catch {
    return {
      status: "error",
      message: "无法连接后端提交审批决策。",
      ticketId
    };
  }
}

export async function retrySensitiveAccessNotificationDispatch(
  _: RetrySensitiveAccessNotificationDispatchState,
  formData: FormData
): Promise<RetrySensitiveAccessNotificationDispatchState> {
  const dispatchId = String(formData.get("dispatchId") ?? "").trim();
  const runId = String(formData.get("runId") ?? "").trim();
  const target = String(formData.get("target") ?? "").trim();

  if (!dispatchId) {
    return {
      status: "error",
      message: "缺少通知重试所需的 dispatch 标识。",
      dispatchId,
      target
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/sensitive-access/notification-dispatches/${encodeURIComponent(dispatchId)}/retry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target: target || null
        }),
        cache: "no-store"
      }
    );

    const body = (await response.json().catch(() => null)) as NotificationRetryResponseBody | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? "通知重试失败。",
        dispatchId,
        target
      };
    }

    revalidateSensitiveAccessPaths([runId]);
    const runSnapshot = await fetchRunSnapshot(runId);
    const effectiveTarget =
      typeof body?.notification?.target === "string" && body.notification.target.trim().length > 0
        ? body.notification.target.trim()
        : target;

    return {
      status: "success",
      message: formatNotificationRetryResultMessage({
        status: body?.notification?.status,
        error: body?.notification?.error,
        target: effectiveTarget,
        waitingStatus: body?.approval_ticket?.waiting_status,
        runSnapshot
      }),
      dispatchId,
      target: effectiveTarget
    };
  } catch {
    return {
      status: "error",
      message: "无法连接后端执行通知重试。",
      dispatchId,
      target
    };
  }
}

export async function bulkDecideSensitiveAccessApprovalTickets(input: {
  ticketIds: string[];
  status: Extract<SensitiveAccessBulkAction, "approved" | "rejected">;
  approvedBy: string;
}): Promise<SensitiveAccessBulkActionResult> {
  const ticketIds = [...new Set(input.ticketIds.map((item) => item.trim()).filter(Boolean))];
  const approvedBy = input.approvedBy.trim();

  if (ticketIds.length === 0 || !approvedBy) {
    return {
      action: input.status,
      status: "error",
      message: "缺少批量审批所需的信息。",
      requestedCount: ticketIds.length,
      updatedCount: 0,
      skippedCount: 0,
      skippedReasonSummary: [],
      ...createEmptyBulkResultMetrics()
    };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sensitive-access/approval-tickets/bulk-decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: input.status,
        approved_by: approvedBy,
        ticket_ids: ticketIds
      }),
      cache: "no-store"
    });

    const body = (await response.json().catch(() => null)) as
      | ({ detail?: string } & Partial<ApprovalTicketBulkDecisionResponseBody>)
      | null;

    if (!response.ok) {
      return {
        action: input.status,
        status: "error",
        message: body?.detail ?? "批量审批失败。",
        requestedCount: ticketIds.length,
        updatedCount: 0,
        skippedCount: 0,
        skippedReasonSummary: [],
        ...createEmptyBulkResultMetrics()
      };
    }

    revalidateSensitiveAccessPaths(body?.decided_items?.map((item) => item.run_id) ?? []);

    const updatedCount = body?.decided_count ?? 0;
    const skippedCount = body?.skipped_count ?? 0;
    const skippedReasonSummary = body?.skipped_reason_summary ?? [];
    const affectedRunIds = body?.decided_items?.map((item) => item.run_id) ?? [];
    const { sampledRuns, followUpSummary } = await buildBulkRunFollowUpMetrics(affectedRunIds);

    return {
      action: input.status,
      status: "success",
      message: formatBulkApprovalDecisionResultMessage({
        decision: input.status,
        updatedCount,
        skippedCount,
        skippedSummary: buildBulkSkipSummaryMessage(skippedReasonSummary),
        affectedRunCount: followUpSummary.affectedRunCount,
        sampledRuns
      }),
      requestedCount: body?.requested_count ?? ticketIds.length,
      updatedCount,
      skippedCount,
      skippedReasonSummary,
      ...followUpSummary
    };
  } catch {
    return {
      action: input.status,
      status: "error",
      message: "无法连接后端执行批量审批。",
      requestedCount: ticketIds.length,
      updatedCount: 0,
      skippedCount: 0,
      skippedReasonSummary: [],
      ...createEmptyBulkResultMetrics()
    };
  }
}

export async function bulkRetrySensitiveAccessNotificationDispatches(input: {
  dispatchIds: string[];
}): Promise<SensitiveAccessBulkActionResult> {
  const dispatchIds = [...new Set(input.dispatchIds.map((item) => item.trim()).filter(Boolean))];

  if (dispatchIds.length === 0) {
    return {
      action: "retry",
      status: "error",
      message: "缺少批量通知重试所需的信息。",
      requestedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      skippedReasonSummary: [],
      ...createEmptyBulkResultMetrics()
    };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sensitive-access/notification-dispatches/bulk-retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ dispatch_ids: dispatchIds }),
      cache: "no-store"
    });

    const body = (await response.json().catch(() => null)) as
      | ({ detail?: string } & Partial<NotificationDispatchBulkRetryResponseBody>)
      | null;

    if (!response.ok) {
      return {
        action: "retry",
        status: "error",
        message: body?.detail ?? "批量通知重试失败。",
        requestedCount: dispatchIds.length,
        updatedCount: 0,
        skippedCount: 0,
        skippedReasonSummary: [],
        ...createEmptyBulkResultMetrics()
      };
    }

    revalidateSensitiveAccessPaths(
      body?.retried_items?.map((item) => item.approval_ticket.run_id) ?? []
    );

    const updatedCount = body?.retried_count ?? 0;
    const skippedCount = body?.skipped_count ?? 0;
    const skippedReasonSummary = body?.skipped_reason_summary ?? [];
    const affectedRunIds = body?.retried_items?.map((item) => item.approval_ticket.run_id) ?? [];
    const { sampledRuns, followUpSummary } = await buildBulkRunFollowUpMetrics(affectedRunIds);

    return {
      action: "retry",
      status: "success",
      message: formatBulkNotificationRetryResultMessage({
        updatedCount,
        skippedCount,
        skippedSummary: buildBulkSkipSummaryMessage(skippedReasonSummary),
        affectedRunCount: followUpSummary.affectedRunCount,
        sampledRuns
      }),
      requestedCount: body?.requested_count ?? dispatchIds.length,
      updatedCount,
      skippedCount,
      skippedReasonSummary,
      ...followUpSummary
    };
  } catch {
    return {
      action: "retry",
      status: "error",
      message: "无法连接后端执行批量通知重试。",
      requestedCount: dispatchIds.length,
      updatedCount: 0,
      skippedCount: 0,
      skippedReasonSummary: [],
      ...createEmptyBulkResultMetrics()
    };
  }
}
