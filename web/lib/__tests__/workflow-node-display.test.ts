import { describe, expect, it } from "vitest";

import {
  formatWorkflowNodeMeta,
  getWorkflowNodeDisplayLabel,
  getWorkflowNodeTypeDisplayLabel
} from "../workflow-node-display";

describe("workflow-node-display", () => {
  it("localizes built-in start and end node type labels", () => {
    expect(getWorkflowNodeTypeDisplayLabel("startNode")).toBe("开始");
    expect(getWorkflowNodeTypeDisplayLabel("startNode", "startNode")).toBe("开始");
    expect(getWorkflowNodeTypeDisplayLabel("endNode", "endNode")).toBe("直接回复");
    expect(getWorkflowNodeTypeDisplayLabel("llmAgentNode", "LLM Agent")).toBe(
      "LLM Agent"
    );
  });

  it("localizes default built-in node names but preserves custom labels", () => {
    expect(
      getWorkflowNodeDisplayLabel({
        nodeType: "startNode",
        label: "startNode"
      })
    ).toBe("开始");

    expect(
      getWorkflowNodeDisplayLabel({
        nodeType: "endNode",
        label: "endNode 2"
      })
    ).toBe("直接回复 2");

    expect(
      getWorkflowNodeDisplayLabel({
        nodeType: "startNode",
        label: "用户入口"
      })
    ).toBe("用户入口");
  });

  it("formats node meta with localized built-in labels", () => {
    expect(formatWorkflowNodeMeta("entry", "startNode", "startNode")).toBe(
      "entry · 开始"
    );
    expect(formatWorkflowNodeMeta(undefined, "endNode", "endNode")).toBe(
      "workflow · 直接回复"
    );
  });
});
