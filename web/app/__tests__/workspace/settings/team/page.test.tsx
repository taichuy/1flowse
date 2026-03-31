import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceTeamSettingsPage from "@/app/workspace/settings/team/page";
import {
  getServerWorkspaceContext,
  getServerWorkspaceMembers
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

vi.mock("@/components/workspace-member-admin-panel", () => ({
  WorkspaceMemberAdminPanel: ({
    availableRoles,
    canManageMembers,
    workspaceName,
    initialMembers
  }: {
    availableRoles: string[];
    canManageMembers: boolean;
    workspaceName: string;
    initialMembers: Array<{ id: string }>;
  }) =>
    createElement(
      "div",
      {
        "data-component": "workspace-member-admin-panel",
        "data-can-manage": String(canManageMembers),
        "data-roles": availableRoles.length,
        "data-workspace": workspaceName,
        "data-count": initialMembers.length
      },
      workspaceName
    )
}));

vi.mock("@/lib/server-workspace-access", () => ({
  getServerWorkspaceContext: vi.fn(),
  getServerWorkspaceMembers: vi.fn()
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("WorkspaceTeamSettingsPage", () => {
  it("renders the members admin shell for managers", async () => {
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
        last_login_at: "2026-03-27T12:00:00Z"
      },
      current_member: {
        id: "member-owner",
        role: "owner",
        user: {
          id: "user-admin",
          email: "admin@taichuy.com",
          display_name: "7Flows Admin",
          status: "active",
          last_login_at: "2026-03-27T12:00:00Z"
        },
        created_at: "2026-03-27T12:00:00Z",
        updated_at: "2026-03-27T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      can_manage_members: true
    });
    vi.mocked(getServerWorkspaceMembers).mockResolvedValue([
      {
        id: "member-owner",
        role: "owner",
        user: {
          id: "user-admin",
          email: "admin@taichuy.com",
          display_name: "7Flows Admin",
          status: "active",
          last_login_at: "2026-03-27T12:00:00Z"
        },
        created_at: "2026-03-27T12:00:00Z",
        updated_at: "2026-03-27T12:00:00Z"
      }
    ]);

    const html = renderToStaticMarkup(await WorkspaceTeamSettingsPage());

    expect(html).toContain('data-component="workspace-shell"');
    expect(html).toContain('data-layout="focused"');
    expect(html).toContain('data-navigation-mode="all"');
    expect(html).toContain('data-component="workspace-member-admin-panel"');
    expect(html).toContain('data-can-manage="true"');
    expect(html).toContain('data-roles="4"');
    expect(html).toContain('data-workspace="7Flows Workspace"');
    expect(html).toContain('data-count="1"');
  });

  it("redirects unauthenticated visitors back to login with the canonical team path", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue(null);
    vi.mocked(getServerWorkspaceMembers).mockResolvedValue([]);

    await expect(WorkspaceTeamSettingsPage()).rejects.toThrowError(
      "redirect:/login?next=%2Fworkspace%2Fsettings%2Fteam"
    );
  });

  it("redirects non-managers back to workspace", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue({
      workspace: {
        id: "default",
        name: "7Flows Workspace",
        slug: "sevenflows"
      },
      current_user: {
        id: "user-viewer",
        email: "viewer@taichuy.com",
        display_name: "Viewer",
        status: "active",
        last_login_at: null
      },
      current_member: {
        id: "member-viewer",
        role: "viewer",
        user: {
          id: "user-viewer",
          email: "viewer@taichuy.com",
          display_name: "Viewer",
          status: "active",
          last_login_at: null
        },
        created_at: "2026-03-27T12:00:00Z",
        updated_at: "2026-03-27T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      can_manage_members: false
    });
    vi.mocked(getServerWorkspaceMembers).mockResolvedValue([]);

    await expect(WorkspaceTeamSettingsPage()).rejects.toThrowError("redirect:/workspace");
  });
});
