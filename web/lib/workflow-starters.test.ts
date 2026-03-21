import { describe, expect, it } from "vitest";

import { inferWorkflowBusinessTrack } from "@/lib/workflow-starters";

describe("inferWorkflowBusinessTrack", () => {
  it("classifies sandbox_code workflows as orchestration capability", () => {
    expect(
      inferWorkflowBusinessTrack({
        nodes: [
          { id: "trigger", type: "trigger", name: "Trigger", config: {} },
          {
            id: "sandbox",
            type: "sandbox_code",
            name: "Sandbox Code",
            config: { language: "python", code: "result = {'ok': True}" }
          },
          { id: "output", type: "output", name: "Output", config: {} }
        ],
        edges: [
          {
            id: "edge_trigger_sandbox",
            sourceNodeId: "trigger",
            targetNodeId: "sandbox",
            channel: "control"
          },
          {
            id: "edge_sandbox_output",
            sourceNodeId: "sandbox",
            targetNodeId: "output",
            channel: "control"
          }
        ],
        variables: [],
        publish: []
      })
    ).toBe("编排节点能力");
  });
});
