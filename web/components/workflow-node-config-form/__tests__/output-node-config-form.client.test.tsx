// @vitest-environment jsdom

import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OutputNodeConfigForm } from "@/components/workflow-node-config-form/output-node-config-form";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe("OutputNodeConfigForm client render", () => {
  it("appends clicked tokens into the reply template", () => {
    const handleChange = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        createElement(OutputNodeConfigForm, {
          node: {
            id: "end-1",
            type: "workflowNode",
            position: { x: 0, y: 0 },
            data: {
              label: "直接回复",
              nodeType: "endNode",
              config: {}
            }
          } as never,
          nodes: [
            {
              id: "agent",
              type: "workflowNode",
              position: { x: 0, y: 0 },
              data: {
                label: "LLM",
                nodeType: "llmAgentNode",
                config: {}
              }
            }
          ] as never,
          onChange: handleChange
        })
      );
    });

    const tokenButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("{{#text#}}")
    ) as HTMLButtonElement | undefined;
    expect(tokenButton).toBeTruthy();

    act(() => {
      tokenButton?.click();
    });

    expect(handleChange).toHaveBeenLastCalledWith({
      replyTemplate: "{{#text#}}"
    });
  });
});
