import { getApiBaseUrl } from "@/lib/api-base-url";

export type NodeRunItem = {
  id: string;
  node_id: string;
  node_name: string;
  node_type: string;
  status: string;
  input_payload: Record<string, unknown>;
  output_payload?: Record<string, unknown> | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type RunEventItem = {
  id: number;
  run_id: string;
  node_run_id?: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type RunDetail = {
  id: string;
  workflow_id: string;
  workflow_version: string;
  status: string;
  input_payload: Record<string, unknown>;
  output_payload?: Record<string, unknown> | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  event_count: number;
  event_type_counts: Record<string, number>;
  first_event_at?: string | null;
  last_event_at?: string | null;
  blocking_node_run_id?: string | null;
  execution_focus_reason?: string | null;
  execution_focus_node?: {
    node_run_id: string;
    node_id: string;
    node_name: string;
    node_type: string;
    status: string;
    phase?: string | null;
    execution_class?: string | null;
    execution_source?: string | null;
    requested_execution_class?: string | null;
    requested_execution_source?: string | null;
    requested_execution_profile?: string | null;
    requested_execution_timeout_ms?: number | null;
    requested_execution_network_policy?: string | null;
    requested_execution_filesystem_policy?: string | null;
    effective_execution_class?: string | null;
    execution_executor_ref?: string | null;
    execution_sandbox_backend_id?: string | null;
    execution_sandbox_backend_executor_ref?: string | null;
    execution_blocking_reason?: string | null;
    execution_fallback_reason?: string | null;
  } | null;
  execution_focus_explanation?: {
    primary_signal?: string | null;
    follow_up?: string | null;
  } | null;
  node_runs: NodeRunItem[];
  events: RunEventItem[];
};

export async function getRunDetail(runId: string): Promise<RunDetail | null> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/runs/${encodeURIComponent(
        runId
      )}?include_events=false`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as RunDetail;
  } catch {
    return null;
  }
}
