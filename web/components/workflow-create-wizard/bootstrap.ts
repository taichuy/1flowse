import { getWorkflowLibrarySnapshot } from "@/lib/get-workflow-library";
import { getWorkflows } from "@/lib/get-workflows";
import { getWorkflowPublishedEndpointLegacyAuthGovernanceSnapshot } from "@/lib/workflow-publish-client";
import {
  hasScopedWorkspaceStarterGovernanceFilters,
  type WorkspaceStarterGovernanceQueryScope
} from "@/lib/workspace-starter-governance-query";

import type {
  WorkflowCreateWizardBootstrapRequest,
  WorkflowCreateWizardProps
} from "./types";

export function buildWorkflowCreateWizardBootstrapRequest(
  governanceQueryScope: WorkspaceStarterGovernanceQueryScope
): WorkflowCreateWizardBootstrapRequest {
  const shouldScopeWorkspaceStarters = hasScopedWorkspaceStarterGovernanceFilters(
    governanceQueryScope
  );

  return {
    governanceQueryScope,
    includeLegacyAuthGovernanceSnapshot:
      shouldScopeWorkspaceStarters || governanceQueryScope.selectedTemplateId !== null,
    libraryQuery: {
      businessTrack:
        governanceQueryScope.activeTrack === "all"
          ? undefined
          : governanceQueryScope.activeTrack,
      search: governanceQueryScope.searchQuery,
      sourceGovernanceKind:
        governanceQueryScope.sourceGovernanceKind === "all"
          ? undefined
          : governanceQueryScope.sourceGovernanceKind,
      needsFollowUp: governanceQueryScope.needsFollowUp,
      includeBuiltinStarters: !shouldScopeWorkspaceStarters,
      includeStarterDefinitions: true
    }
  };
}

export async function loadWorkflowCreateWizardBootstrap(
  request: WorkflowCreateWizardBootstrapRequest
): Promise<WorkflowCreateWizardProps> {
  if (typeof window === "undefined") {
    const { loadServerWorkflowCreateWizardBootstrap } = await import("./server-bootstrap");
    return loadServerWorkflowCreateWizardBootstrap(request);
  }

  const [workflowLibrary, workflows, legacyAuthGovernanceSnapshot] = await Promise.all([
    getWorkflowLibrarySnapshot(request.libraryQuery),
    getWorkflows(),
    request.includeLegacyAuthGovernanceSnapshot
      ? getWorkflowPublishedEndpointLegacyAuthGovernanceSnapshot()
      : Promise.resolve(null)
  ]);

  return {
    catalogToolCount: workflowLibrary.tools.length,
    governanceQueryScope: request.governanceQueryScope,
    legacyAuthGovernanceSnapshot,
    workflows,
    starters: workflowLibrary.starters,
    starterSourceLanes: workflowLibrary.starterSourceLanes,
    nodeCatalog: workflowLibrary.nodes,
    tools: workflowLibrary.tools
  };
}
