import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkflowMonitorSurface } from "@/components/workflow-monitor-surface";
import type { WorkflowPublishedEndpointItem } from "@/lib/get-workflow-publish";

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
    expect(html).toContain('data-component="workflow-monitor-summary-strip"');
    expect(html).toContain('data-component="workflow-monitor-no-traffic-state"');
    expect(html).toContain("当前 workflow 已有 published binding");
    expect(html).not.toContain('data-component="workflow-studio-placeholder"');
  });
});
