import * as React from "react";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkflowStudioLayoutShell } from "@/components/workflow-studio-layout-shell";

Object.assign(globalThis, { React });

vi.mock("@ant-design/icons", () => ({
  LeftOutlined: () => createElement("span", { "data-icon": "left" }),
  RightOutlined: () => createElement("span", { "data-icon": "right" })
}));

vi.mock("antd", () => {
  const LayoutRoot = ({
    children,
    hasSider: _hasSider,
    ...props
  }: { children: ReactNode; hasSider?: boolean } & Record<string, unknown>) =>
    createElement("section", props, children);
  const Sider = ({
    children,
    collapsed,
    collapsedWidth,
    width,
    breakpoint,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) =>
    createElement(
      "aside",
      {
        ...props,
        "data-collapsed": String(collapsed),
        "data-collapsed-width": String(collapsedWidth),
        "data-width": String(width),
        "data-breakpoint": String(breakpoint)
      },
      children
    );
  const Content = ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) =>
    createElement("main", props, children);
  const Button = ({ children, icon, ...props }: { children?: ReactNode; icon?: ReactNode } & Record<string, unknown>) =>
    createElement("button", props, icon, children);

  return {
    Layout: Object.assign(LayoutRoot, { Sider, Content }),
    Button
  };
});

describe("WorkflowStudioLayoutShell", () => {
  it("uses the slimmer sidebar width and keeps breakpoint-based collapse enabled", () => {
    const html = renderToStaticMarkup(
      createElement(
        WorkflowStudioLayoutShell,
        {
          className: "workflow-studio-shell",
          contentClassName: "workflow-studio-stage",
          sidebar: createElement("div", null, "sidebar")
        },
        createElement("div", null, "content")
      )
    );

    expect(html).toContain('data-width="196"');
    expect(html).toContain('data-collapsed-width="24"');
    expect(html).toContain('data-breakpoint="xl"');
    expect(html).toContain('data-action="collapse-studio-sidebar"');
  });
});
