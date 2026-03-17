import { describe, expect, it } from "vitest";

import type { SandboxReadinessCheck } from "./get-system-overview";
import type { WorkflowDefinition } from "./workflow-editor";
import type { WorkflowNodeRuntimePolicy } from "./workflow-runtime-policy";
import { buildWorkflowToolExecutionValidationIssues } from "./workflow-tool-execution-validation";

function createDefinition(overrides?: {
  config?: Record<string, unknown>;
  runtimePolicy?: WorkflowNodeRuntimePolicy;
}): WorkflowDefinition {
  return {
    nodes: [
      { id: "trigger", type: "trigger", name: "Trigger", config: {} },
      {
        id: "sandbox",
        type: "sandbox_code",
        name: "Sandbox",
        config: {
          language: "python",
          code: "result = {'ok': True}",
          ...(overrides?.config ?? {})
        },
        ...(overrides?.runtimePolicy ? { runtimePolicy: overrides.runtimePolicy } : {})
      },
      { id: "output", type: "output", name: "Output", config: {} }
    ],
    edges: [
      { id: "e1", sourceNodeId: "trigger", targetNodeId: "sandbox" },
      { id: "e2", sourceNodeId: "sandbox", targetNodeId: "output" }
    ],
    variables: [],
    publish: []
  };
}

function createSandboxReadiness(overrides?: Partial<SandboxReadinessCheck>): SandboxReadinessCheck {
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
        available: false,
        backend_ids: [],
        supported_languages: ["python"],
        supported_profiles: [],
        supported_dependency_modes: ["builtin"],
        supports_builtin_package_sets: false,
        supports_backend_extensions: false,
        supports_network_policy: false,
        supports_filesystem_policy: false,
        reason: "sandbox-default (offline)."
      }
    ],
    supported_languages: ["python"],
    supported_profiles: ["python-safe"],
    supported_dependency_modes: ["builtin"],
    supports_builtin_package_sets: true,
    supports_backend_extensions: false,
    supports_network_policy: true,
    supports_filesystem_policy: true,
    ...overrides
  };
}

describe("workflow tool execution validation", () => {
  it("在没有 tool catalog 时仍校验 sandbox_code 默认强隔离 readiness", () => {
    const issues = buildWorkflowToolExecutionValidationIssues(
      createDefinition(),
      [],
      [],
      createSandboxReadiness({
        execution_classes: [
          {
            execution_class: "sandbox",
            available: false,
            backend_ids: [],
            supported_languages: ["python"],
            supported_profiles: [],
            supported_dependency_modes: [],
            supports_builtin_package_sets: false,
            supports_backend_extensions: false,
            supports_network_policy: false,
            supports_filesystem_policy: false,
            reason: "sandbox-default (offline)."
          }
        ]
      })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("Sandbox code 节点 Sandbox (sandbox)");
    expect(issues[0]?.message).toContain("execution class 'sandbox'");
  });

  it("按 runtimePolicy.execution 校验 sandbox_code 的 builtinPackageSet hints", () => {
    const issues = buildWorkflowToolExecutionValidationIssues(
      createDefinition({
        runtimePolicy: {
          execution: {
            class: "microvm",
            dependencyMode: "builtin",
            builtinPackageSet: "py-data-basic"
          }
        }
      }),
      [],
      [],
      createSandboxReadiness({
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
            supported_dependency_modes: ["builtin"],
            supports_builtin_package_sets: false,
            supports_backend_extensions: false,
            supports_network_policy: false,
            supports_filesystem_policy: false,
            reason: null
          }
        ]
      })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("builtin package set hints");
    expect(issues[0]?.message).toContain("Sandbox code 节点 Sandbox (sandbox)");
  });
});
