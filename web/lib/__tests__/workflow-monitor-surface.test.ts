import { describe, expect, it } from "vitest";

import type { WorkflowPublishedEndpointItem } from "@/lib/get-workflow-publish";
import { buildWorkflowMonitorSurfaceModel } from "@/lib/workflow-monitor-surface";

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
    ...overrides,
  };
}

describe("buildWorkflowMonitorSurfaceModel", () => {
  it("merges timeline buckets across published bindings", () => {
    const model = buildWorkflowMonitorSurfaceModel({
      bindings: [buildBinding("binding-1"), buildBinding("binding-2")],
      invocationAuditsByBinding: {
        "binding-1": {
          filters: {},
          summary: {
            total_count: 2,
            succeeded_count: 1,
            failed_count: 1,
            rejected_count: 0,
            cache_hit_count: 1,
            cache_miss_count: 1,
            cache_bypass_count: 0,
            pending_approval_count: 1,
            pending_notification_count: 0,
            primary_sensitive_resource: null,
          },
          facets: {
            status_counts: [],
            request_source_counts: [],
            request_surface_counts: [{ value: "native.workflow", count: 2 }],
            cache_status_counts: [],
            run_status_counts: [],
            reason_counts: [{ value: "runtime_failed", count: 1 }],
            api_key_usage: [],
            recent_failure_reasons: [],
            timeline_granularity: "hour",
            timeline: [
              {
                bucket_start: "2026-03-31T08:00:00Z",
                bucket_end: "2026-03-31T09:00:00Z",
                total_count: 2,
                succeeded_count: 1,
                failed_count: 1,
                rejected_count: 0,
                api_key_counts: [],
                cache_status_counts: [{ value: "hit", count: 1 }],
                run_status_counts: [{ value: "waiting_callback", count: 1 }],
                request_surface_counts: [{ value: "native.workflow", count: 2 }],
                reason_counts: [{ value: "runtime_failed", count: 1 }],
              },
            ],
          },
          items: [],
        },
        "binding-2": {
          filters: {},
          summary: {
            total_count: 3,
            succeeded_count: 2,
            failed_count: 0,
            rejected_count: 1,
            cache_hit_count: 0,
            cache_miss_count: 3,
            cache_bypass_count: 0,
            pending_approval_count: 0,
            pending_notification_count: 1,
            primary_sensitive_resource: null,
          },
          facets: {
            status_counts: [],
            request_source_counts: [],
            request_surface_counts: [{ value: "openai.responses", count: 3 }],
            cache_status_counts: [],
            run_status_counts: [],
            reason_counts: [{ value: "rate_limit_exceeded", count: 1 }],
            api_key_usage: [],
            recent_failure_reasons: [],
            timeline_granularity: "hour",
            timeline: [
              {
                bucket_start: "2026-03-31T08:00:00Z",
                bucket_end: "2026-03-31T09:00:00Z",
                total_count: 3,
                succeeded_count: 2,
                failed_count: 0,
                rejected_count: 1,
                api_key_counts: [],
                cache_status_counts: [{ value: "miss", count: 3 }],
                run_status_counts: [{ value: "succeeded", count: 2 }],
                request_surface_counts: [{ value: "openai.responses", count: 3 }],
                reason_counts: [{ value: "rate_limit_exceeded", count: 1 }],
              },
            ],
          },
          items: [],
        },
      },
    });

    expect(model.totalInvocations).toBe(5);
    expect(model.timeline).toHaveLength(1);
    expect(model.timeline[0]?.total_count).toBe(5);
    expect(model.timeline[0]?.succeeded_count).toBe(3);
    expect(model.timeline[0]?.failed_count).toBe(1);
    expect(model.timeline[0]?.rejected_count).toBe(1);
    expect(model.timeline[0]?.request_surface_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "openai.responses", count: 3 }),
        expect.objectContaining({ value: "native.workflow", count: 2 }),
      ])
    );
    expect(model.activePublishedBindingCount).toBe(2);
    expect(model.aggregateInvocationAudit?.facets.reason_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "rate_limit_exceeded", count: 1 }),
        expect.objectContaining({ value: "runtime_failed", count: 1 }),
      ])
    );
    expect(model.trendCards.map((card) => card.key)).toEqual([
      "invocations",
      "success-rate",
      "failure-pressure",
      "callback-pressure",
    ]);
    expect(model.windowSummary?.headline).toContain("峰值时间桶 5 次");
    expect(model.insightsSurface?.trafficMixCard.requestSurfaceLabels).toEqual(
      expect.arrayContaining(["OpenAI responses 3", "Native workflow route 2"])
    );
  });
});
