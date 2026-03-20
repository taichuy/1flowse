import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkflowNodeRuntimePolicyExecutionSection } from "@/components/workflow-node-config-form/runtime-policy-execution-section";
import type { SandboxReadinessCheck } from "@/lib/get-system-overview";

function buildSandboxReadiness(): SandboxReadinessCheck {
  return {
    enabled_backend_count: 1,
    healthy_backend_count: 1,
    degraded_backend_count: 0,
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
        supports_network_policy: false,
        supports_filesystem_policy: true,
        reason: null
      }
    ],
    supported_languages: ["python"],
    supported_profiles: ["default"],
    supported_dependency_modes: ["builtin"],
    supports_tool_execution: true,
    supports_builtin_package_sets: true,
    supports_backend_extensions: false,
    supports_network_policy: false,
    supports_filesystem_policy: true
  };
}

describe("WorkflowNodeRuntimePolicyExecutionSection", () => {
  it("shows live sandbox readiness when runtimePolicy.execution exceeds current capability", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowNodeRuntimePolicyExecutionSection, {
        nodeId: "node-1",
        nodeType: "sandbox_code",
        runtimePolicy: {
          execution: {
            class: "sandbox",
            profile: "browser-safe",
            networkPolicy: "restricted"
          }
        },
        sandboxReadiness: buildSandboxReadiness(),
        onChange: () => undefined
      })
    );

    expect(html).toContain("Live sandbox readiness");
    expect(html).toContain("runtimePolicy.execution 仍有 capability 未对齐");
    expect(html).toContain("profile = browser-safe");
    expect(html).toContain("networkPolicy = restricted");
  });
});
