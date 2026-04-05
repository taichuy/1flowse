import type {
  WorkflowLibrarySnapshot,
  WorkflowLibrarySnapshotResponse
} from "@/lib/get-workflow-library";
import { normalizeWorkflowLibrarySnapshot } from "@/lib/get-workflow-library";
import type { WorkflowListItem } from "@/lib/get-workflows";
import { buildWorkspaceStarterTemplateQueryParams } from "@/lib/get-workspace-starters";
import { fetchServerWorkspaceAccessJson } from "@/lib/server-workspace-access";
import type { WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot } from "@/lib/workflow-publish-types";

import type {
  WorkflowCreateWizardBootstrapRequest,
  WorkflowCreateWizardProps
} from "./types";

const EMPTY_WORKFLOW_LIBRARY_SNAPSHOT: WorkflowLibrarySnapshot = {
  nodes: [],
  starters: [],
  starterSourceLanes: [],
  nodeSourceLanes: [],
  toolSourceLanes: [],
  tools: []
};

async function getServerWorkflowLibrarySnapshot(
  request: WorkflowCreateWizardBootstrapRequest["libraryQuery"]
) {
  const searchParams = buildWorkspaceStarterTemplateQueryParams({
    businessTrack: request.businessTrack,
    search: request.search,
    sourceGovernanceKind: request.sourceGovernanceKind,
    needsFollowUp: request.needsFollowUp
  });

  if (!request.includeBuiltinStarters) {
    searchParams.set("include_builtin_starters", "false");
  }

  if (request.includeStarterDefinitions) {
    searchParams.set("include_starter_definitions", "true");
  }

  const response = await fetchServerWorkspaceAccessJson<WorkflowLibrarySnapshotResponse>(
    `/api/workflow-library?${searchParams.toString()}`
  );

  return response
    ? normalizeWorkflowLibrarySnapshot(response)
    : EMPTY_WORKFLOW_LIBRARY_SNAPSHOT;
}

async function getServerWorkflows() {
  return (await fetchServerWorkspaceAccessJson<WorkflowListItem[]>("/api/workflows")) ?? [];
}

async function getServerLegacyAuthGovernanceSnapshot() {
  return fetchServerWorkspaceAccessJson<WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot>(
    "/api/workflows/published-endpoints/legacy-auth-governance"
  );
}

export async function loadServerWorkflowCreateWizardBootstrap(
  request: WorkflowCreateWizardBootstrapRequest
): Promise<WorkflowCreateWizardProps> {
  const [workflowLibrary, workflows, legacyAuthGovernanceSnapshot] = await Promise.all([
    getServerWorkflowLibrarySnapshot(request.libraryQuery),
    getServerWorkflows(),
    request.includeLegacyAuthGovernanceSnapshot
      ? getServerLegacyAuthGovernanceSnapshot()
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
