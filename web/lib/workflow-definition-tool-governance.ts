import type { PluginToolRegistryItem } from "@/lib/get-plugin-registry";
import type { WorkflowDefinition } from "@/lib/workflow-editor";
import {
  compareToolsByGovernance,
  getToolGovernanceSummary
} from "@/lib/tool-governance";

export type WorkflowDefinitionToolGovernance = {
  referencedToolIds: string[];
  referencedTools: PluginToolRegistryItem[];
  missingToolIds: string[];
  governedToolCount: number;
  strongIsolationToolCount: number;
};

const EMPTY_GOVERNANCE: WorkflowDefinitionToolGovernance = {
  referencedToolIds: [],
  referencedTools: [],
  missingToolIds: [],
  governedToolCount: 0,
  strongIsolationToolCount: 0
};

export function summarizeWorkflowDefinitionToolGovernance(
  definition: WorkflowDefinition,
  tools: PluginToolRegistryItem[]
): WorkflowDefinitionToolGovernance {
  if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) {
    return EMPTY_GOVERNANCE;
  }

  const referencedToolIds = collectReferencedToolIds(definition);
  if (referencedToolIds.length === 0) {
    return EMPTY_GOVERNANCE;
  }

  const toolIndex = new Map(tools.map((tool) => [tool.id, tool]));
  const referencedTools = referencedToolIds
    .map((toolId) => toolIndex.get(toolId) ?? null)
    .filter((tool): tool is PluginToolRegistryItem => tool !== null)
    .sort(compareToolsByGovernance);
  const missingToolIds = referencedToolIds.filter((toolId) => !toolIndex.has(toolId));

  return {
    referencedToolIds,
    referencedTools,
    missingToolIds,
    governedToolCount: referencedTools.filter(
      (tool) => getToolGovernanceSummary(tool).governedBySensitivity
    ).length,
    strongIsolationToolCount: referencedTools.filter(
      (tool) => getToolGovernanceSummary(tool).requiresStrongIsolationByDefault
    ).length
  };
}

function collectReferencedToolIds(definition: WorkflowDefinition): string[] {
  const referencedToolIds: string[] = [];
  const seen = new Set<string>();

  for (const node of definition.nodes ?? []) {
    const nodeConfig = isRecord(node.config) ? node.config : {};
    const toolConfig = isRecord(nodeConfig.tool) ? nodeConfig.tool : null;
    const directToolId =
      typeof toolConfig?.toolId === "string"
        ? toolConfig.toolId
        : typeof nodeConfig.toolId === "string"
          ? nodeConfig.toolId
          : null;
    pushToolId(directToolId, referencedToolIds, seen);

    const toolPolicy = isRecord(nodeConfig.toolPolicy) ? nodeConfig.toolPolicy : null;
    const allowedToolIds = Array.isArray(toolPolicy?.allowedToolIds)
      ? toolPolicy.allowedToolIds
      : [];
    for (const candidate of allowedToolIds) {
      pushToolId(candidate, referencedToolIds, seen);
    }
  }

  return referencedToolIds;
}

function pushToolId(value: unknown, referencedToolIds: string[], seen: Set<string>) {
  if (typeof value !== "string") {
    return;
  }
  const normalized = value.trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  referencedToolIds.push(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
