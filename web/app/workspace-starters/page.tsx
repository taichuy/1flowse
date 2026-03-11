import type { Metadata } from "next";

import { WorkspaceStarterLibrary } from "@/components/workspace-starter-library";
import { getWorkspaceStarterTemplates } from "@/lib/get-workspace-starters";

export const metadata: Metadata = {
  title: "Workspace Starters | 7Flows Studio"
};

export default async function WorkspaceStarterPage() {
  const templates = await getWorkspaceStarterTemplates();

  return <WorkspaceStarterLibrary initialTemplates={templates} />;
}
