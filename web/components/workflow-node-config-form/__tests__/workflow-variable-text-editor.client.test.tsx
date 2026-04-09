// @vitest-environment jsdom

import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowVariableTextEditor } from "@/components/workflow-node-config-form/workflow-variable-text-editor";

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const writeText = vi.fn(() => Promise.resolve());

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeEach(() => {
  writeText.mockClear();
  Object.assign(globalThis.navigator, {
    clipboard: {
      writeText,
    },
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

describe("WorkflowVariableTextEditor", () => {
  it("opens picker on slash, filters variables, inserts a reference, and renames aliases in-place", () => {
    const handleChange = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        createElement(WorkflowVariableTextEditor, {
          ownerNodeId: "endNode_ab12cd34",
          ownerLabel: "直接回复",
          value: {
            version: 1,
            segments: [{ type: "text", text: "/" }],
          },
          references: [],
          variables: [
            {
              key: "upstream",
              label: "上游节点",
              items: [
                {
                  key: "llm-text",
                  label: "LLM.text",
                  selector: ["accumulated", "llm", "text"],
                  token: "{{#endNode_ab12cd34.text#}}",
                  previewPath: "accumulated.llm.text",
                  machineName: "endNode_ab12cd34.text",
                },
                {
                  key: "llm-answer",
                  label: "LLM.answer",
                  selector: ["accumulated", "llm", "answer"],
                  token: "{{#endNode_ab12cd34.answer#}}",
                  previewPath: "accumulated.llm.answer",
                  machineName: "endNode_ab12cd34.answer",
                },
              ],
            },
          ],
          onChange: handleChange,
        }),
      );
    });

    expect(document.body.textContent).toContain("上游节点");
    expect(document.body.textContent).toContain("accumulated.llm.text");

    const searchInput = document.querySelector(
      'input[placeholder="搜索变量或路径"]',
    ) as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    act(() => {
      searchInput.value = "answer";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("LLM.answer");
    expect(document.body.textContent).not.toContain("LLM.text");

    act(() => {
      searchInput.value = "text";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const copyButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("复制机器别名"),
    ) as HTMLButtonElement;

    act(() => {
      copyButton.click();
    });

    expect(writeText).toHaveBeenCalledWith("endNode_ab12cd34.text");

    const insertButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("LLM.text"),
    ) as HTMLButtonElement;

    act(() => {
      insertButton.click();
    });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        document: {
          version: 1,
          segments: [{ type: "variable", refId: "ref_1" }],
        },
        references: [
          expect.objectContaining({
            refId: "ref_1",
            alias: "text",
            ownerNodeId: "endNode_ab12cd34",
            selector: ["accumulated", "llm", "text"],
          }),
        ],
      }),
    );

    act(() => {
      root?.render(
        createElement(WorkflowVariableTextEditor, {
          ownerNodeId: "endNode_ab12cd34",
          ownerLabel: "直接回复",
          value: {
            version: 1,
            segments: [
              { type: "variable", refId: "ref_1" },
              { type: "text", text: " + " },
              { type: "variable", refId: "ref_1" },
            ],
          },
          references: [
            {
              refId: "ref_1",
              alias: "text",
              ownerNodeId: "endNode_ab12cd34",
              selector: ["accumulated", "llm", "text"],
            },
          ],
          variables: [],
          onChange: handleChange,
        }),
      );
    });

    expect(document.body.textContent).toContain("[直接回复] text");

    const aliasInput = document.querySelector('input[value="text"]') as HTMLInputElement;
    act(() => {
      aliasInput.value = "reply";
      aliasInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        references: [
          expect.objectContaining({
            refId: "ref_1",
            alias: "reply",
            ownerNodeId: "endNode_ab12cd34",
          }),
        ],
      }),
    );
  });
});
