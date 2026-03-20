import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OperatorRunSampleCardList } from "@/components/operator-run-sample-card-list";
import type { OperatorRunSampleCard } from "@/lib/operator-run-sample-cards";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

function buildSampleCard(
  overrides: Partial<OperatorRunSampleCard> = {}
): OperatorRunSampleCard {
  return {
    runId: "run-1",
    shortRunId: "run-1",
    hasCallbackWaitingSummary: true,
    summary: "当前 sampled run 仍在等待 callback。",
    runStatus: "waiting",
    currentNodeId: "callback_node",
    focusNodeId: "callback_node",
    focusNodeLabel: "Callback node",
    focusNodeRunId: "node-run-1",
    waitingReason: "callback pending",
    executionFactBadges: [
      "effective sandbox",
      "executor tool:compat-adapter:dify-default",
      "backend sandbox-default",
      "runner tool"
    ],
    callbackWaitingExplanation: {
      primary_signal: "当前 waiting 节点仍在等待 callback。",
      follow_up: "先看当前 tool 实际落在哪个 runner。"
    },
    callbackWaitingLifecycle: null,
    callbackWaitingFocusNodeEvidence: {
      artifact_refs: [],
      artifacts: [],
      tool_calls: [
        {
          id: "tool-call-1",
          run_id: "run-1",
          node_run_id: "node-run-1",
          tool_id: "callback.wait",
          tool_name: "Callback Wait",
          phase: "execute",
          status: "waiting",
          request_summary: "wait for callback",
          execution_trace: null,
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
          execution_executor_ref: "tool:compat-adapter:dify-default",
          execution_sandbox_backend_id: "sandbox-default",
          execution_sandbox_backend_executor_ref: null,
          execution_sandbox_runner_kind: "tool",
          execution_blocking_reason: null,
          execution_fallback_reason: null,
          response_summary: "callback payload persisted",
          response_content_type: "application/json",
          response_meta: {},
          raw_ref: null,
          latency_ms: 120,
          retry_count: 0,
          error_message: null,
          created_at: "2026-03-20T10:00:01Z",
          finished_at: null
        }
      ]
    },
    scheduledResumeDelaySeconds: null,
    scheduledResumeSource: null,
    scheduledWaitingStatus: null,
    scheduledResumeScheduledAt: null,
    scheduledResumeDueAt: null,
    scheduledResumeRequeuedAt: null,
    scheduledResumeRequeueSource: null,
    artifactCount: 0,
    artifactRefCount: 0,
    toolCallCount: 1,
    rawRefCount: 0,
    skillReferenceCount: 0,
    skillReferencePhaseSummary: null,
    skillReferenceSourceSummary: null,
    focusArtifactSummary: null,
    focusToolCallSummaries: [],
    focusArtifacts: [],
    focusSkillReferenceLoads: [],
    ...overrides
  };
}

describe("OperatorRunSampleCardList", () => {
  it("moves callback waiting execution fact badges into the shared summary card", () => {
    const html = renderToStaticMarkup(
      createElement(OperatorRunSampleCardList, {
        cards: [buildSampleCard()],
        skillTraceDescription: "skill trace"
      })
    );

    expect(html).toContain("Waiting node focus evidence");
    expect(html).toContain("effective sandbox");
    expect(html.indexOf("effective sandbox")).toBeLessThan(html.indexOf("Waiting node focus evidence"));
    expect(html).toContain("executor tool:compat-adapter:dify-default");
    expect(html).toContain("backend sandbox-default");
    expect(html).toContain("runner tool");
  });

  it("keeps non-callback execution fact badges in the card header", () => {
    const html = renderToStaticMarkup(
      createElement(OperatorRunSampleCardList, {
        cards: [
          buildSampleCard({
            hasCallbackWaitingSummary: false,
            callbackWaitingExplanation: null,
            callbackWaitingFocusNodeEvidence: null
          })
        ],
        skillTraceDescription: "skill trace"
      })
    );

    expect(html).not.toContain("Waiting node focus evidence");
    expect(html).toContain("effective sandbox");
    expect(html.indexOf("effective sandbox")).toBeGreaterThan(html.indexOf("Run run-1"));
  });
});
