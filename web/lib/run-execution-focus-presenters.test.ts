import { describe, expect, it } from "vitest";

import type { RunExecutionNodeItem } from "@/lib/get-run-views";

import {
  formatExecutionFocusFollowUp,
  formatExecutionFocusPrimarySignal
} from "./run-execution-focus-presenters";

function createExecutionNode(
  overrides: Partial<RunExecutionNodeItem> = {}
): RunExecutionNodeItem {
  return {
    node_run_id: "node-run-1",
    node_id: "tool_wait",
    node_name: "Tool Wait",
    node_type: "tool",
    status: "waiting_callback",
    phase: "waiting_callback",
    execution_class: "inline",
    execution_source: "workflow_default",
    execution_profile: null,
    execution_timeout_ms: null,
    execution_network_policy: null,
    execution_filesystem_policy: null,
    execution_dependency_mode: null,
    execution_builtin_package_set: null,
    execution_dependency_ref: null,
    execution_backend_extensions: null,
    execution_dispatched_count: 0,
    execution_fallback_count: 0,
    execution_blocked_count: 0,
    execution_unavailable_count: 0,
    effective_execution_class: null,
    execution_executor_ref: null,
    execution_sandbox_backend_id: null,
    execution_sandbox_backend_executor_ref: null,
    execution_blocking_reason: null,
    execution_fallback_reason: null,
    retry_count: 0,
    waiting_reason: null,
    error_message: null,
    started_at: "2026-03-18T10:00:00Z",
    finished_at: null,
    event_count: 0,
    event_type_counts: {},
    last_event_type: null,
    artifact_refs: [],
    artifacts: [],
    tool_calls: [],
    ai_calls: [],
    callback_tickets: [],
    skill_reference_load_count: 0,
    skill_reference_loads: [],
    sensitive_access_entries: [],
    callback_waiting_lifecycle: null,
    scheduled_resume_delay_seconds: null,
    scheduled_resume_reason: null,
    scheduled_resume_source: null,
    scheduled_waiting_status: null,
    scheduled_resume_scheduled_at: null,
    scheduled_resume_due_at: null,
    ...overrides
  };
}

describe("run execution focus presenters", () => {
  it("优先展示 execution blocking reason", () => {
    const signal = formatExecutionFocusPrimarySignal(
      createExecutionNode({
        execution_blocking_reason: "sandbox backend unavailable",
        waiting_reason: "waiting for callback"
      })
    );

    expect(signal).toBe("执行阻断：sandbox backend unavailable");
  });

  it("在无 execution blocking 时回退到 waiting reason", () => {
    const signal = formatExecutionFocusPrimarySignal(
      createExecutionNode({
        waiting_reason: "Waiting for callback approval"
      })
    );

    expect(signal).toBe("等待原因：Waiting for callback approval");
  });

  it("follow-up 优先提示 pending sensitive access approvals", () => {
    const followUp = formatExecutionFocusFollowUp(
      createExecutionNode({
        sensitive_access_entries: [
          {
            request: {
              id: "request-1",
              run_id: "run-1",
              node_run_id: "node-run-1",
              requester_type: "tool",
              requester_id: "native.search",
              resource_id: "resource-1",
              action_type: "invoke",
              created_at: "2026-03-18T10:00:00Z"
            },
            resource: {
              id: "resource-1",
              label: "Callback capability",
              description: "External callback channel",
              sensitivity_level: "L2",
              source: "local_capability",
              metadata: {},
              created_at: "2026-03-18T09:00:00Z",
              updated_at: "2026-03-18T09:00:00Z"
            },
            approval_ticket: {
              id: "ticket-1",
              access_request_id: "request-1",
              run_id: "run-1",
              node_run_id: "node-run-1",
              status: "pending",
              waiting_status: "waiting",
              approved_by: null,
              decided_at: null,
              expires_at: "2026-03-18T10:05:00Z",
              created_at: "2026-03-18T10:00:00Z"
            },
            notifications: []
          }
        ],
        callback_tickets: [
          {
            ticket: "callback-1",
            run_id: "run-1",
            node_run_id: "node-run-1",
            tool_call_id: null,
            tool_id: null,
            tool_call_index: 0,
            waiting_status: "waiting",
            status: "pending",
            reason: null,
            callback_payload: null,
            created_at: "2026-03-18T10:00:00Z",
            expires_at: null,
            consumed_at: null,
            canceled_at: null,
            expired_at: null
          }
        ]
      })
    );

    expect(followUp).toContain("sensitive access 审批票据");
  });

  it("在没有审批和 pending ticket 时提示 scheduled resume", () => {
    const followUp = formatExecutionFocusFollowUp(
      createExecutionNode({
        scheduled_resume_delay_seconds: 30,
        scheduled_resume_due_at: "2026-03-18T10:00:30Z"
      })
    );

    expect(followUp).toContain("已安排自动 resume（30s）");
    expect(followUp).toContain("2026-03-18T10:00:30Z");
  });
});
