import { redirect } from "next/navigation";

import { WORKSPACE_TEAM_SETTINGS_HREF } from "@/lib/workspace-console";

export default function AdminIndexPage() {
  redirect(WORKSPACE_TEAM_SETTINGS_HREF);
}
