import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import WorkflowsPage from "@/app/workflows/page";
import { getWorkflows } from "@/lib/get-workflows";

Object.assign(globalThis, { React });

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

vi.mock("@/lib/get-workflows", () => ({
  getWorkflows: vi.fn()
}));

describe("WorkflowsPage", () => {
  it("renders workflow chips and governance summary", async () => {
    vi.mocked(getWorkflows).mockResolvedValue([
      {
        id: "workflow-1",
        name: "Alpha workflow",
        version: "1.0.0",
        status: "draft",
        node_count: 4,
        tool_governance: {
          referenced_tool_ids: ["tool-1", "tool-2"],
          missing_tool_ids: ["tool-missing"],
          governed_tool_count: 2,
          strong_isolation_tool_count: 1
        }
      },
      {
        id: "workflow-2",
        name: "Beta workflow",
        version: "2.0.0",
        status: "published",
        node_count: 3,
        tool_governance: {
          referenced_tool_ids: ["tool-3"],
          missing_tool_ids: [],
          governed_tool_count: 1,
          strong_isolation_tool_count: 0
        }
      }
    ]);

    const html = renderToStaticMarkup(await WorkflowsPage());

    expect(html).toContain("作者、operator 与运行入口统一收口");
    expect(html).toContain('/workflows/workflow-1');
    expect(html).toContain('/workflows/new');
    expect(html).toContain('/workspace-starters');
    expect(html).toContain('/runs');
    expect(html).toContain('/sensitive-access');
    expect(html).toContain("draft:1 / published:1");
    expect(html).toContain("Alpha workflow · missing tools");
  });

  it("shows a create entry when no workflows exist", async () => {
    vi.mocked(getWorkflows).mockResolvedValue([]);

    const html = renderToStaticMarkup(await WorkflowsPage());

    expect(html).toContain("当前还没有可编辑的 workflow");
    expect(html).toContain('/workflows/new');
    expect(html).toContain("没有缺失 catalog tool");
  });
});
