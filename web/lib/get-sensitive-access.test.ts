import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSensitiveAccessInboxSnapshot } from "./get-sensitive-access";

vi.mock("@/lib/api-base-url", () => ({
  getApiBaseUrl: () => "http://api.test"
}));

describe("getSensitiveAccessInboxSnapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads the inbox snapshot from the canonical inbox api", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [
          {
            ticket: {
              id: "ticket-1",
              access_request_id: "request-1",
              run_id: "run-1",
              node_run_id: "node-run-1",
              status: "pending",
              waiting_status: "waiting",
              approved_by: null,
              decided_at: null,
              expires_at: "2026-03-19T10:05:00Z",
              created_at: "2026-03-19T10:00:00Z"
            },
            request: {
              id: "request-1",
              run_id: "run-1",
              node_run_id: "node-run-1",
              requester_type: "ai",
              requester_id: "assistant-inbox",
              resource_id: "resource-1",
              action_type: "read",
              purpose_text: "Inspect the inbox contract.",
              decision: "require_approval",
              decision_label: "Require approval",
              reason_code: "sensitive_callback",
              reason_label: "Sensitive callback",
              policy_summary: "Wait for operator approval before resuming.",
              created_at: "2026-03-19T10:00:00Z",
              decided_at: null
            },
            resource: {
              id: "resource-1",
              label: "Inbox approval secret",
              description: null,
              sensitivity_level: "L3",
              source: "published_secret",
              metadata: {},
              created_at: "2026-03-19T09:00:00Z",
              updated_at: "2026-03-19T09:00:00Z"
            },
            notifications: [
              {
                id: "notification-1",
                approval_ticket_id: "ticket-1",
                channel: "in_app",
                target: "sensitive-access-inbox",
                status: "pending",
                delivered_at: null,
                error: null,
                created_at: "2026-03-19T10:00:00Z"
              }
            ],
            run_snapshot: {
              workflow_id: "wf-1",
              status: "waiting",
              current_node_id: "tool_wait",
              waiting_reason: "Waiting for callback approval",
              execution_focus_reason: "blocking_node_run",
              execution_focus_node_id: "tool_wait",
              execution_focus_node_run_id: "node-run-1",
              execution_focus_node_name: "Tool Wait",
              execution_focus_node_type: "tool",
              execution_focus_explanation: {
                primary_signal: "等待原因：Waiting for callback approval",
                follow_up: "下一步：优先处理这条 sensitive access 审批票据，再观察 waiting 节点是否恢复。"
              },
              callback_waiting_explanation: {
                primary_signal: "当前 callback waiting 仍卡在 1 条待处理审批。",
                follow_up: "下一步：先处理审批或等待回调恢复。"
              },
              callback_waiting_lifecycle: null,
              scheduled_resume_delay_seconds: null,
              scheduled_resume_reason: null,
              scheduled_resume_source: null,
              scheduled_waiting_status: null,
              scheduled_resume_scheduled_at: null,
              scheduled_resume_due_at: null,
              scheduled_resume_requeued_at: null,
              scheduled_resume_requeue_source: null,
              execution_focus_artifact_count: 0,
              execution_focus_artifact_ref_count: 0,
              execution_focus_tool_call_count: 0,
              execution_focus_raw_ref_count: 0,
              execution_focus_artifact_refs: [],
              execution_focus_artifacts: [],
              execution_focus_tool_calls: [],
              execution_focus_skill_trace: null
            },
            run_follow_up: {
              affected_run_count: 1,
              sampled_run_count: 1,
              waiting_run_count: 1,
              running_run_count: 0,
              succeeded_run_count: 0,
              failed_run_count: 0,
              unknown_run_count: 0,
              sampled_runs: [
                {
                  run_id: "run-1",
                  snapshot: {
                    workflow_id: "wf-1",
                    status: "waiting",
                    current_node_id: "tool_wait",
                    waiting_reason: "Waiting for callback approval",
                    execution_focus_reason: "blocking_node_run",
                    execution_focus_node_id: "tool_wait",
                    execution_focus_node_run_id: "node-run-1",
                    execution_focus_node_name: "Tool Wait",
                    execution_focus_node_type: "tool",
                    execution_focus_explanation: {
                      primary_signal: "等待原因：Waiting for callback approval",
                      follow_up:
                        "下一步：优先处理这条 sensitive access 审批票据，再观察 waiting 节点是否恢复。"
                    },
                    callback_waiting_explanation: {
                      primary_signal: "当前 callback waiting 仍卡在 1 条待处理审批。",
                      follow_up: "下一步：先处理审批或等待回调恢复。"
                    },
                    callback_waiting_lifecycle: null,
                    scheduled_resume_delay_seconds: null,
                    scheduled_resume_reason: null,
                    scheduled_resume_source: null,
                    scheduled_waiting_status: null,
                    scheduled_resume_scheduled_at: null,
                    scheduled_resume_due_at: null,
                    scheduled_resume_requeued_at: null,
                    scheduled_resume_requeue_source: null,
                    execution_focus_artifact_count: 0,
                    execution_focus_artifact_ref_count: 0,
                    execution_focus_tool_call_count: 0,
                    execution_focus_raw_ref_count: 0,
                    execution_focus_artifact_refs: [],
                    execution_focus_artifacts: [],
                    execution_focus_tool_calls: [],
                    execution_focus_skill_trace: null
                  }
                }
              ]
            }
          }
        ],
        channels: [
          {
            channel: "in_app",
            delivery_mode: "inline",
            target_kind: "in_app",
            configured: true,
            health_status: "ready",
            summary: "Inline inbox write-through",
            target_hint: "???? inbox",
            target_example: "sensitive-access-inbox",
            health_reason: "ready",
            config_facts: [],
            dispatch_summary: {
              pending_count: 1,
              delivered_count: 0,
              failed_count: 0,
              latest_dispatch_at: null,
              latest_delivered_at: null,
              latest_failure_at: null,
              latest_failure_error: null,
              latest_failure_target: null
            }
          }
        ],
        resources: [
          {
            id: "resource-1",
            label: "Inbox approval secret",
            description: null,
            sensitivity_level: "L3",
            source: "published_secret",
            metadata: {},
            created_at: "2026-03-19T09:00:00Z",
            updated_at: "2026-03-19T09:00:00Z"
          }
        ],
        requests: [
          {
            id: "request-1",
            run_id: "run-1",
            node_run_id: "node-run-1",
            requester_type: "ai",
            requester_id: "assistant-inbox",
            resource_id: "resource-1",
            action_type: "read",
            purpose_text: "Inspect the inbox contract.",
            decision: "require_approval",
            decision_label: "Require approval",
            reason_code: "sensitive_callback",
            reason_label: "Sensitive callback",
            policy_summary: "Wait for operator approval before resuming.",
            created_at: "2026-03-19T10:00:00Z",
            decided_at: null
          }
        ],
        notifications: [
          {
            id: "notification-1",
            approval_ticket_id: "ticket-1",
            channel: "in_app",
            target: "sensitive-access-inbox",
            status: "pending",
            delivered_at: null,
            error: null,
            created_at: "2026-03-19T10:00:00Z"
          }
        ],
        summary: {
          ticket_count: 1,
          pending_ticket_count: 1,
          approved_ticket_count: 0,
          rejected_ticket_count: 0,
          expired_ticket_count: 0,
          waiting_ticket_count: 1,
          resumed_ticket_count: 0,
          failed_ticket_count: 0,
          pending_notification_count: 1,
          delivered_notification_count: 0,
          failed_notification_count: 0
        }
      })
    } as Response);

    const snapshot = await getSensitiveAccessInboxSnapshot({
      ticketStatus: "pending",
      runId: "run-1"
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(global.fetch).mock.calls[0]?.[0])).toBe(
      "http://api.test/api/sensitive-access/inbox?status=pending&run_id=run-1"
    );
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]?.ticket.id).toBe("ticket-1");
    expect(snapshot.entries[0]?.request?.id).toBe("request-1");
    expect(snapshot.entries[0]?.resource?.id).toBe("resource-1");
    expect(snapshot.entries[0]?.notifications).toHaveLength(1);
    expect(snapshot.entries[0]?.runSnapshot?.executionFocusNodeRunId).toBe("node-run-1");
    expect(snapshot.entries[0]?.runFollowUp?.sampledRuns[0]?.runId).toBe("run-1");
    expect(snapshot.entries[0]?.executionContext?.focusMatchesEntry).toBe(true);
    expect(snapshot.entries[0]?.callbackWaitingContext?.nodeRunId).toBe("node-run-1");
    expect(snapshot.channels).toHaveLength(1);
    expect(snapshot.summary.ticket_count).toBe(1);
    expect(snapshot.summary.pending_notification_count).toBe(1);
  });
});
