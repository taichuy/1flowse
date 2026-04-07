import { getWorkflowLibrarySnapshot } from "@/lib/get-workflow-library";
import { getWorkflows } from "@/lib/get-workflows";
import { getWorkflowPublishedEndpointLegacyAuthGovernanceSnapshot } from "@/lib/workflow-publish-client";
import {
  hasScopedWorkspaceStarterGovernanceFilters,
  type WorkspaceStarterGovernanceQueryScope
} from "@/lib/workspace-starter-governance-query";

import { ensureWorkflowCreateFallbackStarters } from "./fallback-starters";
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
  const resolvedWorkflowLibrary = ensureWorkflowCreateFallbackStarters({
    governanceQueryScope: request.governanceQueryScope,
    workflowLibrary
  });

  return {
    catalogToolCount: resolvedWorkflowLibrary.tools.length,
    governanceQueryScope: request.governanceQueryScope,
    legacyAuthGovernanceSnapshot,
    workflows,
    starters: resolvedWorkflowLibrary.starters,
    starterSourceLanes: resolvedWorkflowLibrary.starterSourceLanes,
    nodeCatalog: resolvedWorkflowLibrary.nodes,
    tools: resolvedWorkflowLibrary.tools
  };
}
