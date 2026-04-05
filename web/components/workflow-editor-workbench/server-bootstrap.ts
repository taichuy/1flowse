import type {
  PluginAdapterRegistryItem,
  PluginRegistrySnapshot,
  PluginToolRegistryItem
} from "@/lib/get-plugin-registry";
import type {
  WorkflowLibrarySnapshot,
  WorkflowLibrarySnapshotResponse
} from "@/lib/get-workflow-library";
import { normalizeWorkflowLibrarySnapshot } from "@/lib/get-workflow-library";
import type { WorkflowListItem } from "@/lib/get-workflows";
import type { WorkspaceModelProviderRegistryResponse } from "@/lib/model-provider-registry";
import { buildWorkspaceStarterTemplateQueryParams } from "@/lib/get-workspace-starters";
import { fetchServerWorkspaceAccessJson } from "@/lib/server-workspace-access";
import type { SystemOverview } from "@/lib/get-system-overview";

import type {
  WorkflowEditorWorkbenchBootstrapData,
  WorkflowEditorWorkbenchBootstrapRequest
} from "./types";

const EMPTY_WORKFLOW_LIBRARY_SNAPSHOT: WorkflowLibrarySnapshot = {
  nodes: [],
  starters: [],
  starterSourceLanes: [],
  nodeSourceLanes: [],
  toolSourceLanes: [],
  tools: []
};

const EMPTY_PLUGIN_REGISTRY_SNAPSHOT: PluginRegistrySnapshot = {
  adapters: [],
  tools: []
};

async function getServerWorkflowLibrarySnapshot() {
  const searchParams = buildWorkspaceStarterTemplateQueryParams({});
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

async function getServerPluginRegistrySnapshot(): Promise<PluginRegistrySnapshot> {
  const [adapters, tools] = await Promise.all([
    fetchServerWorkspaceAccessJson<PluginAdapterRegistryItem[]>("/api/plugins/adapters"),
    fetchServerWorkspaceAccessJson<PluginToolRegistryItem[]>("/api/plugins/tools")
  ]);

  return {
    adapters: adapters ?? EMPTY_PLUGIN_REGISTRY_SNAPSHOT.adapters,
    tools: tools ?? EMPTY_PLUGIN_REGISTRY_SNAPSHOT.tools
  };
}

async function getServerSystemOverview() {
  return fetchServerWorkspaceAccessJson<SystemOverview>("/api/system/overview");
}

async function getServerWorkspaceModelProviderRegistry() {
  return fetchServerWorkspaceAccessJson<WorkspaceModelProviderRegistryResponse>(
    "/api/workspace/model-providers"
  );
}

export async function loadServerWorkflowEditorWorkbenchBootstrap(
  _request: WorkflowEditorWorkbenchBootstrapRequest
): Promise<WorkflowEditorWorkbenchBootstrapData> {
  const [workflows, workflowLibrary, pluginRegistry, systemOverview, modelProviderRegistry] =
    await Promise.all([
      getServerWorkflows(),
      getServerWorkflowLibrarySnapshot(),
      getServerPluginRegistrySnapshot(),
      getServerSystemOverview(),
      getServerWorkspaceModelProviderRegistry()
    ]);

  return {
    workflows,
    nodeCatalog: workflowLibrary.nodes,
    nodeSourceLanes: workflowLibrary.nodeSourceLanes,
    toolSourceLanes: workflowLibrary.toolSourceLanes,
    tools: workflowLibrary.tools,
    adapters: pluginRegistry.adapters,
    callbackWaitingAutomation: systemOverview?.callback_waiting_automation ?? null,
    sandboxReadiness: systemOverview?.sandbox_readiness ?? null,
    sandboxBackends: systemOverview?.sandbox_backends ?? [],
    initialModelProviderCatalog: modelProviderRegistry?.catalog ?? [],
    initialModelProviderConfigs: modelProviderRegistry?.items ?? [],
    initialModelProviderRegistryStatus: modelProviderRegistry ? "ready" : "error"
  };
}
