import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkflowMonitorSurface } from "@/components/workflow-monitor-surface";
import type {
  PublishedEndpointInvocationListResponse,
  WorkflowPublishedEndpointItem,
} from "@/lib/get-workflow-publish";

function buildBinding(
  id: string,
  overrides: Partial<WorkflowPublishedEndpointItem> = {}
): WorkflowPublishedEndpointItem {
  return {
    id,
    workflow_id: "workflow-1",
    workflow_version_id: "workflow-version-1",
    workflow_version: "v1",
    target_workflow_version_id: "workflow-version-1",
    target_workflow_version: "v1",
    compiled_blueprint_id: "blueprint-1",
    endpoint_id: `${id}-endpoint`,
    endpoint_name: `Endpoint ${id}`,
    endpoint_alias: `${id}.alias`,
    route_path: `/published/${id}`,
    protocol: "native",
    auth_mode: "api_key",
    streaming: false,
    lifecycle_status: "published",
    input_schema: {},
    output_schema: null,
    created_at: "2026-03-31T08:00:00Z",
    updated_at: "2026-03-31T08:00:00Z",
    activity: {
      total_count: 2,
      succeeded_count: 1,
      failed_count: 1,
      rejected_count: 0,
      cache_hit_count: 0,
      cache_miss_count: 2,
      cache_bypass_count: 0,
      pending_approval_count: 0,
      pending_notification_count: 0,
      primary_sensitive_resource: null,
    },
    ...overrides,
  };
}

function buildInvocationAuditWithFacts(): PublishedEndpointInvocationListResponse {
  return {
    filters: {},
    summary: {
      total_count: 6,
      succeeded_count: 4,
      failed_count: 1,
      rejected_count: 1,
      cache_hit_count: 2,
      cache_miss_count: 4,
      cache_bypass_count: 0,
      pending_approval_count: 1,
      pending_notification_count: 1,
      last_invoked_at: "2026-03-31T10:00:00Z",
      last_status: "failed",
      last_cache_status: "miss" as const,
      last_run_id: "run-monitor-1",
      last_run_status: "waiting_callback",
      last_reason_code: "runtime_failed",
      primary_sensitive_resource: null,
    },
    facets: {
      status_counts: [],
      request_source_counts: [{ value: "workflow", count: 4 }],
      request_surface_counts: [
        { value: "openai.responses", count: 4 },
        { value: "native.workflow", count: 2 },
      ],
      cache_status_counts: [
        { value: "hit", count: 2 },
        { value: "miss", count: 4 },
      ],
      run_status_counts: [
        { value: "waiting_callback", count: 2 },
        { value: "failed", count: 1 },
      ],
      reason_counts: [{ value: "runtime_failed", count: 1 }],
      api_key_usage: [],
      recent_failure_reasons: [
        {
          message: "sandbox backend offline during invocation",
          count: 1,
          last_invoked_at: "2026-03-31T10:00:00Z",
        },
      ],
      timeline_granularity: "hour" as const,
      timeline: [
        {
          bucket_start: "2026-03-31T08:00:00Z",
          bucket_end: "2026-03-31T09:00:00Z",
          total_count: 2,
          succeeded_count: 1,
          failed_count: 1,
          rejected_count: 0,
          api_key_counts: [],
          cache_status_counts: [{ value: "miss", count: 2 }],
          run_status_counts: [{ value: "waiting_callback", count: 1 }],
          request_surface_counts: [{ value: "openai.responses", count: 2 }],
          reason_counts: [{ value: "runtime_failed", count: 1 }],
        },
        {
          bucket_start: "2026-03-31T09:00:00Z",
          bucket_end: "2026-03-31T10:00:00Z",
          total_count: 4,
          succeeded_count: 3,
          failed_count: 0,
          rejected_count: 1,
          api_key_counts: [],
          cache_status_counts: [{ value: "hit", count: 2 }],
          run_status_counts: [{ value: "waiting_callback", count: 1 }],
          request_surface_counts: [
            { value: "openai.responses", count: 2 },
            { value: "native.workflow", count: 2 },
          ],
          reason_counts: [{ value: "rate_limit_exceeded", count: 1 }],
        },
      ],
      monitor: {
        supported_windows: ["hour", "day", "month", "year"],
        token_output_speed: {
          status: "available",
          value: 26.67,
          unit: "tokens/s",
          detail: "基于 3 条 covered AI calls 的 token output / latency 汇总。",
          fact_source: "ai_call_records.token_usage + ai_call_records.latency_ms",
          coverage_count: 3,
        },
        session_count: {
          status: "unavailable",
          value: null,
          unit: null,
          detail: "当前还没有 stable session identity seam；全部会话数继续 fail-closed。",
          fact_source: "published request metadata.session_id",
          coverage_count: 0,
        },
        message_count: {
          status: "unavailable",
          value: null,
          unit: null,
          detail: "当前还没有跨协议统一的 canonical message seam；全部消息数继续 fail-closed。",
          fact_source: "published request metadata.message_count",
          coverage_count: 0,
        },
        timeline: [
          {
            bucket_start: "2026-03-31T08:00:00Z",
            bucket_end: "2026-03-31T09:00:00Z",
            token_output_speed: 20,
            session_count: null,
            message_count: null,
            token_output_tokens: 40,
            token_latency_ms: 2000,
          },
          {
            bucket_start: "2026-03-31T09:00:00Z",
            bucket_end: "2026-03-31T10:00:00Z",
            token_output_speed: 30,
            session_count: null,
            message_count: null,
            token_output_tokens: 90,
            token_latency_ms: 3000,
          },
        ],
      },
    },
    items: [
      {
        id: "invocation-1",
        workflow_id: "workflow-1",
        binding_id: "binding-1",
        endpoint_id: "binding-1-endpoint",
        endpoint_alias: "binding-1.alias",
        route_path: "/published/binding-1",
        protocol: "native",
        auth_mode: "api_key",
        request_source: "workflow" as const,
        request_surface: "openai.responses" as const,
        status: "failed" as const,
        cache_status: "miss" as const,
        run_id: "run-monitor-1",
        run_status: "waiting_callback",
        run_current_node_id: "node-1",
        run_waiting_reason: "callback",
        run_waiting_lifecycle: null,
        run_snapshot: null,
        run_follow_up: {
          affected_run_count: 1,
          sampled_run_count: 1,
          waiting_run_count: 1,
          running_run_count: 0,
          succeeded_run_count: 0,
          failed_run_count: 1,
          unknown_run_count: 0,
          explanation: {
            primary_signal: "Callback still pending",
            follow_up: "wait for external callback",
          },
          sampled_runs: [
            {
              run_id: "run-monitor-1",
              snapshot: {
                workflow_id: "workflow-1",
                status: "waiting_callback",
                current_node_id: "node-1",
                waiting_reason: "callback",
                execution_focus_node_id: "node-1",
                execution_focus_node_name: "LLM Agent",
                execution_focus_node_run_id: "node-run-1",
                callback_waiting_explanation: {
                  primary_signal: "Callback still pending",
                  follow_up: "wait for external callback",
                },
                callback_waiting_lifecycle: null,
              },
            },
          ],
        },
        execution_focus_explanation: null,
        callback_waiting_explanation: null,
        reason_code: "runtime_failed",
        error_message: "tool failed",
        request_preview: { key_count: 1, keys: ["message"], sample: { message: "hi" } },
        response_preview: null,
        duration_ms: 1200,
        created_at: "2026-03-31T09:58:00Z",
        finished_at: "2026-03-31T09:58:01Z",
      },
    ],
  } as unknown as PublishedEndpointInvocationListResponse;
}

describe("WorkflowMonitorSurface", () => {
  it("renders an honest empty state when there is no published binding", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowMonitorSurface, {
        workflowId: "workflow-1",
        bindings: [],
        invocationAuditsByBinding: {},
        publishHref: "/workflows/workflow-1/publish",
        logsHref: "/workflows/workflow-1/logs",
        workflowEditorHref: "/workflows/workflow-1/editor",
        currentHref: "/workflows/workflow-1/monitor",
      })
    );

    expect(html).toContain('data-component="workflow-monitor-empty-state"');
    expect(html).toContain("监测报表");
    expect(html).toContain("前往发布治理");
  });

  it("renders summary cards and no-traffic guidance for published bindings without invocation facts", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowMonitorSurface, {
        workflowId: "workflow-1",
        bindings: [buildBinding("binding-1")],
        invocationAuditsByBinding: {
          "binding-1": {
            filters: {},
            summary: {
              total_count: 0,
              succeeded_count: 0,
              failed_count: 0,
              rejected_count: 0,
              cache_hit_count: 0,
              cache_miss_count: 0,
              cache_bypass_count: 0,
              pending_approval_count: 0,
              pending_notification_count: 0,
              primary_sensitive_resource: null,
            },
            facets: {
              status_counts: [],
              request_source_counts: [],
              request_surface_counts: [],
              cache_status_counts: [],
              run_status_counts: [],
              reason_counts: [],
              api_key_usage: [],
              recent_failure_reasons: [],
              timeline_granularity: "hour",
              timeline: [],
              monitor: {
                supported_windows: ["hour", "day", "month", "year"],
                token_output_speed: {
                  status: "unavailable",
                  value: null,
                  unit: null,
                  detail: "当前时间窗还没有 published invocation 事实，Token 输出速度保持 fail-closed。",
                  fact_source: "ai_call_records.token_usage + ai_call_records.latency_ms",
                  coverage_count: 0,
                },
                session_count: {
                  status: "unavailable",
                  value: null,
                  unit: null,
                  detail: "当前还没有 stable session identity seam；全部会话数继续 fail-closed。",
                  fact_source: "published request metadata.session_id",
                  coverage_count: 0,
                },
                message_count: {
                  status: "unavailable",
                  value: null,
                  unit: null,
                  detail: "当前还没有跨协议统一的 canonical message seam；全部消息数继续 fail-closed。",
                  fact_source: "published request metadata.message_count",
                  coverage_count: 0,
                },
                timeline: [],
              },
            },
            items: [],
          },
        },
        publishHref: "/workflows/workflow-1/publish",
        logsHref: "/workflows/workflow-1/logs",
        workflowEditorHref: "/workflows/workflow-1/editor",
        currentHref: "/workflows/workflow-1/monitor",
      })
    );

    expect(html).toContain('data-component="workflow-monitor-surface"');
    expect(html).toContain('data-component="workflow-studio-utility-frame"');
    expect(html).toContain('data-surface="monitor"');
    expect(html).toContain('data-component="workflow-studio-utility-frame"');
    expect(html).toContain('data-surface="monitor"');
    expect(html).toContain('data-component="workflow-monitor-summary-workbench"');
    expect(html).toContain('data-component="workflow-monitor-primary-rail"');
    expect(html).toContain('data-component="workflow-monitor-no-traffic-state"');
    expect(html).toContain("当前 workflow 已有 published binding");
    expect(html).not.toContain('data-component="workflow-studio-placeholder"');
  });

  it("renders trend, insight and sampled-run sections when invocation facts exist", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowMonitorSurface, {
        workflowId: "workflow-1",
        bindings: [buildBinding("binding-1")],
        invocationAuditsByBinding: {
          "binding-1": buildInvocationAuditWithFacts(),
        },
        publishHref: "/workflows/workflow-1/publish",
        logsHref: "/workflows/workflow-1/logs",
        workflowEditorHref: "/workflows/workflow-1/editor",
        currentHref: "/workflows/workflow-1/monitor",
      })
    );

    expect(html).toContain('data-component="workflow-monitor-report-grid"');
    expect(html).toContain('data-component="workflow-monitor-trend-shell"');
    expect(html).toContain('data-component="workflow-monitor-trend-deck"');
    expect(html).toContain('data-component="workflow-monitor-contract-notice"');
    expect(html).toContain("Token 输出速度基于真实");
    expect(html).toContain('data-component="workflow-monitor-window-switcher"');
    expect(html).toContain('data-trend-key="token-output-speed"');
    expect(html).toContain('data-trend-key="session-count"');
    expect(html).toContain('data-trend-key="message-count"');
    expect(html).toContain("tok/s");
    expect(html).toContain("Fail-closed");
    expect(html).toContain("publish_window=month");
    expect(html).toContain('data-component="workflow-monitor-insights-shell"');
    expect(html).toContain('data-component="workflow-monitor-insight-grid"');
    expect(html).toContain('data-component="workflow-monitor-window-summary"');
    expect(html).toContain('data-component="workflow-monitor-traffic-mix-card"');
    expect(html).toContain('data-component="workflow-monitor-waiting-card"');
    expect(html).toContain('data-component="workflow-monitor-issue-signals-card"');
    expect(html).toContain('data-component="workflow-monitor-timeline-shell"');
    expect(html).toContain('data-component="workflow-monitor-sampled-shell"');
    expect(html).toContain('data-component="workflow-monitor-sampled-runs"');
    expect(html).toContain("Callback still pending");
    expect(html).toContain("OpenAI responses 4");
  });

  it("renders a fresh focus card for the requested invocation handoff", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowMonitorSurface, {
        workflowId: "workflow-1",
        bindings: [buildBinding("binding-1"), buildBinding("binding-2")],
        invocationAuditsByBinding: {
          "binding-1": buildInvocationAuditWithFacts(),
          "binding-2": {
            ...buildInvocationAuditWithFacts(),
            items: [
              {
                ...buildInvocationAuditWithFacts().items[0],
                id: "invocation-2",
                binding_id: "binding-2",
                run_id: "run-monitor-2",
              },
            ],
          },
        },
        publishHref: "/workflows/workflow-1/publish",
        logsHref:
          "/workflows/workflow-1/logs?publish_binding=binding-1&publish_invocation=invocation-1&run=run-monitor-1",
        workflowEditorHref: "/workflows/workflow-1/editor",
        currentHref:
          "/workflows/workflow-1/monitor?publish_binding=binding-1&publish_invocation=invocation-1&run=run-monitor-1",
        focusBindingId: "binding-1",
        focusInvocationId: "invocation-1",
        focusRunId: "run-monitor-1",
      })
    );

    expect(html).toContain('data-component="workflow-monitor-focus-card"');
    expect(html).toContain('data-selection-source="query"');
    expect(html).toContain("binding · binding-1");
    expect(html).toContain("invocation · invocation-1");
    expect(html).toContain("run · run-monitor-1");
    expect(html).toContain(
      'href="/workflows/workflow-1/logs?publish_binding=binding-1&amp;publish_invocation=invocation-1&amp;run=run-monitor-1"'
    );
  });
});
