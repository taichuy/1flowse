"use server";

import { revalidatePath } from "next/cache";

import {
  fetchCallbackBlockerSnapshot,
  formatCallbackBlockerDeltaSummary
} from "@/lib/callback-blocker-follow-up";
import { formatManualResumeResultMessage } from "@/lib/operator-action-result-presenters";
import { getApiBaseUrl } from "@/lib/api-base-url";

import { fetchRunSnapshot } from "./run-snapshot";

export type ResumeRunState = {
  status: "idle" | "success" | "error";
  message: string;
  runId: string;
};

const INITIAL_REASON = "operator_manual_resume_attempt";
const INITIAL_SOURCE = "operator_callback_resume";

function revalidateRunPaths(runId: string) {
  revalidatePath("/");
  revalidatePath("/sensitive-access");
  revalidatePath(`/runs/${runId}`);
}

export async function resumeRun(
  _: ResumeRunState,
  formData: FormData
): Promise<ResumeRunState> {
  const runId = String(formData.get("runId") ?? "").trim();
  const nodeRunId = String(formData.get("nodeRunId") ?? "").trim();
  const reason = String(formData.get("reason") ?? INITIAL_REASON).trim() || INITIAL_REASON;

  if (!runId) {
    return {
      status: "error",
      message: "缺少恢复 run 所需的标识。",
      runId
    };
  }

  try {
    const beforeBlockers = await fetchCallbackBlockerSnapshot({
      runId,
      nodeRunId: nodeRunId || null
    });
    const response = await fetch(`${getApiBaseUrl()}/api/runs/${runId}/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: INITIAL_SOURCE,
        reason
      }),
      cache: "no-store"
    });

    const body = (await response.json().catch(() => null)) as ({ detail?: string } & { status?: string }) | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? "手动恢复执行失败。",
        runId
      };
    }

    revalidateRunPaths(runId);
    const runSnapshot = await fetchRunSnapshot(runId);
    const afterBlockers = await fetchCallbackBlockerSnapshot({
      runId,
      nodeRunId: nodeRunId || null
    });

    return {
      status: "success",
      message: formatManualResumeResultMessage({
        blockerDeltaSummary: formatCallbackBlockerDeltaSummary({
          before: beforeBlockers,
          after: afterBlockers
        }),
        runSnapshot:
          runSnapshot ?? {
            status: body?.status,
            currentNodeId: null,
            waitingReason: null
          }
      }),
      runId
    };
  } catch {
    return {
      status: "error",
      message: "无法连接后端执行手动恢复。",
      runId
    };
  }
}
