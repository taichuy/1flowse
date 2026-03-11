import {
  getWorkflowBusinessTrack,
  WORKFLOW_BUSINESS_TRACKS,
  type WorkflowBusinessTrack,
  type WorkflowBusinessTrackPriority
} from "@/lib/workflow-business-tracks";
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

export type WorkflowStarterId = "blank" | "agent" | "tooling" | "response";

export type WorkflowStarterTemplate = {
  id: WorkflowStarterId;
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
};

export type WorkflowStarterTrackItem = {
  id: WorkflowBusinessTrack;
  priority: WorkflowBusinessTrackPriority;
  summary: string;
  focus: string;
  starterCount: number;
  recommendedStarterId: WorkflowStarterId | null;
};

type WorkflowStarterBlueprint = {
  id: WorkflowStarterId;
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

export const WORKFLOW_STARTER_TEMPLATES: WorkflowStarterTemplate[] =
  WORKFLOW_STARTER_BLUEPRINTS.map((starter) => {
    const track = getWorkflowBusinessTrack(starter.businessTrack);

    return {
      id: starter.id,
      name: starter.name,
      description: starter.description,
      businessTrack: starter.businessTrack,
      priority: track.priority,
      trackSummary: track.summary,
      trackFocus: track.focus,
      defaultWorkflowName: starter.defaultWorkflowName,
      source: starter.source,
      workflowFocus: starter.workflowFocus,
      recommendedNextStep: starter.recommendedNextStep,
      nodeCount: starter.nodes.length,
      nodeLabels: starter.nodes.map(
        (node) => getWorkflowNodeCatalogItem(node.type)?.label ?? node.type
      ),
      tags: starter.tags
    };
  });

export const WORKFLOW_STARTER_SOURCE_LANES: WorkflowLibrarySourceLane[] = [
  buildWorkflowLibrarySourceLane(
    BUILTIN_STARTER_SOURCE,
    WORKFLOW_STARTER_TEMPLATES.filter(
      (starter) => starter.source.scope === BUILTIN_STARTER_SOURCE.scope
    ).length
  ),
  buildWorkflowLibrarySourceLane(WORKSPACE_TEMPLATE_SOURCE, 0),
  buildWorkflowLibrarySourceLane(ECOSYSTEM_TEMPLATE_SOURCE, 0)
];

export const WORKFLOW_STARTER_TRACKS: WorkflowStarterTrackItem[] =
  WORKFLOW_BUSINESS_TRACKS.map((track) => {
    const starters = WORKFLOW_STARTER_TEMPLATES.filter(
      (starter) => starter.businessTrack === track.id
    );

    return {
      id: track.id,
      priority: track.priority,
      summary: track.summary,
      focus: track.focus,
      starterCount: starters.length,
      recommendedStarterId: starters[0]?.id ?? null
    };
  });

export function buildWorkflowStarterDefinition(
  starterId: WorkflowStarterId
): WorkflowDefinition {
  const starter = readWorkflowStarterBlueprint(starterId);

  return {
    nodes: starter.nodes.map((node) => buildCatalogNodeDefinition(node)),
    edges: starter.edges.map((edge) => ({ ...edge })),
    variables: [],
    publish: []
  };
}

export function getWorkflowStarterTemplate(starterId: WorkflowStarterId) {
  return (
    WORKFLOW_STARTER_TEMPLATES.find((starter) => starter.id === starterId) ??
    WORKFLOW_STARTER_TEMPLATES[0]
  );
}

export function listWorkflowStarterTemplates(
  businessTrack?: WorkflowBusinessTrack | null
) {
  if (!businessTrack) {
    return WORKFLOW_STARTER_TEMPLATES;
  }

  return WORKFLOW_STARTER_TEMPLATES.filter(
    (starter) => starter.businessTrack === businessTrack
  );
}

function createEdge(id: string, sourceNodeId: string, targetNodeId: string) {
  return {
    id,
    sourceNodeId,
    targetNodeId,
    channel: "control" as const
  };
}

function readWorkflowStarterBlueprint(starterId: WorkflowStarterId) {
  return (
    WORKFLOW_STARTER_BLUEPRINTS.find((item) => item.id === starterId) ??
    WORKFLOW_STARTER_BLUEPRINTS[0]
  );
}
