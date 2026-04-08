import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkflowNodeCardShell } from "@/components/workflow-editor-workbench/workflow-node-card-shell";

Object.assign(globalThis, { React });

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) =>
    createElement("div", {
      "data-component": "handle",
      "data-type": type,
      "data-position": position
    }),
  Position: {
    Left: "left",
    Right: "right"
  }
}));

vi.mock("@/components/workflow-editor-workbench/workflow-canvas-quick-add", () => ({
  WorkflowCanvasQuickAddTrigger: () =>
    createElement("div", { "data-component": "quick-add" }, "quick-add")
}));

describe("WorkflowNodeCardShell", () => {
  it("keeps shared actions while respecting start-node delete rules", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowNodeCardShell, {
        id: "start-node",
        selected: true,
        label: "用户输入",
        typeLabel: "开始",
        meta: "trigger · start",
        glyph: "入",
        accentColor: "#216e4a",
        description: "开始节点",
        hasIncomingHandle: false,
        hasOutgoingHandle: true,
        canDelete: false,
        canQuickAdd: true,
        canOpenRuntime: true,
        quickAddOptions: [],
        onOpenRuntime: () => undefined,
        onDeleteNode: () => undefined,
        onQuickAdd: () => undefined
      })
    );

    expect(html).toContain('data-component="workflow-node-card-shell"');
    expect(html).toContain('data-action="open-node-runtime-from-node"');
    expect(html).toContain("试运行 用户输入");
    expect(html).toContain('data-component="quick-add"');
    expect(html).toContain('data-type="source"');
    expect(html).not.toContain("删除 用户输入");
    expect(html).not.toContain('data-type="target"');
  });
});
