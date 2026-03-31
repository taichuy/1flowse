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
        }
      })
    ).toBe(true);
    expect(
      canAccessConsolePage("team", {
        current_member: {
          role: "viewer"
        }
      })
    ).toBe(false);
    expect(canAccessConsolePage("team", null)).toBe(false);
    expect(canViewConsoleNavItem("team", "admin")).toBe(true);
    expect(canViewConsoleNavItem("team", "editor")).toBe(false);
  });
});
