import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RunDiagnosticsPanel } from "@/components/run-diagnostics-panel";
import type { RunDetail } from "@/lib/get-run-detail";
import type { CallbackWaitingAutomationCheck } from "@/lib/get-system-overview";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

vi.mock("@/components/run-diagnostics-panel/overview-sections", () => ({
  RunDiagnosticsOverviewSections: () => createElement("div", { "data-testid": "overview-sections" })
}));

vi.mock("@/components/run-diagnostics-panel/trace-filters-section", () => ({
  RunDiagnosticsTraceFiltersSection: () =>
    createElement("div", { "data-testid": "trace-filters-section" })
}));

vi.mock("@/components/run-diagnostics-execution-sections", () => ({
  RunDiagnosticsExecutionSections: () =>
    createElement("div", { "data-testid": "execution-sections" })
}));

vi.mock("@/components/run-diagnostics-panel/trace-results-section", () => ({
  RunDiagnosticsTraceResultsSection: () =>
    createElement("div", { "data-testid": "trace-results-section" })
}));

function buildRunDetail(): RunDetail {
  return {
    id: "run-1",
    workflow_id: "workflow-1",
    workflow_version: "3",
    status: "failed",
    input_payload: {},
    output_payload: null,
    created_at: "2026-03-21T00:00:00Z",
    started_at: "2026-03-21T00:00:05Z",
    finished_at: "2026-03-21T00:00:10Z",
    event_count: 4,
    event_type_counts: {
      run_started: 1,
      node_failed: 1
    },
    node_runs: [
      {
        id: "node-run-1",
        node_id: "node-1",
        node_name: "Node 1",
        node_type: "tool",
        status: "failed",
        input_payload: {},
        error_message: "tool failed"
      },
      {
        id: "node-run-2",
        node_id: "node-2",
        node_name: "Node 2",
        node_type: "llm",
        status: "succeeded",
        input_payload: {}
      }
    ],
    events: []
  };
}

describe("RunDiagnosticsPanel", () => {
  it("通过 shared presenter 渲染 hero 与状态面板 copy", () => {
    const callbackWaitingAutomation = {
      status: "healthy",
      scheduler_required: true,
      detail: "callback waiting automation healthy",
      scheduler_health_status: "healthy",
      scheduler_health_detail: "scheduler loop is healthy",
      steps: []
    } satisfies CallbackWaitingAutomationCheck;

    const html = renderToStaticMarkup(
      createElement(RunDiagnosticsPanel, {
        run: buildRunDetail(),
        trace: null,
        traceError: null,
        traceQuery: {
          limit: 200,
          order: "asc"
        },
        executionView: null,
        evidenceView: null,
        callbackWaitingAutomation
      })
    );

    expect(html).toContain("Run Diagnostics");
    expect(html).toContain("Run status");
    expect(html).toContain("创建时间");
    expect(html).toContain("执行耗时");
    expect(html).toContain("Node runs");
    expect(html).toContain("Events");
    expect(html).toContain("Errors");
    expect(html).toContain("返回系统首页");
    expect(html).toContain("打开原始 events API");
  });
});
