"use server";

import { revalidatePath } from "next/cache";

import { getApiBaseUrl } from "@/lib/api-base-url";

export type CleanupRunCallbackTicketsState = {
  status: "idle" | "success" | "error";
  message: string;
  scopeKey: string;
};

type CleanupRunCallbackTicketsResponseBody = {
  matched_count: number;
  expired_count: number;
  scheduled_resume_count: number;
  terminated_count: number;
  run_ids: string[];
};

function revalidateCallbackPaths(runIds: Array<string | null | undefined>) {
  revalidatePath("/");
  revalidatePath("/sensitive-access");

  const uniqueRunIds = [...new Set(runIds.map((item) => item?.trim()).filter(Boolean))];
  for (const runId of uniqueRunIds) {
    revalidatePath(`/runs/${runId}`);
  }
}

export async function cleanupRunCallbackTickets(
  _: CleanupRunCallbackTicketsState,
  formData: FormData
): Promise<CleanupRunCallbackTicketsState> {
  const runId = String(formData.get("runId") ?? "").trim();
  const nodeRunId = String(formData.get("nodeRunId") ?? "").trim();
  const scopeKey = `${runId}:${nodeRunId}`;

  if (!runId) {
    return {
      status: "error",
      message: "缺少 callback cleanup 所需的 run 标识。",
      scopeKey
    };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/runs/callback-tickets/cleanup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "operator_callback_cleanup",
        run_id: runId,
        node_run_id: nodeRunId || null,
        schedule_resumes: true
      }),
      cache: "no-store"
    });

    const body = (await response.json().catch(() => null)) as
      | ({ detail?: string } & Partial<CleanupRunCallbackTicketsResponseBody>)
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? "callback cleanup 执行失败。",
        scopeKey
      };
    }

    revalidateCallbackPaths(body?.run_ids?.length ? body.run_ids : [runId]);

    const expiredCount = body?.expired_count ?? 0;
    const scheduledResumeCount = body?.scheduled_resume_count ?? 0;
    const terminatedCount = body?.terminated_count ?? 0;
    const matchedCount = body?.matched_count ?? 0;

    return {
      status: "success",
      message:
        matchedCount === 0
          ? "当前 slice 没有发现已过期的 callback ticket。"
          : `已处理 ${expiredCount} 条过期 ticket，安排 ${scheduledResumeCount} 次恢复，终止 ${terminatedCount} 条等待链路。`,
      scopeKey
    };
  } catch {
    return {
      status: "error",
      message: "无法连接后端执行 callback cleanup。",
      scopeKey
    };
  }
}
