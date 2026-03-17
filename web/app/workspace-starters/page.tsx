import type { Metadata } from "next";

import { WorkspaceStarterLibrary } from "@/components/workspace-starter-library";
import { getPluginRegistrySnapshot } from "@/lib/get-plugin-registry";
import { getWorkspaceStarterTemplatesWithFilters } from "@/lib/get-workspace-starters";

export const metadata: Metadata = {
  title: "Workspace Starters | 7Flows Studio"
};

export default async function WorkspaceStarterPage() {
  const [templates, pluginRegistry] = await Promise.all([
    getWorkspaceStarterTemplatesWithFilters({
      includeArchived: true
    }),
    getPluginRegistrySnapshot()
  ]);

  return <WorkspaceStarterLibrary initialTemplates={templates} tools={pluginRegistry.tools} />;
}
