export type WorkflowBusinessTrack =
  | "应用新建编排"
  | "编排节点能力"
  | "Dify 插件兼容"
  | "API 调用开放";

export type WorkflowBusinessTrackPriority = "P0" | "P1" | "P2" | "P3";

export type WorkflowBusinessTrackDefinition = {
  id: WorkflowBusinessTrack;
  priority: WorkflowBusinessTrackPriority;
  summary: string;
  focus: string;
};

export const WORKFLOW_BUSINESS_TRACKS: WorkflowBusinessTrackDefinition[] = [
  {
    id: "应用新建编排",
    priority: "P0",
    summary: "先把新建入口、starter 模板和草稿创建链路做成可持续扩展的业务入口。",
    focus: "从 starter template 进入 workflow definition，而不是回到手写 JSON。"
  },
  {
    id: "编排节点能力",
    priority: "P1",
    summary: "继续补高频节点的结构化配置，让画布真正承载主业务表达。",
    focus: "优先围绕 LLM Agent、条件分支、上下文授权和输出结构推进。"
  },
  {
    id: "Dify 插件兼容",
    priority: "P2",
    summary: "把外部插件先压成受约束 IR，再进入目录、绑定和运行时链路。",
    focus: "兼容层要可启停、可分类、可追溯，不能反向主导核心模型。"
  },
  {
    id: "API 调用开放",
    priority: "P3",
    summary: "围绕 output 与发布语义组织 workflow，为后续开放调用做准备。",
    focus: "先把响应整形和发布边界设计清楚，再继续推进协议映射。"
  }
];

const WORKFLOW_BUSINESS_TRACK_MAP = new Map(
  WORKFLOW_BUSINESS_TRACKS.map((track) => [track.id, track])
);

export function getWorkflowBusinessTrack(track: WorkflowBusinessTrack) {
  return WORKFLOW_BUSINESS_TRACK_MAP.get(track) ?? WORKFLOW_BUSINESS_TRACKS[0];
}
