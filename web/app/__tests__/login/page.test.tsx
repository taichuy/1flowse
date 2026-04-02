import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { getServerAuthSession } from "@/lib/server-workspace-access";

Object.assign(globalThis, { React });

const originalOidcEnabled = process.env.SEVENFLOWS_OIDC_ENABLED;

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  }
}));

vi.mock("@/components/workspace-login-form", () => ({
  WorkspaceLoginForm: ({
    allowLocalPasswordFallback,
    oidcEnabled
  }: {
    allowLocalPasswordFallback?: boolean;
    oidcEnabled?: boolean;
  }) =>
    createElement(
      "div",
      {
        "data-component": "workspace-login-form",
        "data-local-password-fallback": String(Boolean(allowLocalPasswordFallback)),
        "data-oidc-enabled": String(Boolean(oidcEnabled))
      },
      "form"
    )
}));

vi.mock("@/lib/server-workspace-access", () => ({
  getServerAuthSession: vi.fn()
}));

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.SEVENFLOWS_OIDC_ENABLED;
});

afterAll(() => {
  if (originalOidcEnabled === undefined) {
    delete process.env.SEVENFLOWS_OIDC_ENABLED;
    return;
  }
  process.env.SEVENFLOWS_OIDC_ENABLED = originalOidcEnabled;
});

describe("LoginPage", () => {
  it("renders the same-origin oidc login shell when the environment enables oidc", async () => {
    process.env.SEVENFLOWS_OIDC_ENABLED = "true";
    vi.mocked(getServerAuthSession).mockResolvedValue(null);

    const html = renderToStaticMarkup(await LoginPage());

    expect(html).toContain("通过同源 OIDC 进入 7Flows Workspace");
    expect(html).toContain("继续使用 ZITADEL 登录");
    expect(html).toContain('data-component="workspace-login-form"');
    expect(html).toContain('data-oidc-enabled="true"');
    expect(html).toContain('data-local-password-fallback="true"');
  });

  it("renders honest local fallback copy when oidc is not enabled", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue(null);

    const html = renderToStaticMarkup(await LoginPage());

    expect(html).toContain("当前环境尚未启用 ZITADEL OIDC");
    expect(html).toContain("选择当前环境可用的登录入口");
    expect(html).toContain('data-oidc-enabled="false"');
  });

  it("redirects to workspace when an auth session already exists", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue({
      token: "session-token",
      workspace: {
        id: "default",
        name: "7Flows Workspace",
        slug: "sevenflows"
      },
      current_user: {
        id: "user-admin",
        email: "admin@taichuy.com",
        display_name: "7Flows Admin",
        status: "active",
        last_login_at: "2026-03-28T09:00:00Z"
      },
      current_member: {
        id: "member-owner",
        role: "owner",
        user: {
          id: "user-admin",
          email: "admin@taichuy.com",
          display_name: "7Flows Admin",
          status: "active",
          last_login_at: "2026-03-28T09:00:00Z"
        },
        created_at: "2026-03-27T12:00:00Z",
        updated_at: "2026-03-27T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      expires_at: "2026-04-01T00:00:00Z"
    });

    await expect(LoginPage()).rejects.toThrowError("redirect:/workspace");
  });
});
