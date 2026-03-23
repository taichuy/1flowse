import { describe, expect, it } from "vitest";

import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import type { WorkflowPublishedEndpointItem } from "@/lib/get-workflow-publish";
import {
  buildWorkflowPublishBindingCardSurface,
  buildWorkflowPublishLifecycleActionSurface
} from "@/lib/workflow-publish-binding-presenters";

function buildBinding(): WorkflowPublishedEndpointItem {
  return {
    id: "binding-1",
    workflow_id: "workflow-1",
    workflow_version_id: "workflow-version-1",
    workflow_version: "1.0.0",
    target_workflow_version_id: "workflow-version-1",
    target_workflow_version: "1.0.0",
    compiled_blueprint_id: "blueprint-1",
    endpoint_id: "endpoint-1",
    endpoint_name: "Public Search",
    endpoint_alias: "search.public",
    route_path: "/search/public",
    protocol: "openai",
    auth_mode: "session",
    streaming: true,
    lifecycle_status: "published",
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    rate_limit_policy: {
      requests: 60,
      windowSeconds: 60
    },
    cache_policy: {
      enabled: true,
      ttl: 300,
      maxEntries: 128,
      varyBy: ["messages"]
    },
    published_at: "2026-03-20T10:00:00Z",
    unpublished_at: null,
    created_at: "2026-03-20T10:00:00Z",
    updated_at: "2026-03-20T10:00:00Z",
    activity: {
      total_count: 3,
      succeeded_count: 3,
      failed_count: 0,
      rejected_count: 0,
      cache_hit_count: 1,
      cache_miss_count: 2,
      cache_bypass_count: 0,
      last_invoked_at: "2026-03-20T10:10:00Z",
      last_status: "succeeded",
      last_cache_status: "miss",
      last_run_id: "run-1",
      last_run_status: "succeeded",
      last_reason_code: null
    },
    cache_inventory: {
      enabled: true,
      ttl: 300,
      max_entries: 128,
      vary_by: [],
      active_entry_count: 2,
      total_hit_count: 9,
      last_hit_at: "2026-03-20T10:11:00Z",
      nearest_expires_at: "2026-03-20T10:15:00Z",
      latest_created_at: "2026-03-20T10:10:30Z"
    }
  };
}

function buildSandboxReadiness(): SandboxReadinessCheck {
  return {
    enabled_backend_count: 1,
    healthy_backend_count: 0,
    degraded_backend_count: 1,
    offline_backend_count: 0,
    execution_classes: [
      {
        execution_class: "sandbox",
        available: true,
        backend_ids: ["sandbox-default"],
        supported_languages: ["python"],
        supported_profiles: ["default"],
        supported_dependency_modes: ["builtin"],
        supports_tool_execution: true,
        supports_builtin_package_sets: true,
        supports_backend_extensions: false,
        supports_network_policy: true,
        supports_filesystem_policy: false,
        reason: null
      }
    ],
    supported_languages: ["python"],
    supported_profiles: ["default"],
    supported_dependency_modes: ["builtin"],
    supports_tool_execution: true,
    supports_builtin_package_sets: true,
    supports_backend_extensions: false,
    supports_network_policy: true,
    supports_filesystem_policy: false
  };
}

describe("workflow-publish-binding-presenters", () => {
  it("builds a canonical surface for publish binding metadata and cache summaries", () => {
    const surface = buildWorkflowPublishBindingCardSurface(buildBinding());

    expect(surface.endpointSummary).toBe(
      "endpoint-1 · alias search.public · path /search/public"
    );
    expect(surface.protocolChips).toEqual([
      "openai",
      "session",
      "workflow 1.0.0 -> 1.0.0",
      "streaming"
    ]);
    expect(surface.activityRows).toContainEqual({
      key: "cache",
      label: "Cache",
      value: "hit 1 / miss 2"
    });
    expect(surface.policyRows).toContainEqual({
      key: "rate-limit",
      label: "Rate limit",
      value: "60 / 60s"
    });
    expect(surface.policyRows).toContainEqual({
      key: "cache-policy",
      label: "Cache policy",
      value: "ttl 300s · max 128"
    });
    expect(surface.cacheInventorySummaryCards).toContainEqual({
      key: "entries",
      label: "Entries",
      value: "2"
    });
    expect(surface.cacheInventoryVaryLabels).toEqual(["vary full-payload"]);
    expect(surface.apiKeyGovernanceEmptyState).toContain("auth_mode=session");
  });

  it("builds lifecycle action copy from status and live sandbox readiness", () => {
    const surface = buildWorkflowPublishLifecycleActionSurface({
      currentStatus: "published",
      sandboxReadiness: buildSandboxReadiness()
    });

    expect(surface.nextStatus).toBe("offline");
    expect(surface.submitLabel).toBe("下线 endpoint");
    expect(surface.pendingLabel).toBe("提交中...");
    expect(surface.preflightDescription).toContain("当前 lifecycle action 只切换 binding 对外状态");
    expect(surface.preflightDescription).toContain("当前 sandbox readiness：");
    expect(surface.preflightDescription).toContain("degraded");
  });
});
