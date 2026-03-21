import type { Metadata } from "next";

import { WorkflowCreateWizard } from "@/components/workflow-create-wizard";
import { getWorkflowLibrarySnapshot } from "@/lib/get-workflow-library";
import {
  hasScopedWorkspaceStarterGovernanceFilters,
  readWorkspaceStarterLibraryViewState
} from "@/lib/workspace-starter-governance-query";
import { getWorkflows } from "@/lib/get-workflows";

export const metadata: Metadata = {
  title: "New Workflow | 7Flows Studio"
};

type NewWorkflowPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewWorkflowPage({ searchParams }: NewWorkflowPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const workspaceStarterViewState = readWorkspaceStarterLibraryViewState(resolvedSearchParams);
  const shouldScopeWorkspaceStarters = hasScopedWorkspaceStarterGovernanceFilters(
    workspaceStarterViewState
  );
  const [workflowLibrary, workflows] = await Promise.all([
    getWorkflowLibrarySnapshot({
      businessTrack:
        workspaceStarterViewState.activeTrack === "all"
          ? undefined
          : workspaceStarterViewState.activeTrack,
      search: workspaceStarterViewState.searchQuery,
      sourceGovernanceKind:
        workspaceStarterViewState.sourceGovernanceKind === "all"
          ? undefined
          : workspaceStarterViewState.sourceGovernanceKind,
      needsFollowUp: workspaceStarterViewState.needsFollowUp,
      includeBuiltinStarters: !shouldScopeWorkspaceStarters
    }),
    getWorkflows()
  ]);

  return (
    <WorkflowCreateWizard
      catalogToolCount={workflowLibrary.tools.length}
      sourceGovernanceKind={
        workspaceStarterViewState.sourceGovernanceKind === "all"
          ? undefined
          : workspaceStarterViewState.sourceGovernanceKind
      }
      needsFollowUp={workspaceStarterViewState.needsFollowUp}
      searchQuery={workspaceStarterViewState.searchQuery}
      starters={workflowLibrary.starters}
      starterSourceLanes={workflowLibrary.starterSourceLanes}
      nodeCatalog={workflowLibrary.nodes}
      tools={workflowLibrary.tools}
      preferredStarterId={readQueryValue(resolvedSearchParams.starter)}
      workflows={workflows}
    />
  );
}

function readQueryValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }
  return Array.isArray(value) ? value[0] : undefined;
}
