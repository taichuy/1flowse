import { describe, expect, it } from "vitest";

import type {
  PluginAdapterRegistryItem,
  PluginToolRegistryItem
} from "./get-plugin-registry";
import type { SandboxReadinessCheck } from "./get-system-overview";
import { buildExecutionCapabilityIssue } from "./workflow-tool-execution-validation-helpers";

function createCompatTool(): PluginToolRegistryItem {
  return {
    id: "compat:dify:plugin:demo/search",
    name: "Demo Search",
    ecosystem: "compat:dify",
    description: "demo",
    input_schema: {},
    output_schema: null,
    source: "plugin",
    plugin_meta: null,
    callable: true,
    supported_execution_classes: ["subprocess", "sandbox", "microvm"],
    default_execution_class: "subprocess",
    sensitivity_level: "L1"
  };
}

function createAdapter(): PluginAdapterRegistryItem {
  return {
    id: "dify-default",
    ecosystem: "compat:dify",
    endpoint: "http://adapter.local",
    enabled: true,
    healthcheck_path: "/healthz",
    workspace_ids: [],
    plugin_kinds: ["tool"],
    supported_execution_classes: ["subprocess", "sandbox", "microvm"],
    status: "up",
    detail: null
  };
}

function createSandboxReadiness(): SandboxReadinessCheck {
  return {
    enabled_backend_count: 2,
    healthy_backend_count: 2,
    degraded_backend_count: 0,
    offline_backend_count: 0,
    execution_classes: [
      {
        execution_class: "sandbox",
        available: true,
        backend_ids: ["sandbox-default"],
        supported_languages: ["python"],
        supported_profiles: ["python-safe"],
        supported_dependency_modes: ["builtin"],
        supports_builtin_package_sets: true,
        supports_backend_extensions: false,
        supports_network_policy: true,
        supports_filesystem_policy: true,
        reason: null
      },
      {
        execution_class: "microvm",
        available: true,
        backend_ids: ["microvm-default"],
        supported_languages: ["python"],
        supported_profiles: [],
        supported_dependency_modes: ["dependency_ref"],
        supports_builtin_package_sets: false,
        supports_backend_extensions: true,
        supports_network_policy: false,
        supports_filesystem_policy: false,
        reason: null
      }
    ],
    supported_languages: ["python"],
    supported_profiles: ["python-safe"],
    supported_dependency_modes: ["builtin", "dependency_ref"],
    supports_builtin_package_sets: true,
    supports_backend_extensions: true,
    supports_network_policy: true,
    supports_filesystem_policy: true
  };
}

describe("workflow tool execution validation helpers", () => {
  it("按 execution class 校验 dependencyMode 能力，而不是只看全局聚合", () => {
    const issue = buildExecutionCapabilityIssue({
      context: "节点 toolPolicy.execution",
      nodeId: "node-1",
      nodeName: "Node 1",
      toolId: "compat:dify:plugin:demo/search",
      tool: createCompatTool(),
      ecosystem: "compat:dify",
      adapterId: "dify-default",
      requestedExecutionClass: "microvm",
      executionPayload: {
        class: "microvm",
        dependencyMode: "builtin"
      },
      adapters: [createAdapter()],
      sandboxReadiness: createSandboxReadiness(),
      path: "nodes[0].config.toolPolicy.execution",
      field: "execution"
    });

    expect(issue?.message).toContain("dependencyMode = builtin");
  });

  it("按 execution class 校验 networkPolicy 能力，而不是只看全局布尔值", () => {
    const issue = buildExecutionCapabilityIssue({
      context: "节点 toolPolicy.execution",
      nodeId: "node-1",
      nodeName: "Node 1",
      toolId: "compat:dify:plugin:demo/search",
      tool: createCompatTool(),
      ecosystem: "compat:dify",
      adapterId: "dify-default",
      requestedExecutionClass: "microvm",
      executionPayload: {
        class: "microvm",
        networkPolicy: "egress-deny"
      },
      adapters: [createAdapter()],
      sandboxReadiness: createSandboxReadiness(),
      path: "nodes[0].config.toolPolicy.execution",
      field: "execution"
    });

    expect(issue?.message).toContain("networkPolicy = egress-deny");
  });
});
