import { getApiBaseUrl } from "@/lib/api-base-url";

export type RunSnapshot = {
  status?: string | null;
  currentNodeId?: string | null;
  waitingReason?: string | null;
  workflowId?: string | null;
  executionFocusReason?: string | null;
  executionFocusNodeId?: string | null;
  executionFocusNodeRunId?: string | null;
  executionFocusExplanation?: {
    primary_signal?: string | null;
    follow_up?: string | null;
  } | null;
};

export type RunSnapshotWithId = {
  runId: string;
  snapshot: RunSnapshot | null;
};

type RunDetailResponseBody = {
  status?: string;
  workflow_id?: string | null;
  current_node_id?: string | null;
  node_runs?: Array<{
    node_id?: string | null;
    status?: string | null;
    waiting_reason?: string | null;
  }>;
};

type RunExecutionViewResponseBody = {
  status?: string | null;
  workflow_id?: string | null;
  execution_focus_reason?: string | null;
  execution_focus_node?: {
    node_id?: string | null;
    node_run_id?: string | null;
  } | null;
  execution_focus_explanation?: {
    primary_signal?: string | null;
    follow_up?: string | null;
  } | null;
};

function readCurrentWaitingReason(body: RunDetailResponseBody | null) {
  const currentNodeId = body?.current_node_id?.trim();
  if (!currentNodeId || !Array.isArray(body?.node_runs)) {
    return null;
  }

  const currentNodeRun = body.node_runs.find((item) => item.node_id === currentNodeId);
  return currentNodeRun?.waiting_reason ?? null;
}

async function fetchRunExecutionView(
  runId: string
): Promise<RunExecutionViewResponseBody | null> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/runs/${encodeURIComponent(runId)}/execution-view`,
      {
        cache: "no-store"
      }
    );
    if (!response.ok) {
      return null;
    }

    return (await response.json().catch(() => null)) as RunExecutionViewResponseBody | null;
  } catch {
    return null;
  }
}

export async function fetchRunSnapshot(runId: string): Promise<RunSnapshot | null> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/runs/${encodeURIComponent(normalizedRunId)}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }

    const [body, executionView] = await Promise.all([
      response.json().catch(() => null) as Promise<RunDetailResponseBody | null>,
      fetchRunExecutionView(normalizedRunId)
    ]);

    return {
      status: body?.status ?? executionView?.status ?? null,
      workflowId: body?.workflow_id ?? executionView?.workflow_id ?? null,
      currentNodeId: body?.current_node_id,
      waitingReason: readCurrentWaitingReason(body),
      executionFocusReason: executionView?.execution_focus_reason ?? null,
      executionFocusNodeId: executionView?.execution_focus_node?.node_id ?? null,
      executionFocusNodeRunId: executionView?.execution_focus_node?.node_run_id ?? null,
      executionFocusExplanation: executionView?.execution_focus_explanation
        ? {
            primary_signal:
              executionView.execution_focus_explanation.primary_signal ?? null,
            follow_up: executionView.execution_focus_explanation.follow_up ?? null
          }
        : null
    };
  } catch {
    return null;
  }
}

export async function fetchRunSnapshots(
  runIds: Array<string | null | undefined>,
  limit = 3
): Promise<RunSnapshotWithId[]> {
  const normalizedRunIds = [...new Set(runIds.map((item) => item?.trim()).filter(Boolean))].slice(
    0,
    Math.max(limit, 0)
  ) as string[];

  return Promise.all(
    normalizedRunIds.map(async (runId) => ({
      runId,
      snapshot: await fetchRunSnapshot(runId)
    }))
  );
}
