import type { Metadata } from "next";

import { WorkspaceStarterLibrary } from "@/components/workspace-starter-library";
import { resolveWorkspaceStarterLibraryViewState } from "@/components/workspace-starter-library/shared";
import { getPluginRegistrySnapshot } from "@/lib/get-plugin-registry";
import { getWorkflows } from "@/lib/get-workflows";
import { getWorkspaceStarterTemplatesWithFilters } from "@/lib/get-workspace-starters";

type WorkspaceStarterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Workspace Starters | 7Flows Studio"
};

export default async function WorkspaceStarterPage({
  searchParams
}: WorkspaceStarterPageProps) {
  const resolvedSearchParams = (searchParams ? await searchParams : {}) satisfies Record<
    string,
    string | string[] | undefined
  >;
  const [templates, pluginRegistry, workflows] = await Promise.all([
    getWorkspaceStarterTemplatesWithFilters({
      includeArchived: true
    }),
    getPluginRegistrySnapshot(),
    getWorkflows()
  ]);

  return (
    <WorkspaceStarterLibrary
      initialTemplates={templates}
      initialViewState={resolveWorkspaceStarterLibraryViewState(resolvedSearchParams, templates)}
      initialWorkflows={workflows}
      tools={pluginRegistry.tools}
    />
  );
}
