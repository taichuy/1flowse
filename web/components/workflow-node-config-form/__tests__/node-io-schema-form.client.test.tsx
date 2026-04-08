// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { WorkflowNodeIoSchemaForm } from "@/components/workflow-node-config-form/node-io-schema-form";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe("WorkflowNodeIoSchemaForm client render", () => {
  it("does not enter a nested update loop for compact start-node schemas", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const props = {
      node: {
        id: "node-1",
        data: {
          nodeType: "startNode",
          inputSchema: { type: "object", properties: {} },
          outputSchema: { type: "object", properties: {} }
        }
      } as never,
      presentation: "collapsible" as const,
      onInputSchemaChange: () => undefined,
      onOutputSchemaChange: () => undefined
    };

    expect(() => {
      act(() => {
        root?.render(createElement(WorkflowNodeIoSchemaForm, props));
      });
    }).not.toThrow();

    expect(() => {
      act(() => {
        root?.render(createElement(WorkflowNodeIoSchemaForm, props));
      });
    }).not.toThrow();
  });
});
