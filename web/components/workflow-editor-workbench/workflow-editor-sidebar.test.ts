import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkflowEditorSidebar } from "@/components/workflow-editor-workbench/workflow-editor-sidebar";
import type { SandboxReadinessCheck } from "@/lib/get-system-overview";

function buildSandboxReadiness(): SandboxReadinessCheck {
  return {
    enabled_backend_count: 0,
    healthy_backend_count: 0,
    degraded_backend_count: 0,
    offline_backend_count: 0,
    execution_classes: [
      {
        execution_class: "sandbox",
        available: false,
        backend_ids: [],
        supported_languages: [],
        supported_profiles: [],
        supported_dependency_modes: [],
        supports_tool_execution: false,
        supports_builtin_package_sets: false,
        supports_backend_extensions: false,
        supports_network_policy: false,
        supports_filesystem_policy: false,
        reason:
          "No sandbox backend is currently enabled. Strong-isolation execution must fail closed until a compatible backend is configured."
      }
    ],
    supported_languages: [],
    supported_profiles: [],
    supported_dependency_modes: [],
    supports_tool_execution: false,
    supports_builtin_package_sets: false,
    supports_backend_extensions: false,
    supports_network_policy: false,
    supports_filesystem_policy: false
  };
}

describe("WorkflowEditorSidebar", () => {
  it("shows execution preflight readiness before save when strong isolation is blocked", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorSidebar, {
        workflowId: "workflow-1",
        workflowName: "Demo workflow",
        workflows: [],
        nodeSourceLanes: [],
        toolSourceLanes: [],
        editorNodeLibrary: [],
        plannedNodeLibrary: [],
        unsupportedNodes: [],
        message: null,
        messageTone: "idle",
        persistBlockerSummary:
          "当前保存会被 2 类问题阻断：Execution capability / Publish draft。",
        persistBlockers: [
          {
            id: "tool_execution",
            label: "Execution capability",
            detail: "当前 workflow definition 还有 execution capability 待修正问题。",
            nextStep: "请先对齐 adapter 绑定、execution class 与 sandbox readiness，再继续保存。"
          },
          {
            id: "publish_draft",
            label: "Publish draft",
            detail: "当前 workflow definition 还有 publish draft 待修正问题。",
            nextStep: "请先在 publish draft 表单里修正发布标识、schema、缓存或版本设置，再继续保存。"
          }
        ],
        executionPreflightMessage:
          "保存前还有 2 个 execution capability 问题；先对齐 tool binding、tool 节点 runtimePolicy / LLM Agent tool policy，以及 live sandbox readiness。",
        toolExecutionValidationIssueCount: 2,
        validationNavigatorItems: [],
        runs: [],
        selectedRunId: null,
        run: null,
        trace: null,
        traceError: null,
        selectedNodeId: null,
        sandboxReadiness: buildSandboxReadiness(),
        isLoadingRunOverlay: false,
        isRefreshingRuns: false,
        onWorkflowNameChange: () => undefined,
        onAddNode: () => undefined,
        onNavigateValidationIssue: () => undefined,
        onSelectRunId: () => undefined,
        onRefreshRuns: () => undefined
      })
    );

    expect(html).toContain("Execution preflight");
    expect(html).toContain("Save gate");
    expect(html).toContain("当前保存会被 2 类问题阻断");
    expect(html).toContain("保存前还有 2 个 execution capability 问题");
    expect(html).toContain("sandbox backend");
    expect(html).toContain("fail-closed");
    expect(html).toContain("blocked sandbox");
  });
});
