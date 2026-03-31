import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceProviderSettingsPage from "@/app/workspace/settings/providers/page";
import {
  getServerWorkspaceContext,
  getServerWorkspaceCredentials,
  getServerWorkspaceModelProviderRegistryState
} from "@/lib/server-workspace-access";

Object.assign(globalThis, { React });

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  }
}));

vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ children, layout, navigationMode }: { children: ReactNode; layout?: string; navigationMode?: string }) =>
    createElement(
      "div",
      {
        "data-component": "workspace-shell",
        "data-layout": layout ?? "default",
        "data-navigation-mode": navigationMode ?? "all"
      },
      children
    )
}));

vi.mock("@/components/workspace-model-provider-settings", () => ({
  WorkspaceModelProviderSettings: ({
    workspaceName,
    initialCatalog,
    initialCredentials,
    initialProviderConfigs
  }: {
    workspaceName: string;
    initialCatalog: Array<{ id: string }>;
    initialCredentials: Array<{ id: string }>;
    initialProviderConfigs: Array<{ id: string }>;
  }) =>
    createElement(
      "div",
      {
        "data-component": "workspace-model-provider-settings",
        "data-workspace": workspaceName,
        "data-catalog-count": initialCatalog.length,
        "data-credential-count": initialCredentials.length,
        "data-provider-count": initialProviderConfigs.length
      },
      workspaceName
    )
}));

vi.mock("@/lib/server-workspace-access", () => ({
  getServerWorkspaceContext: vi.fn(),
  getServerWorkspaceCredentials: vi.fn(),
  getServerWorkspaceModelProviderRegistryState: vi.fn()
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("WorkspaceProviderSettingsPage", () => {
  it("renders the manager-only provider settings shell", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue({
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
        last_login_at: "2026-03-31T12:00:00Z"
      },
      current_member: {
        id: "member-owner",
        role: "owner",
        user: {
          id: "user-admin",
          email: "admin@taichuy.com",
          display_name: "7Flows Admin",
          status: "active",
          last_login_at: "2026-03-31T12:00:00Z"
        },
        created_at: "2026-03-31T12:00:00Z",
        updated_at: "2026-03-31T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      can_manage_members: true
    });
    vi.mocked(getServerWorkspaceCredentials).mockResolvedValue([{ id: "cred-openai-1" } as never]);
    vi.mocked(getServerWorkspaceModelProviderRegistryState).mockResolvedValue({
      registry: {
        catalog: [{ id: "openai" } as never],
        items: [{ id: "provider-openai-1" } as never]
      },
      errorMessage: null,
      status: 200
    });

    const html = renderToStaticMarkup(await WorkspaceProviderSettingsPage());

    expect(html).toContain('data-component="workspace-shell"');
    expect(html).toContain('data-layout="focused"');
    expect(html).toContain('data-component="workspace-model-provider-settings"');
    expect(html).toContain('data-catalog-count="1"');
    expect(html).toContain('data-credential-count="1"');
    expect(html).toContain('data-provider-count="1"');
  });

  it("redirects unauthenticated visitors back to login with canonical provider path", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue(null);

    await expect(WorkspaceProviderSettingsPage()).rejects.toThrowError(
      "redirect:/login?next=%2Fworkspace%2Fsettings%2Fproviders"
    );

    expect(getServerWorkspaceCredentials).not.toHaveBeenCalled();
    expect(getServerWorkspaceModelProviderRegistryState).not.toHaveBeenCalled();
  });

  it("redirects non-manager members before reading provider registry or credentials", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue({
      workspace: {
        id: "default",
        name: "7Flows Workspace",
        slug: "sevenflows"
      },
      current_user: {
        id: "user-viewer",
        email: "viewer@taichuy.com",
        display_name: "Viewer User",
        status: "active",
        last_login_at: "2026-03-31T12:00:00Z"
      },
      current_member: {
        id: "member-viewer",
        role: "viewer",
        user: {
          id: "user-viewer",
          email: "viewer@taichuy.com",
          display_name: "Viewer User",
          status: "active",
          last_login_at: "2026-03-31T12:00:00Z"
        },
        created_at: "2026-03-31T12:00:00Z",
        updated_at: "2026-03-31T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      can_manage_members: false
    });

    await expect(WorkspaceProviderSettingsPage()).rejects.toThrowError("redirect:/workspace");

    expect(getServerWorkspaceCredentials).not.toHaveBeenCalled();
    expect(getServerWorkspaceModelProviderRegistryState).not.toHaveBeenCalled();
  });

  it("renders an explicit provider registry error when backend fetch fails", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue({
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
        last_login_at: "2026-03-31T12:00:00Z"
      },
      current_member: {
        id: "member-owner",
        role: "owner",
        user: {
          id: "user-admin",
          email: "admin@taichuy.com",
          display_name: "7Flows Admin",
          status: "active",
          last_login_at: "2026-03-31T12:00:00Z"
        },
        created_at: "2026-03-31T12:00:00Z",
        updated_at: "2026-03-31T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      can_manage_members: true
    });
    vi.mocked(getServerWorkspaceCredentials).mockResolvedValue([{ id: "cred-openai-1" } as never]);
    vi.mocked(getServerWorkspaceModelProviderRegistryState).mockResolvedValue({
      registry: null,
      errorMessage: "工作台请求失败（500）。",
      status: 500
    });

    const html = renderToStaticMarkup(await WorkspaceProviderSettingsPage());

    expect(html).toContain('data-component="workspace-model-provider-error"');
    expect(html).toContain("团队模型供应商暂不可用");
    expect(html).toContain("工作台请求失败（500）。");
    expect(html).toContain('data-provider-count="0"');
  });
});
