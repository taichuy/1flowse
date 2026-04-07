import { describe, expect, it } from "vitest";

import {
  getWorkspaceAppModeMeta,
  inferWorkspaceAppMode,
  isWorkspaceAppModeId,
  listWorkspaceAppModes
} from "@/lib/workspace-app-modes";

describe("workspace-app-modes", () => {
  it("classifies workflow definitions into workspace app modes", () => {
    expect(
      inferWorkspaceAppMode({
        nodes: [
          { id: "startNode", type: "startNode" },
          { id: "endNode", type: "endNode" }
        ]
      })
    ).toBe("chatflow");
    expect(
      inferWorkspaceAppMode({
        nodes: [{ id: "agent", type: "llmAgentNode" }]
      })
    ).toBe("agent");
    expect(
      inferWorkspaceAppMode({
        nodes: [
          { id: "agent", type: "llmAgentNode" },
          { id: "toolNode", type: "toolNode" }
        ]
      })
    ).toBe("tool_agent");
    expect(
      inferWorkspaceAppMode({
        nodes: [{ id: "sandbox", type: "sandboxCodeNode" }]
      })
    ).toBe("sandbox");
    expect(
      inferWorkspaceAppMode({
        nodeTypes: ["startNode", "toolNode", "endNode"]
      })
    ).toBe("tool_agent");
  });

  it("exposes stable workspace mode metadata", () => {
    expect(listWorkspaceAppModes().map((mode) => mode.id)).toEqual([
      "chatflow",
      "agent",
      "tool_agent",
      "sandbox"
    ]);
    expect(getWorkspaceAppModeMeta("tool_agent")).toMatchObject({
      label: "Tool Agent",
      shortLabel: "工具 Agent"
    });
    expect(isWorkspaceAppModeId("agent")).toBe(true);
    expect(isWorkspaceAppModeId("unknown")).toBe(false);
  });
});
