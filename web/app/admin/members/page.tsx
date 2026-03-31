import { redirect } from "next/navigation";

import { WORKSPACE_TEAM_SETTINGS_HREF } from "@/lib/workspace-console";

export default async function AdminMembersPage() {
  redirect(WORKSPACE_TEAM_SETTINGS_HREF);
}
