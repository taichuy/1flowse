import { describe, expect, it, vi } from "vitest";

import AdminMembersPage from "@/app/admin/members/page";

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  }
}));

describe("AdminMembersPage", () => {
  it("redirects the legacy admin members route to workspace settings", async () => {
    await expect(AdminMembersPage()).rejects.toThrowError(
      "redirect:/workspace/settings/team"
    );
  });
});
