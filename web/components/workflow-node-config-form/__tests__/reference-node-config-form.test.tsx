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
            nodeType: "referenceNode",
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
              nodeType: "llmAgentNode",
              config: {}
            }
          }
        ] as never,
        onChange: () => undefined
      })
    );

    expect(html).toContain("Reference source");
    expect(html).toContain("当前引用焦点");
    expect(html).toContain("Source node");
    expect(html).toContain("Authorized upstreams");
    expect(html).toContain("Agent");
    expect(html).toContain("json");
    expect(html).toContain("不会偷渡全局上下文");
  });

  it("lets authors pick any upstream and auto-authorize it from the source selector", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceNodeConfigForm, {
        node: {
          id: "reference-2",
          type: "workflowNode",
          position: { x: 0, y: 0 },
          data: {
            label: "Reference",
            nodeType: "referenceNode",
            config: {}
          }
        } as never,
        nodes: [
          {
            id: "agent-2",
            type: "workflowNode",
            position: { x: 0, y: 0 },
            data: {
              label: "Agent 2",
              nodeType: "llmAgentNode",
              config: {}
            }
          }
        ] as never,
        onChange: () => undefined
      })
    );

    expect(html).toContain("先选一个上游作为引用源");
    expect(html).toContain("自动补齐 sourceNodeId 与显式授权");
    expect(html).toContain("Agent 2 · llm_agent · 选择后自动授权");
  });
});
