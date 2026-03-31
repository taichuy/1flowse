import { describe, expect, it } from "vitest";

import {
  buildConsoleCsrfHeaders,
  canManageWorkspaceMembers,
  CSRF_TOKEN_HEADER_NAME,
  CSRF_TOKEN_COOKIE_NAME,
  readSessionCookieFromDocument,
  formatWorkspaceRole
} from "@/lib/workspace-access";

describe("workspace-access helpers", () => {
  it("maps member roles to localized labels", () => {
    expect(formatWorkspaceRole("owner")).toBe("所有者");
    expect(formatWorkspaceRole("admin")).toBe("管理员");
    expect(formatWorkspaceRole("editor")).toBe("编辑者");
    expect(formatWorkspaceRole("viewer")).toBe("观察者");
  });

  it("only allows owner and admin to manage members", () => {
    expect(canManageWorkspaceMembers("owner")).toBe(true);
    expect(canManageWorkspaceMembers("admin")).toBe(true);
    expect(canManageWorkspaceMembers("editor")).toBe(false);
    expect(canManageWorkspaceMembers("viewer")).toBe(false);
  });

  it("builds csrf headers from the readable csrf cookie", () => {
    Object.defineProperty(globalThis, "document", {
      value: {
        cookie: `${CSRF_TOKEN_COOKIE_NAME}=csrf-demo-token`
      },
      configurable: true
    });

    expect(buildConsoleCsrfHeaders()).toEqual({
      [CSRF_TOKEN_HEADER_NAME]: "csrf-demo-token"
    });
  });

  it("does not expose the httpOnly session cookie to browser helpers", () => {
    Object.defineProperty(globalThis, "document", {
      value: {
        cookie: "sevenflows_access_token=should-not-be-read"
      },
      configurable: true
    });

    expect(readSessionCookieFromDocument()).toBeNull();
  });
});
