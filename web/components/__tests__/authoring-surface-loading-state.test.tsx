import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuthoringSurfaceLoadingState } from "@/components/authoring-surface-loading-state";

Object.assign(globalThis, { React });

describe("AuthoringSurfaceLoadingState", () => {
  it("renders a centered overlay spinner without the old explanatory copy", () => {
    const html = renderToStaticMarkup(
      createElement(AuthoringSurfaceLoadingState, {
        title: "正在进入 workflow studio",
        summary: "先交付基础 workflow 壳层，编辑器岛与次级面板按需加载。",
        detail: "recent runs、credentials 等 no-store 数据已退出首屏阻塞链路。"
      })
    );

    expect(html).toContain('data-component="authoring-surface-loading-state"');
    expect(html).toContain('data-loading-ui="antd"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="正在进入 workflow studio"');
    expect(html).toContain("position:fixed");
    expect(html).toContain("加载中");
    expect(html).not.toContain("先交付基础 workflow 壳层");
    expect(html).not.toContain("recent runs、credentials 等 no-store 数据已退出首屏阻塞链路。");
    expect(html).not.toContain("首屏策略");
    expect(html).not.toContain("当前阶段");
  });
});
