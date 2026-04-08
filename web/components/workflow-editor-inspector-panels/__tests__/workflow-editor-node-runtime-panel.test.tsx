import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  resolveStartNodeRuntimeSurfaceState,
  resolveStartNodeTrialRunLaunchMode,
  WorkflowEditorNodeRuntimePanel
} from "@/components/workflow-editor-inspector-panels/workflow-editor-node-runtime-panel";
import type { RunDetail } from "@/lib/get-run-detail";
import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import type { Node } from "@xyflow/react";

Object.assign(globalThis, { React });

vi.mock("@/app/actions/runs", () => ({
  triggerWorkflowNodeTrialRun: vi.fn()
}));

function buildNode(
  overrides: Partial<WorkflowCanvasNodeData>
): Node<WorkflowCanvasNodeData> {
  return {
    id: "node-1",
    position: { x: 0, y: 0 },
    type: "workflow",
    data: {
      label: "startNode",
      nodeType: "startNode",
      config: {},
      inputSchema: undefined,
      outputSchema: {},
      ...overrides
    }
  } as Node<WorkflowCanvasNodeData>;
}

function buildRunDetail(): RunDetail {
  return {
    id: "run-demo-1",
    workflow_id: "workflow-demo",
    workflow_version: "0.1.0",
    status: "succeeded",
    input_payload: { query: "你好" },
    output_payload: { accepted: true },
    created_at: "2026-04-04T00:00:00Z",
    event_count: 2,
    event_type_counts: {},
    node_runs: [
      {
        id: "node-run-1",
        node_id: "node-1",
        node_name: "startNode",
        node_type: "startNode",
        status: "succeeded",
        input_payload: {
          query: "你好",
          files: ["file-1"]
        },
        output_payload: {
          query: "你好",
          files: ["file-1"]
        }
      }
    ],
    events: []
  };
}

describe("WorkflowEditorNodeRuntimePanel", () => {
  it("renders node trial inputs from the current node input schema", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({
          label: "LLM Agent",
          nodeType: "llmAgentNode",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                title: "Query",
                description: "开始节点默认承接用户输入。"
              },
              files: {
                type: "array",
                title: "Files",
                description: "可选的文件引用列表。",
                items: {
                  type: "string"
                }
              }
            },
            required: ["query"]
          }
        })
      })
    );

    expect(html).toContain("试运行输入");
    expect(html).toContain("Query");
    expect(html).toContain("Files");
    expect(html).toContain("试运行当前节点");
  });

  it("keeps the generic runtime summary for non-start nodes", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({
          label: "LLM Agent",
          nodeType: "llmAgentNode",
          inputSchema: {}
        })
      })
    );

    expect(html).toContain("当前节点运行态");
    expect(html).not.toContain('data-component="workflow-editor-start-node-runtime-strip"');
  });

  it("renders a compact runtime strip for start nodes", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({
          runStatus: "succeeded",
          runDurationMs: 2,
          runLastEventType: "node.output.completed",
          runEventCount: 3
        }),
        onOpenRunOverlay: () => undefined
      })
    );

    expect(html).toContain('data-component="workflow-editor-start-node-runtime-strip"');
    expect(html).toContain("运行时间");
    expect(html).toContain("事件");
    expect(html).toContain("node.output.completed");
    expect(html).not.toContain("详情");
    expect(html).not.toContain("当前节点运行态");
    expect(html).not.toContain("试运行输入");
    expect(html).not.toContain("运行后结果");
  });

  it("uses the selected run detail to render start-node runtime status", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({}),
        run: buildRunDetail(),
        onOpenRunOverlay: () => undefined
      })
    );

    expect(html).toContain('data-component="workflow-editor-start-node-runtime-strip"');
    expect(html).toContain("success");
    expect(html).not.toContain("未运行");
  });

  it("keeps the start-node runtime compact when selected run exists", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({}),
        run: buildRunDetail()
      })
    );

    expect(html).toContain('data-component="workflow-editor-start-node-runtime-strip"');
    expect(html).toContain("run run-demo-1");
    expect(html).not.toContain('data-component="workflow-editor-start-node-runtime-results"');
    expect(html).not.toContain("file-1");
  });

  it("renders runtime result json from the selected node run", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({
          label: "LLM Agent",
          nodeType: "llmAgentNode",
          inputSchema: {}
        }),
        run: buildRunDetail()
      })
    );

    expect(html).toContain("运行后结果");
    expect(html).toContain("当前 run：run-demo-1");
    expect(html).toContain("Input JSON");
    expect(html).toContain("Output JSON");
    expect(html).toContain("file-1");
  });

  it("renders start-node schema editors inside the runtime tab", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({}),
        onNodeInputSchemaChange: () => undefined,
        onNodeOutputSchemaChange: () => undefined
      })
    );

    expect(html).toContain("输入");
    expect(html).toContain("输出");
    expect(html).toContain("复制输入");
    expect(html).toContain("复制输出");
    expect(html).not.toContain("高级系统设置");
    expect(html).not.toContain("Node contract");
  });

  it("shows the honest single-node trial disclaimer for non-trigger nodes", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({
          label: "LLM Agent",
          nodeType: "llmAgentNode",
          inputSchema: {}
        })
      })
    );

    expect(html).toContain("试运行输入");
    expect(html).toContain("不自动补齐原工作流上游节点的真实 context");
    expect(html).toContain("当前节点没有结构化输入字段");
  });

  it("prefers direct start-node trial runs only when cache exists or no fields are required", () => {
    expect(
      resolveStartNodeTrialRunLaunchMode({
        cachedPayload: null,
        supportedFieldsCount: 2
      })
    ).toBe("form");

    expect(
      resolveStartNodeTrialRunLaunchMode({
        cachedPayload: { query: "hello" },
        supportedFieldsCount: 2
      })
    ).toBe("run");

    expect(
      resolveStartNodeTrialRunLaunchMode({
        cachedPayload: null,
        supportedFieldsCount: 0
      })
    ).toBe("run");
  });

  it("marks the start-node runtime surface as loading while trial run is in flight", () => {
    expect(
      resolveStartNodeRuntimeSurfaceState({
        status: null,
        fallbackDurationMs: undefined,
        fallbackLastEventType: undefined,
        fallbackEventCount: undefined,
        isSubmitting: true,
        isDetailLoading: false
      })
    ).toMatchObject({
      tone: "warning",
      statusLabel: "运行中",
      showLoadingPanel: true,
      loadingMessage: "正在提交这次试运行…"
    });
  });

});
