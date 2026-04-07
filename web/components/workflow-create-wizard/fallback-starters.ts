import type {
  WorkflowLibrarySnapshot,
  WorkflowLibrarySourceDescriptor,
  WorkflowLibrarySourceLane,
  WorkflowLibraryStarterItem
} from "@/lib/get-workflow-library";
import type { WorkspaceStarterGovernanceQueryScope } from "@/lib/workspace-starter-governance-query";

const BLANK_WORKFLOW_STARTER_ID = "blank";

const BUILTIN_STARTER_SOURCE: WorkflowLibrarySourceDescriptor = {
  kind: "starter",
  scope: "builtin",
  status: "available",
  governance: "repo",
  ecosystem: "native",
  label: "Builtin starters",
  shortLabel: "builtin",
  summary: "内置 starter 直接随仓库下发，可在工作台创建时兜底。"
};

export function ensureWorkflowCreateFallbackStarters({
  governanceQueryScope,
  workflowLibrary
}: {
  governanceQueryScope: WorkspaceStarterGovernanceQueryScope;
  workflowLibrary: WorkflowLibrarySnapshot;
}): WorkflowLibrarySnapshot {
  if (workflowLibrary.starters.length > 0) {
    return workflowLibrary;
  }

  if (governanceQueryScope.selectedTemplateId !== BLANK_WORKFLOW_STARTER_ID) {
    return workflowLibrary;
  }

  return {
    ...workflowLibrary,
    starters: [buildBlankWorkflowStarterFallback()],
    starterSourceLanes: upsertBuiltinStarterLane(workflowLibrary.starterSourceLanes)
  };
}

export function buildBlankWorkflowStarterFallback(): WorkflowLibraryStarterItem {
  return {
    id: BLANK_WORKFLOW_STARTER_ID,
    origin: "builtin",
    name: "Blank Flow",
    description: "保留最小 startNode -> endNode 骨架，适合从零开始搭应用入口。",
    businessTrack: "应用新建编排",
    defaultWorkflowName: "Blank Workflow",
    workflowFocus: "先生成一个真实可保存、可运行、可继续扩展的最小 workflow 草稿。",
    recommendedNextStep: "进入画布后优先补应用命名、首个业务节点和基础输出格式。",
    tags: ["最小骨架", "可立即运行", "适合打草稿"],
    nodeCount: 2,
    nodeTypes: ["startNode", "endNode"],
    publishCount: 0,
    definition: {
      nodes: [
        {
          id: "startNode",
          type: "startNode",
          name: "startNode",
          config: {
            ui: {
              position: { x: 140, y: 220 }
            }
          }
        },
        {
          id: "endNode",
          type: "endNode",
          name: "endNode",
          config: {
            format: "json",
            ui: {
              position: { x: 520, y: 220 }
            }
          }
        }
      ],
      edges: [
        {
          id: "edge_startNode_endNode",
          sourceNodeId: "startNode",
          targetNodeId: "endNode",
          channel: "control"
        }
      ],
      variables: [],
      publish: []
    },
    source: BUILTIN_STARTER_SOURCE,
    archived: false,
    sourceGovernance: null,
    toolGovernance: null
  };
}

function upsertBuiltinStarterLane(
  lanes: WorkflowLibrarySourceLane[]
): WorkflowLibrarySourceLane[] {
  const nextLanes = lanes.map((lane) => ({ ...lane }));
  const builtinLaneIndex = nextLanes.findIndex(
    (lane) => lane.kind === "starter" && lane.scope === "builtin"
  );

  if (builtinLaneIndex >= 0) {
    nextLanes[builtinLaneIndex] = {
      ...nextLanes[builtinLaneIndex],
      count: Math.max(1, nextLanes[builtinLaneIndex].count)
    };
    return nextLanes;
  }

  return [{ ...BUILTIN_STARTER_SOURCE, count: 1 }, ...nextLanes];
}
