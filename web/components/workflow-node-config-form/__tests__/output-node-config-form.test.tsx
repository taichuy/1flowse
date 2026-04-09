import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OutputNodeConfigForm } from "@/components/workflow-node-config-form/output-node-config-form";

describe("OutputNodeConfigForm", () => {
  it("renders the structured variable editor entry", () => {
    const html = renderToStaticMarkup(
      createElement(OutputNodeConfigForm, {
        node: {
          id: "endNode_ab12cd34",
          type: "workflowNode",
          position: { x: 0, y: 0 },
          data: {
            label: "直接回复",
            nodeType: "endNode",
            config: {
              replyDocument: {
                version: 1,
                segments: [
                  { type: "text", text: "你好，" },
                  { type: "variable", refId: "ref_1" },
                ],
              },
              replyReferences: [
                {
                  refId: "ref_1",
                  alias: "answer",
                  ownerNodeId: "endNode_ab12cd34",
                  selector: ["accumulated", "agent", "answer"],
                },
              ],
              replyTemplate: "你好，{{#endNode_ab12cd34.answer#}}",
              responseKey: "answer",
            },
          },
        } as never,
        nodes: [] as never,
        onChange: () => undefined,
      }),
    );

    expect(html).toContain("workflow-variable-text-editor");
    expect(html).toContain("[直接回复] answer");
    expect(html).toContain("回复字段名");
    expect(html).toContain("answer");
  });
});
