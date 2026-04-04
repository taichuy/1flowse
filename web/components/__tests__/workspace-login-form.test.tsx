import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceLoginForm } from "@/components/workspace-login-form";

Object.assign(globalThis, { React });

const searchParamValues = new Map<string, string>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn()
  }),
  useSearchParams: () => ({
    get: (key: string) => searchParamValues.get(key) ?? null
  })
}));

beforeEach(() => {
  searchParamValues.clear();
});

describe("WorkspaceLoginForm", () => {
  it("renders only the zitadel username password form", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceLoginForm));

    expect(html).toContain('data-component="workspace-login-zitadel-password-form"');
    expect(html).toContain('name="login_name"');
    expect(html).toContain('name="password"');
    expect(html).toContain("进入应用工作台");
    expect(html).not.toContain("使用 ZITADEL 登录");
    expect(html).not.toContain("本地开发密码");
  });

  it("adapts the submit button and redirect copy to the requested next path", () => {
    searchParamValues.set("next", "/workspace/settings/team");

    const html = renderToStaticMarkup(createElement(WorkspaceLoginForm));

    expect(html).toContain("进入成员管理");
    expect(html).toContain("登录成功后将直接回到成员管理。");
  });

  it("surfaces callback failures as a password re-entry prompt", () => {
    searchParamValues.set("error", "oidc_callback_failed");

    const html = renderToStaticMarkup(createElement(WorkspaceLoginForm));

    expect(html).toContain("上一轮 ZITADEL 登录未完成，请重新输入账号密码。");
  });
});
