import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReferenceNodeConfigForm } from "@/components/workflow-node-config-form/reference-node-config-form";

describe("ReferenceNodeConfigForm", () => {
  it("renders explicit source selection and json artifact boundary", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceNodeConfigForm, {
        node: {
          id: "reference-1",
          type: "workflowNode",
          position: { x: 0, y: 0 },
          data: {
            label: "Reference",
            nodeType: "reference",
            config: {
              contextAccess: {
                readableNodeIds: ["agent-1"]
              },
              reference: {
                sourceNodeId: "agent-1",
                artifactType: "json"
              }
            }
          }
        } as never,
        nodes: [
          {
            id: "agent-1",
            type: "workflowNode",
            position: { x: 0, y: 0 },
            data: {
              label: "Agent",
              nodeType: "llm_agent",
              config: {}
            }
          }
        ] as never,
        onChange: () => undefined
      })
    );

    expect(html).toContain("Reference source");
    expect(html).toContain("Source node");
    expect(html).toContain("Agent");
    expect(html).toContain("json");
    expect(html).toContain("不会偷渡全局上下文");
  });
});
