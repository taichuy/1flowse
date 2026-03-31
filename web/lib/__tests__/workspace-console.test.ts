import { describe, expect, it } from "vitest";

import {
  canAccessConsolePage,
  canViewConsoleNavItem,
  getConsoleAccessLevelForRole,
  getWorkspaceConsoleNavigationItems,
  getWorkspaceConsolePageHref,
  WORKSPACE_MODEL_PROVIDER_SETTINGS_HREF,
  WORKSPACE_TEAM_SETTINGS_HREF
} from "@/lib/workspace-console";

describe("workspace-console route matrix", () => {
  it("maps member roles to console access levels", () => {
    expect(getConsoleAccessLevelForRole(null)).toBe("guest");
    expect(getConsoleAccessLevelForRole("viewer")).toBe("authenticated");
    expect(getConsoleAccessLevelForRole("editor")).toBe("authenticated");
    expect(getConsoleAccessLevelForRole("admin")).toBe("manager");
  });

  it("keeps team settings on a canonical workspace route", () => {
    expect(getWorkspaceConsolePageHref("team")).toBe(WORKSPACE_TEAM_SETTINGS_HREF);
    expect(getWorkspaceConsolePageHref("providers")).toBe(WORKSPACE_MODEL_PROVIDER_SETTINGS_HREF);
    expect(WORKSPACE_MODEL_PROVIDER_SETTINGS_HREF).toBe("/workspace/settings/providers");
    expect(
      getWorkspaceConsoleNavigationItems().find((item) => item.key === "team")?.href
    ).toBe(WORKSPACE_TEAM_SETTINGS_HREF);
  });

  it("allows only managers to access or see the team surface", () => {
    expect(
      canAccessConsolePage("team", {
        current_member: {
          role: "owner"
        },
        route_permissions: [
          {
            route: "/api/workspace/members",
            access_level: "authenticated",
            methods: ["GET"],
            csrf_protected_methods: [],
            description: "members"
          }
        ]
      })
    ).toBe(true);
    expect(
      canAccessConsolePage("providers", {
        current_member: {
          role: "owner"
        },
        route_permissions: [
          {
            route: "/api/workspace/model-providers/settings",
            access_level: "manager",
            methods: ["GET"],
            csrf_protected_methods: [],
            description: "provider settings"
          }
        ]
      })
    ).toBe(true);
    expect(
      canAccessConsolePage("team", {
        current_member: {
          role: "viewer"
        }
      })
    ).toBe(false);
    expect(
      canAccessConsolePage("providers", {
        current_member: {
          role: "owner"
        },
        route_permissions: []
      })
    ).toBe(true);
    expect(canAccessConsolePage("team", null)).toBe(false);
    expect(canViewConsoleNavItem("team", "admin")).toBe(true);
    expect(canViewConsoleNavItem("team", "editor")).toBe(false);
  });
});
