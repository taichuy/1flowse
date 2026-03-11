import {
  getWorkflowBusinessTrack,
  WORKFLOW_BUSINESS_TRACKS,
  type WorkflowBusinessTrack,
  type WorkflowBusinessTrackPriority
} from "@/lib/workflow-business-tracks";
import type { WorkspaceStarterTemplateItem } from "@/lib/get-workspace-starters";
import {
  buildCatalogNodeDefinition,
  getWorkflowNodeCatalogItem,
  type WorkflowNodeType
} from "@/lib/workflow-node-catalog";
import {
  buildWorkflowLibrarySourceLane,
  BUILTIN_STARTER_SOURCE,
  ECOSYSTEM_TEMPLATE_SOURCE,
  WORKSPACE_TEMPLATE_SOURCE,
  type WorkflowLibrarySourceDescriptor,
  type WorkflowLibrarySourceLane
} from "@/lib/workflow-source-model";
import type { WorkflowDefinition } from "@/lib/workflow-editor";

export type WorkflowStarterTemplateId = string;
export type BuiltinWorkflowStarterId = "blank" | "agent" | "tooling" | "response";

export type WorkflowStarterTemplate = {
  id: WorkflowStarterTemplateId;
  origin: "builtin" | "workspace";
  name: string;
  description: string;
  businessTrack: WorkflowBusinessTrack;
  priority: WorkflowBusinessTrackPriority;
  trackSummary: string;
  trackFocus: string;
  defaultWorkflowName: string;
  source: WorkflowLibrarySourceDescriptor;
  workflowFocus: string;
  recommendedNextStep: string;
  nodeCount: number;
  nodeLabels: string[];
  tags: string[];
  definition: WorkflowDefinition;
};

export type WorkflowStarterTrackItem = {
  id: WorkflowBusinessTrack;
  priority: WorkflowBusinessTrackPriority;
  summary: string;
  focus: string;
  starterCount: number;
  recommendedStarterId: WorkflowStarterTemplateId | null;
};

type WorkflowStarterBlueprint = {
  id: BuiltinWorkflowStarterId;
  name: string;
  description: string;
  businessTrack: WorkflowBusinessTrack;
  defaultWorkflowName: string;
  source: WorkflowLibrarySourceDescriptor;
  workflowFocus: string;
  recommendedNextStep: string;
  tags: string[];
  nodes: Array<{
    id: string;
    type: WorkflowNodeType;
    name?: string;
    position?: { x: number; y: number };
    config?: Record<string, unknown>;
  }>;
  edges: NonNullable<WorkflowDefinition["edges"]>;
};

const WORKFLOW_STARTER_BLUEPRINTS: WorkflowStarterBlueprint[] = [
  {
    id: "blank",
    name: "Blank Flow",
    description: "保留最小 trigger -> output 骨架，适合从零开始搭应用入口。",
    businessTrack: "应用新建编排",
    defaultWorkflowName: "Blank Workflow",
    source: BUILTIN_STARTER_SOURCE,
    workflowFocus: "先生成一个真实可保存、可运行、可继续扩展的最小 workflow 草稿。",
    recommendedNextStep: "进入画布后优先补应用命名、首个业务节点和基础输出格式。",
    tags: ["最小骨架", "可立即运行", "适合打草稿"],
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 140, y: 220 }
      },
      {
        id: "output",
        type: "output",
        position: { x: 520, y: 220 }
      }
    ],
    edges: [createEdge("edge_trigger_output", "trigger", "output")]
  },
  {
    id: "agent",
    name: "Agent Draft",
    description: "预留一个 LLM Agent 节点，方便继续补提示词、上下文授权和输出结构。",
    businessTrack: "编排节点能力",
    defaultWorkflowName: "Agent Workflow",
    source: BUILTIN_STARTER_SOURCE,
    workflowFocus: "把高频 Agent 节点先放进画布，继续往角色、上下文和结构化输出推进。",
    recommendedNextStep: "继续补 LLM Agent 的结构化配置和 output 节点的结果约束。",
    tags: ["LLM Agent", "多 Agent 起点", "便于继续扩节点"],
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 100, y: 220 }
      },
      {
        id: "agent",
        type: "llm_agent",
        name: "Planner Agent",
        position: { x: 420, y: 220 },
        config: {
          prompt: "Describe how this agent should respond.",
          role: "planner"
        }
      },
      {
        id: "output",
        type: "output",
        position: { x: 760, y: 220 },
        config: {
          format: "text"
        }
      }
    ],
    edges: [
      createEdge("edge_trigger_agent", "trigger", "agent"),
      createEdge("edge_agent_output", "agent", "output")
    ]
  },
  {
    id: "tooling",
    name: "Tool Pipeline",
    description: "预留一个 tool 节点，创建后即可在编辑器里绑定 catalog tool 或 compat tool。",
    businessTrack: "Dify 插件兼容",
    defaultWorkflowName: "Tool Workflow",
    source: BUILTIN_STARTER_SOURCE,
    workflowFocus: "先把工具节点纳入编排主线，再接目录绑定、compat adapter 和外部生态。",
    recommendedNextStep: "创建后优先绑定一个 catalog tool，再继续补 adapter 与输入 schema。",
    tags: ["工具节点", "插件目录", "compat 入口"],
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 100, y: 220 }
      },
      {
        id: "tool",
        type: "tool",
        name: "Tool Node",
        position: { x: 420, y: 220 },
        config: {
          notes: "Bind a catalog tool from the inspector after creation."
        }
      },
      {
        id: "output",
        type: "output",
        position: { x: 760, y: 220 }
      }
    ],
    edges: [
      createEdge("edge_trigger_tool", "trigger", "tool"),
      createEdge("edge_tool_output", "tool", "output")
    ]
  },
  {
    id: "response",
    name: "Response Draft",
    description: "围绕 output 响应整形预留一个最小 API-ready 草稿，方便后续接发布配置。",
    businessTrack: "API 调用开放",
    defaultWorkflowName: "Response Workflow",
    source: BUILTIN_STARTER_SOURCE,
    workflowFocus: "先把响应结构、输出格式和发布前的最终结果整形组织在 workflow 内部。",
    recommendedNextStep: "继续在编辑器里补 output schema、发布配置和协议映射策略。",
    tags: ["响应整形", "发布准备", "output 优先"],
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 100, y: 220 }
      },
      {
        id: "agent",
        type: "llm_agent",
        name: "Response Agent",
        position: { x: 420, y: 220 },
        config: {
          prompt: "Return a response that is ready for an API-facing output node.",
          role: "responder"
        }
      },
      {
        id: "output",
        type: "output",
        position: { x: 760, y: 220 },
        config: {
          format: "json",
          responseMode: "sync"
        }
      }
    ],
    edges: [
      createEdge("edge_trigger_response_agent", "trigger", "agent"),
      createEdge("edge_response_agent_output", "agent", "output")
    ]
  }
];

export const BUILTIN_WORKFLOW_STARTER_TEMPLATES: WorkflowStarterTemplate[] =
  WORKFLOW_STARTER_BLUEPRINTS.map((starter) =>
    buildWorkflowStarterTemplate({
      id: starter.id,
      origin: "builtin",
      name: starter.name,
      description: starter.description,
      businessTrack: starter.businessTrack,
      defaultWorkflowName: starter.defaultWorkflowName,
      source: starter.source,
      workflowFocus: starter.workflowFocus,
      recommendedNextStep: starter.recommendedNextStep,
      tags: starter.tags,
      definition: {
        nodes: starter.nodes.map((node) => buildCatalogNodeDefinition(node)),
        edges: starter.edges.map((edge) => ({ ...edge })),
        variables: [],
        publish: []
      }
    })
  );

export function combineWorkflowStarterTemplates(
  workspaceTemplates: WorkspaceStarterTemplateItem[]
) {
  return [
    ...BUILTIN_WORKFLOW_STARTER_TEMPLATES,
    ...workspaceTemplates.map(buildWorkspaceWorkflowStarterTemplate)
  ];
}

export function buildWorkflowStarterTracks(
  starters: WorkflowStarterTemplate[]
): WorkflowStarterTrackItem[] {
  return WORKFLOW_BUSINESS_TRACKS.map((track) => {
    const trackStarters = starters.filter(
      (starter) => starter.businessTrack === track.id
    );

    return {
      id: track.id,
      priority: track.priority,
      summary: track.summary,
      focus: track.focus,
      starterCount: trackStarters.length,
      recommendedStarterId: trackStarters[0]?.id ?? null
    };
  });
}

export function buildWorkflowStarterSourceLanes(
  starters: WorkflowStarterTemplate[]
): WorkflowLibrarySourceLane[] {
  return [
    buildWorkflowLibrarySourceLane(
      BUILTIN_STARTER_SOURCE,
      starters.filter((starter) => starter.origin === "builtin").length
    ),
    buildWorkflowLibrarySourceLane(
      {
        ...WORKSPACE_TEMPLATE_SOURCE,
        status: starters.some((starter) => starter.origin === "workspace")
          ? "available"
          : WORKSPACE_TEMPLATE_SOURCE.status,
        shortLabel: starters.some((starter) => starter.origin === "workspace")
          ? "workspace ready"
          : WORKSPACE_TEMPLATE_SOURCE.shortLabel,
        summary: starters.some((starter) => starter.origin === "workspace")
          ? "工作空间模板已进入真实存储与读取链路，可从 editor 保存并回到创建页复用。"
          : WORKSPACE_TEMPLATE_SOURCE.summary
      },
      starters.filter((starter) => starter.origin === "workspace").length
    ),
    buildWorkflowLibrarySourceLane(ECOSYSTEM_TEMPLATE_SOURCE, 0)
  ];
}

export function inferWorkflowBusinessTrack(
  definition: WorkflowDefinition
): WorkflowBusinessTrack {
  const nodeTypes = new Set(
    (definition.nodes ?? [])
      .map((node) => (typeof node.type === "string" ? node.type : ""))
      .filter(Boolean)
  );
  const publishCount = Array.isArray(definition.publish) ? definition.publish.length : 0;
  const outputNodes = (definition.nodes ?? []).filter((node) => node.type === "output");

  if (
    publishCount > 0 ||
    outputNodes.some((node) => typeof node.config?.responseMode === "string")
  ) {
    return "API 调用开放";
  }

  if (nodeTypes.has("tool")) {
    return "Dify 插件兼容";
  }

  if (
    nodeTypes.has("llm_agent") ||
    nodeTypes.has("mcp_query") ||
    nodeTypes.has("condition") ||
    nodeTypes.has("router")
  ) {
    return "编排节点能力";
  }

  return "应用新建编排";
}

function buildWorkspaceWorkflowStarterTemplate(
  template: WorkspaceStarterTemplateItem
): WorkflowStarterTemplate {
  return buildWorkflowStarterTemplate({
    id: template.id,
    origin: "workspace",
    name: template.name,
    description: template.description,
    businessTrack: template.business_track,
    defaultWorkflowName: template.default_workflow_name,
    source: {
      ...WORKSPACE_TEMPLATE_SOURCE,
      status: "available",
      shortLabel: "workspace ready",
      summary: "工作空间模板已落到后端真实数据源，可作为团队 starter 持续复用。"
    },
    workflowFocus: template.workflow_focus,
    recommendedNextStep: template.recommended_next_step,
    tags: template.tags,
    definition: normalizeWorkflowDefinition(template.definition)
  });
}

function buildWorkflowStarterTemplate(input: {
  id: WorkflowStarterTemplateId;
  origin: WorkflowStarterTemplate["origin"];
  name: string;
  description: string;
  businessTrack: WorkflowBusinessTrack;
  defaultWorkflowName: string;
  source: WorkflowLibrarySourceDescriptor;
  workflowFocus: string;
  recommendedNextStep: string;
  tags: string[];
  definition: WorkflowDefinition;
}): WorkflowStarterTemplate {
  const track = getWorkflowBusinessTrack(input.businessTrack);
  const definition = normalizeWorkflowDefinition(input.definition);
  const nodeTypes = (definition.nodes ?? []).map((node) => node.type);

  return {
    id: input.id,
    origin: input.origin,
    name: input.name,
    description: input.description,
    businessTrack: input.businessTrack,
    priority: track.priority,
    trackSummary: track.summary,
    trackFocus: track.focus,
    defaultWorkflowName: input.defaultWorkflowName,
    source: input.source,
    workflowFocus: input.workflowFocus,
    recommendedNextStep: input.recommendedNextStep,
    nodeCount: definition.nodes?.length ?? 0,
    nodeLabels: nodeTypes.map(
      (nodeType) => getWorkflowNodeCatalogItem(nodeType)?.label ?? nodeType
    ),
    tags: input.tags,
    definition
  };
}

function normalizeWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    nodes: Array.isArray(definition.nodes)
      ? definition.nodes.map((node) => ({
          ...node,
          config: isRecord(node.config) ? { ...node.config } : {}
        }))
      : [],
    edges: Array.isArray(definition.edges)
      ? definition.edges.map((edge) => ({ ...edge }))
      : [],
    variables: Array.isArray(definition.variables)
      ? definition.variables.map((variable) => ({ ...variable }))
      : [],
    publish: Array.isArray(definition.publish)
      ? definition.publish.map((endpoint) => ({ ...endpoint }))
      : []
  };
}

function createEdge(id: string, sourceNodeId: string, targetNodeId: string) {
  return {
    id,
    sourceNodeId,
    targetNodeId,
    channel: "control" as const
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
