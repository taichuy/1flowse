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

const builtinPasswordOptions = {
  provider: "builtin",
  recommended_method: "password" as const,
  password: {
    enabled: true,
    reason: null
  },
  oidc_redirect: {
    enabled: false,
    reason: "当前认证 provider 不支持 OIDC 跳转登录。"
  }
};

const zitadelPasswordOptions = {
  provider: "zitadel",
  recommended_method: "password" as const,
  password: {
    enabled: true,
    reason: null
  },
  oidc_redirect: {
    enabled: false,
    reason: "OIDC 配置缺失：client_id, client_secret。"
  }
};

const oidcRedirectOptions = {
  provider: "zitadel",
  recommended_method: "oidc_redirect" as const,
  password: {
    enabled: false,
    reason: "ZITADEL 账号密码登录配置缺失：service user token。"
  },
  oidc_redirect: {
    enabled: true,
    reason: null
  }
};

const unavailableOptions = {
  provider: "zitadel",
  recommended_method: "unavailable" as const,
  password: {
    enabled: false,
    reason: "ZITADEL 账号密码登录配置缺失：service user token。"
  },
  oidc_redirect: {
    enabled: false,
    reason: "OIDC 配置缺失：client_id, client_secret。"
  }
};

describe("WorkspaceLoginForm", () => {
  it("renders the builtin password form when builtin auth is the active provider", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, { authOptions: builtinPasswordOptions })
    );

    expect(html).toContain('data-component="workspace-login-builtin-password-form"');
    expect(html).toContain('name="login_name"');
    expect(html).toContain('name="password"');
    expect(html).toContain("继续使用内置账号密码登录");
    expect(html).toContain("当前环境默认启用 7Flows 内置认证 provider");
  });

  it("renders the zitadel password form when external password login is the active method", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, { authOptions: zitadelPasswordOptions })
    );

    expect(html).toContain('data-component="workspace-login-password-form"');
    expect(html).toContain('name="login_name"');
    expect(html).toContain('name="password"');
    expect(html).toContain("继续使用 ZITADEL 账号密码登录");
    expect(html).toContain("进入应用工作台");
    expect(html).toContain("OIDC 跳转登录暂不可用");
  });

  it("adapts the submit button and redirect copy to the requested next path", () => {
    searchParamValues.set("next", "/workspace/settings/team");

    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, { authOptions: builtinPasswordOptions })
    );

    expect(html).toContain("进入成员管理");
    expect(html).toContain("登录成功后将直接回到目标页面。");
  });

  it("renders the oidc redirect entry when oidc is the active method", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, { authOptions: oidcRedirectOptions })
    );

    expect(html).toContain('data-component="workspace-login-oidc-redirect"');
    expect(html).toContain("跳转到应用工作台登录");
    expect(html).toContain("认证完成后将自动返回应用工作台。");
  });

  it("surfaces callback failures as a redirect retry prompt", () => {
    searchParamValues.set("error", "oidc_callback_failed");

    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, { authOptions: oidcRedirectOptions })
    );

    expect(html).toContain("上一轮 ZITADEL OIDC 登录未完成，请重新发起跳转登录。");
  });

  it("surfaces both remote auth blockers when neither method is configured", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceLoginForm, { authOptions: unavailableOptions })
    );

    expect(html).toContain("当前登录能力都不可用，请先补齐认证配置后再重试。");
    expect(html).toContain("ZITADEL 账号密码登录配置缺失：service user token。");
    expect(html).toContain("OIDC 配置缺失：client_id, client_secret。");
  });
});
