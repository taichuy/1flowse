import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkflowCanvasNode } from "@/components/workflow-editor-workbench/workflow-canvas-node";

Object.assign(globalThis, { React });

type WorkflowCanvasNodeProps = React.ComponentProps<typeof WorkflowCanvasNode>;

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) =>
    createElement("div", {
      "data-component": "react-flow-handle",
      "data-type": type,
      "data-position": position
    }),
  Position: {
    Left: "left",
    Right: "right"
  }
}));

function buildNodeProps(selected: boolean): WorkflowCanvasNodeProps {
  return {
    id: "node-1",
    type: "workflowNode",
    selected,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: true,
    zIndex: 1,
    isConnectable: true,
    xPos: 120,
    yPos: 80,
    data: {
      label: "Agent",
      nodeType: "llmAgentNode",
      typeLabel: "LLM Agent",
      typeDescription: "让 agent 继续推理。",
      capabilityGroup: "agent",
      config: {}
    }
  } as unknown as WorkflowCanvasNodeProps;
}

describe("WorkflowCanvasNode", () => {
  it("does not render the catalog intro when the node has no custom description", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowCanvasNode, buildNodeProps(false))
    );

    expect(html).not.toContain("让 agent 继续推理。");
    expect(html).not.toContain("后添加节点");
    expect(html).not.toContain("workflow-canvas-node selected");
  });

  it("renders the user-defined description from node config", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowCanvasNode, {
        ...buildNodeProps(false),
        data: {
          ...buildNodeProps(false).data,
          config: {
            ui: {
              description: "用户自定义说明"
            }
          }
        }
      })
    );

    expect(html).toContain("用户自定义说明");
    expect(html).not.toContain("让 agent 继续推理。");
  });

  it("prefers the localized type label in node meta", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowCanvasNode, {
        ...buildNodeProps(false),
        data: {
          label: "开始",
          nodeType: "startNode",
          typeLabel: "开始",
          typeDescription: "流程入口。",
          capabilityGroup: "entry",
          config: {}
        }
      })
    );

    expect(html).toContain("entry · 开始");
    expect(html).not.toContain("entry · startNode");
    expect(html).not.toContain('data-type="target"');
    expect(html).toContain('data-type="source"');
  });

  it("hides the outgoing handle for end nodes", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowCanvasNode, {
        ...buildNodeProps(false),
        data: {
          label: "结束",
          nodeType: "endNode",
          typeLabel: "结束",
          typeDescription: "流程出口。",
          capabilityGroup: "output",
          config: {}
        }
      })
    );

    expect(html).toContain('data-type="target"');
    expect(html).not.toContain('data-type="source"');
  });

  it("keeps selection affordances while preserving the custom description", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowCanvasNode, {
        ...buildNodeProps(true),
        data: {
          ...buildNodeProps(true).data,
          config: {
            ui: {
              description: "输出处理前先校验输入。"
            }
          }
        },
        onQuickAdd: () => undefined,
        quickAddOptions: [
          {
            type: "endNode",
            label: "结果输出",
            description: "输出处理结果",
            capabilityGroup: "output"
          }
        ]
      })
    );

    expect(html).toContain("workflow-canvas-node selected");
    expect(html).toContain("输出处理前先校验输入。");
    expect(html).toContain("Agent 后添加节点");
    expect(html).toContain("workflow-canvas-node-quick-add-trigger nodrag nopan nowheel");
    expect(html).not.toContain("下一节点");
    expect(html).not.toContain("节点操作");
  });
});
