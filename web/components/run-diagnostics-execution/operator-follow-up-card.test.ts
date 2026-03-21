import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RunDiagnosticsOperatorFollowUpCard } from "@/components/run-diagnostics-execution/operator-follow-up-card";
import type { RunExecutionView } from "@/lib/get-run-views";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

vi.mock("@/components/callback-waiting-summary-card", () => ({
  CallbackWaitingSummaryCard: ({
    waitingReason,
    nodeRunId
  }: {
    waitingReason?: string | null;
    nodeRunId?: string | null;
  }) =>
    createElement(
      "div",
      { "data-testid": "callback-summary" },
      `${waitingReason ?? "no-waiting"} · ${nodeRunId ?? "no-node-run"}`
    )
}));

vi.mock("@/components/operator-focus-evidence-card", () => ({
  OperatorFocusEvidenceCard: ({
    artifactSummary,
    toolCallCount
  }: {
    artifactSummary?: string | null;
    toolCallCount?: number;
  }) =>
    createElement(
      "div",
      { "data-testid": "focus-evidence" },
      `${artifactSummary ?? "no-summary"} · tools ${toolCallCount ?? 0}`
    )
}));

vi.mock("@/components/skill-reference-load-list", () => ({
  SkillReferenceLoadList: ({
    title,
    skillReferenceLoads
  }: {
    title?: string;
    skillReferenceLoads: Array<{ references: unknown[] }>;
  }) =>
    createElement(
      "div",
      { "data-testid": "skill-reference-list" },
      `${title ?? "Skill references"} · ${skillReferenceLoads.length}`
    )
}));

function buildExecutionView(): RunExecutionView {
  return {
    run_id: "run-123",
    workflow_id: "wf-sandbox",
    workflow_version: "v1",
    compiled_blueprint_id: null,
    status: "waiting",
    summary: {
      node_run_count: 1,
      waiting_node_count: 1,
      errored_node_count: 0,
      execution_dispatched_node_count: 1,
      execution_fallback_node_count: 0,
      execution_blocked_node_count: 0,
      execution_unavailable_node_count: 0,
      artifact_count: 1,
      tool_call_count: 1,
      ai_call_count: 0,
      assistant_call_count: 0,
      callback_ticket_count: 0,
      skill_reference_load_count: 1,
      sensitive_access_request_count: 0,
      sensitive_access_approval_ticket_count: 0,
      sensitive_access_notification_count: 0,
      artifact_kind_counts: {},
      tool_status_counts: {},
      ai_role_counts: {},
      execution_requested_class_counts: {},
      execution_effective_class_counts: {},
      execution_executor_ref_counts: {},
      execution_sandbox_backend_counts: {},
      skill_reference_phase_counts: {},
      skill_reference_source_counts: {},
      callback_ticket_status_counts: {},
      sensitive_access_decision_counts: {},
      sensitive_access_approval_status_counts: {},
      sensitive_access_notification_status_counts: {},
      callback_waiting: {
        node_count: 1,
        terminated_node_count: 0,
        issued_ticket_count: 0,
        expired_ticket_count: 0,
        consumed_ticket_count: 0,
        canceled_ticket_count: 0,
        late_callback_count: 0,
        resume_schedule_count: 1,
        scheduled_resume_pending_node_count: 1,
        scheduled_resume_requeued_node_count: 0,
        resume_source_counts: {},
        scheduled_resume_source_counts: {},
        termination_reason_counts: {}
      }
    },
    blocking_node_run_id: "node-run-1",
    execution_focus_reason: "blocking_node_run",
    execution_focus_node: null,
    execution_focus_explanation: {
      primary_signal: "顶层 execution focus 仍在等待 sandbox callback。",
      follow_up: "先看当前 run detail 的调度状态。"
    },
    run_snapshot: {
      workflow_id: "wf-sandbox",
      status: "waiting",
      current_node_id: "sandbox_code_1",
      waiting_reason: "callback pending",
      execution_focus_reason: "blocking_node_run",
      execution_focus_node_id: "sandbox_code_1",
      execution_focus_node_run_id: "node-run-1",
      execution_focus_node_name: "Sandbox Code",
      execution_focus_node_type: "sandbox_code",
      execution_focus_explanation: {
        primary_signal: "当前 execution focus 停在 sandbox_code。",
        follow_up: "确认 callback 是否已经重新入队。"
      },
      callback_waiting_explanation: {
        primary_signal: "当前 waiting 节点仍在等待 callback。",
        follow_up: "优先观察定时恢复是否已重新排队。"
      },
      callback_waiting_lifecycle: {
        wait_cycle_count: 1,
        issued_ticket_count: 0,
        expired_ticket_count: 0,
        consumed_ticket_count: 0,
        canceled_ticket_count: 0,
        late_callback_count: 0,
        resume_schedule_count: 1,
        max_expired_ticket_count: 0,
        terminated: false,
        last_resume_backoff_attempt: 0
      },
      scheduled_resume_delay_seconds: 45,
      scheduled_resume_reason: "callback_ticket_monitor",
      scheduled_resume_source: "callback_ticket_monitor",
      scheduled_waiting_status: "waiting_callback",
      scheduled_resume_scheduled_at: "2026-03-21T10:00:00Z",
      scheduled_resume_due_at: "2026-03-21T10:00:45Z",
      scheduled_resume_requeued_at: null,
      scheduled_resume_requeue_source: null,
      execution_focus_artifact_count: 1,
      execution_focus_artifact_ref_count: 1,
      execution_focus_tool_call_count: 1,
      execution_focus_raw_ref_count: 0,
      execution_focus_artifact_refs: ["artifact://focus-output"],
      execution_focus_artifacts: [
        {
          artifact_kind: "json",
          content_type: "application/json",
          summary: "sandbox output artifact",
          uri: "artifact://focus-output"
        }
      ],
      execution_focus_tool_calls: [
        {
          id: "tool-call-1",
          tool_id: "sandbox.exec",
          tool_name: "Sandbox Exec",
          phase: "execute",
          status: "waiting",
          requested_execution_class: "sandbox",
          requested_execution_source: "runtime_policy",
          requested_execution_profile: null,
          requested_execution_timeout_ms: null,
          requested_execution_network_policy: null,
          requested_execution_filesystem_policy: null,
          requested_execution_dependency_mode: null,
          requested_execution_builtin_package_set: null,
          requested_execution_dependency_ref: null,
          requested_execution_backend_extensions: null,
          effective_execution_class: "sandbox",
          execution_executor_ref: "sandbox:default",
          execution_sandbox_backend_id: "sandbox-default",
          execution_sandbox_backend_executor_ref: null,
          execution_sandbox_runner_kind: "container",
          execution_blocking_reason: null,
          execution_fallback_reason: null,
          response_summary: "callback pending",
          response_content_type: "application/json",
          raw_ref: null
        }
      ],
      execution_focus_skill_trace: {
        reference_count: 1,
        phase_counts: { execute: 1 },
        source_counts: { explicit: 1 },
        loads: [
          {
            phase: "execute",
            references: [
              {
                skill_id: "sandbox-code",
                skill_name: "Sandbox Code",
                reference_id: "ref-1",
                reference_name: "Runtime policy",
                load_source: "explicit",
                fetch_reason: null,
                fetch_request_index: null,
                fetch_request_total: null,
                retrieval_http_path: null,
                retrieval_mcp_method: null,
                retrieval_mcp_params: {}
              }
            ]
          }
        ]
      }
    },
    run_follow_up: {
      affected_run_count: 1,
      sampled_run_count: 1,
      waiting_run_count: 1,
      running_run_count: 0,
      succeeded_run_count: 0,
      failed_run_count: 0,
      unknown_run_count: 0,
      sampled_runs: [],
      explanation: {
        primary_signal: "本次影响 1 个 run。",
        follow_up: "继续沿 canonical focus 观察 waiting 是否推进。"
      }
    },
    skill_trace: null,
    nodes: []
  };
}

describe("RunDiagnosticsOperatorFollowUpCard", () => {
  it("renders the canonical operator snapshot in diagnostics", () => {
    const html = renderToStaticMarkup(
      createElement(RunDiagnosticsOperatorFollowUpCard, {
        executionView: buildExecutionView()
      })
    );

    expect(html).toContain("Canonical operator follow-up");
    expect(html).toContain("当前 waiting 节点仍在等待 callback。");
    expect(html).toContain("Run status");
    expect(html).toContain("Sandbox Code (sandbox_code_1)");
    expect(html).toContain("callback pending");
    expect(html).toContain("Recommended next step");
    expect(html).toContain("observe waiting");
    expect(html).toContain('href="/runs/run-123"');
    expect(html).toContain("callback pending · node-run-1");
    expect(html).toContain("聚焦节点已沉淀 1 个 artifact");
    expect(html).toContain("Focused skill trace · 1");
  });

  it("returns nothing when neither snapshot nor follow-up facts exist", () => {
    const executionView = buildExecutionView();
    executionView.run_snapshot = null;
    executionView.run_follow_up = null;
    executionView.execution_focus_explanation = null;

    const html = renderToStaticMarkup(
      createElement(RunDiagnosticsOperatorFollowUpCard, {
        executionView
      })
    );

    expect(html).toBe("");
  });
});
