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
  it("renders a same-origin oidc CTA and hides the local password fallback by default", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, {
        allowLocalPasswordFallback: true,
        oidcEnabled: true
      })
    );

    expect(html).toContain("同源 OIDC 主入口");
    expect(html).toContain("使用 ZITADEL 登录");
    expect(html).toContain("/api/auth/oidc/start?next=%2Fworkspace");
    expect(html).toContain("使用本地开发密码（仅辅助）");
    expect(html).not.toContain("本地默认管理员");
    expect(html).not.toContain('name="email"');
  });

  it("renders the local password form when oidc is disabled for the current environment", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, {
        allowLocalPasswordFallback: true,
        oidcEnabled: false
      })
    );

    expect(html).toContain("开发环境辅助入口");
    expect(html).toContain("当前环境显式关闭了 ZITADEL OIDC 主入口");
    expect(html).toContain("使用本地密码进入");
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).not.toContain("使用 ZITADEL 登录");
    expect(html).not.toContain("本地默认管理员");
  });

  it("surfaces oidc callback failures on the login shell", () => {
    searchParamValues.set("error", "oidc_callback_failed");

    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, {
        allowLocalPasswordFallback: true,
        oidcEnabled: true
      })
    );

    expect(html).toContain("ZITADEL 登录未完成，请重新发起同源登录");
  });
});
