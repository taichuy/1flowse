import type {
  PluginAdapterRegistryItem,
  PluginToolRegistryItem
} from "@/lib/get-plugin-registry";
import type { WorkflowDefinition } from "@/lib/workflow-editor";
import {
  buildExecutionCapabilityIssue,
  extractExplicitExecutionClass,
  isAdapterVisible,
  validateExplicitAdapterBinding
} from "@/lib/workflow-tool-execution-validation-helpers";
import type {
  WorkflowToolExecutionValidationContext,
  WorkflowToolExecutionValidationIssue
} from "@/lib/workflow-tool-execution-validation-types";

export type { WorkflowToolExecutionValidationIssue } from "@/lib/workflow-tool-execution-validation-types";

export function buildWorkflowToolExecutionValidationIssues(
  definition: WorkflowDefinition,
  tools: PluginToolRegistryItem[],
  adapters: PluginAdapterRegistryItem[],
  workspaceId = "default"
): WorkflowToolExecutionValidationIssue[] {
  if (!Array.isArray(definition?.nodes) || tools.length === 0) {
    return [];
  }

  const toolIndex = new Map(tools.map((tool) => [tool.id, tool]));
  const visibleAdapters = adapters.filter((adapter) => isAdapterVisible(adapter, workspaceId));
  const issues: WorkflowToolExecutionValidationIssue[] = [];

  definition.nodes.forEach((node, nodeIndex) => {
    const nodeId = typeof node?.id === "string" && node.id.trim() ? node.id.trim() : "unknown-node";
    const nodeName =
      typeof node?.name === "string" && node.name.trim() ? node.name.trim() : nodeId;
    const config = toRecord(node?.config);
    if (!config) {
      return;
    }

    if (node?.type === "tool") {
      issues.push(
        ...buildToolNodeExecutionIssues({
          node,
          nodeId,
          nodeName,
          nodeIndex,
          config,
          toolIndex,
          adapters: visibleAdapters
        })
      );
      return;
    }

    if (node?.type === "llm_agent") {
      issues.push(
        ...buildAgentExecutionIssues({
          nodeId,
          nodeName,
          nodeIndex,
          config,
          toolIndex,
          adapters: visibleAdapters
        })
      );
    }
  });

  const dedupedIssues: WorkflowToolExecutionValidationIssue[] = [];
  issues.forEach((issue) => {
    if (!dedupedIssues.some((candidate) => candidate.message === issue.message)) {
      dedupedIssues.push(issue);
    }
  });
  return dedupedIssues;
}

function buildToolNodeExecutionIssues({
  node,
  nodeId,
  nodeName,
  nodeIndex,
  config,
  toolIndex,
  adapters
}: WorkflowToolExecutionValidationContext & {
  node: { runtimePolicy?: unknown };
}): WorkflowToolExecutionValidationIssue[] {
  const binding = toRecord(config.tool);
  const toolId = normalizeString(binding?.toolId ?? config.toolId);
  const ecosystem = normalizeString(binding?.ecosystem);
  const adapterId = normalizeString(binding?.adapterId);
  if (!toolId) {
    return [];
  }

  const tool = toolIndex.get(toolId);
  if (!tool) {
    return [];
  }

  const issues: WorkflowToolExecutionValidationIssue[] = [];
  if (adapterId) {
    const adapterIssue = validateExplicitAdapterBinding({
      context: `Tool 节点 ${nodeName} (${nodeId})`,
      toolId,
      ecosystem: ecosystem ?? tool.ecosystem,
      adapterId,
      adapters,
      path: `nodes.${nodeIndex}.config.tool.adapterId`,
      field: "adapterId",
      nodeId,
      nodeName
    });
    if (adapterIssue) {
      issues.push(adapterIssue);
      return issues;
    }
  }

  const requestedExecutionClass = extractExplicitExecutionClass(
    toRecord(node?.runtimePolicy)?.execution
  );
  if (!requestedExecutionClass) {
    return issues;
  }

  const capabilityIssue = buildExecutionCapabilityIssue({
    context: `Tool 节点 ${nodeName} (${nodeId})`,
    nodeId,
    nodeName,
    toolId,
    tool,
    ecosystem,
    adapterId,
    requestedExecutionClass,
    adapters,
    path: `nodes.${nodeIndex}.runtimePolicy.execution`,
    field: "execution"
  });
  if (capabilityIssue) {
    issues.push(capabilityIssue);
  }
  return issues;
}

function buildAgentExecutionIssues({
  nodeId,
  nodeName,
  nodeIndex,
  config,
  toolIndex,
  adapters
}: WorkflowToolExecutionValidationContext): WorkflowToolExecutionValidationIssue[] {
  const issues: WorkflowToolExecutionValidationIssue[] = [];
  const toolPolicy = toRecord(config.toolPolicy);
  const mockPlan = toRecord(config.mockPlan);

  const policyExecutionClass = extractExplicitExecutionClass(toolPolicy?.execution);
  if (toolPolicy && Array.isArray(toolPolicy.allowedToolIds) && policyExecutionClass) {
    const seen = new Set<string>();
    toolPolicy.allowedToolIds.forEach((item) => {
      const toolId = normalizeString(item);
      if (!toolId || seen.has(toolId)) {
        return;
      }
      seen.add(toolId);

      const tool = toolIndex.get(toolId);
      if (!tool) {
        return;
      }

      const capabilityIssue = buildExecutionCapabilityIssue({
        context: `LLM Agent 节点 ${nodeName} (${nodeId}) 的 toolPolicy.allowedToolIds`,
        nodeId,
        nodeName,
        toolId,
        tool,
        ecosystem: tool.ecosystem,
        adapterId: null,
        requestedExecutionClass: policyExecutionClass,
        adapters,
        path: `nodes.${nodeIndex}.config.toolPolicy.execution`,
        field: "execution"
      });
      if (capabilityIssue) {
        issues.push(capabilityIssue);
      }
    });
  }

  if (mockPlan && Array.isArray(mockPlan.toolCalls)) {
    mockPlan.toolCalls.forEach((rawToolCall, index) => {
      const toolCall = toRecord(rawToolCall);
      if (!toolCall) {
        return;
      }

      const toolId = normalizeString(toolCall.toolId);
      if (!toolId) {
        return;
      }

      const tool = toolIndex.get(toolId);
      if (!tool) {
        return;
      }

      const ecosystem = normalizeString(toolCall.ecosystem);
      const adapterId = normalizeString(toolCall.adapterId);
      if (adapterId) {
        const adapterIssue = validateExplicitAdapterBinding({
          context: `LLM Agent 节点 ${nodeName} (${nodeId}) 的 mockPlan.toolCalls[${index + 1}]`,
          toolId,
          ecosystem: ecosystem ?? tool.ecosystem,
          adapterId,
          adapters,
          path: `nodes.${nodeIndex}.config.mockPlan.toolCalls.${index}.adapterId`,
          field: "adapterId",
          nodeId,
          nodeName
        });
        if (adapterIssue) {
          issues.push(adapterIssue);
          return;
        }
      }

      const requestedExecutionClass = extractExplicitExecutionClass(toolCall.execution);
      if (!requestedExecutionClass) {
        return;
      }

      const capabilityIssue = buildExecutionCapabilityIssue({
        context: `LLM Agent 节点 ${nodeName} (${nodeId}) 的 mockPlan.toolCalls[${index + 1}]`,
        nodeId,
        nodeName,
        toolId,
        tool,
        ecosystem,
        adapterId,
        requestedExecutionClass,
        adapters,
        path: `nodes.${nodeIndex}.config.mockPlan.toolCalls.${index}.execution`,
        field: "execution"
      });
      if (capabilityIssue) {
        issues.push(capabilityIssue);
      }
    });
  }

  return issues;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
