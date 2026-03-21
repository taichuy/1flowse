import type { WorkflowDetail } from "@/lib/get-workflows";
import type { WorkflowBusinessTrack } from "@/lib/workflow-business-tracks";

export function buildWorkspaceStarterPayload({
  workflowId,
  workflowName,
  workflowVersion,
  businessTrack,
  definition
}: {
  workflowId: string;
  workflowName: string;
  workflowVersion: string;
  businessTrack: WorkflowBusinessTrack;
  definition: WorkflowDetail["definition"];
}) {
  const trackMeta = {
    "应用新建编排": {
      description: "来自 editor 的最小可复用 workflow 入口草稿。",
      workflowFocus: "把团队常用的应用创建骨架沉淀成可持续复用的 workspace starter。",
      recommendedNextStep: "回到创建页验证模板入口，再继续补业务节点和输出约束。"
    },
    "编排节点能力": {
      description: "来自 editor 的节点编排样板，可继续补 Agent、Sandbox Code、分支和上下文授权。",
      workflowFocus: "把当前 workflow 中较成熟的高频节点组合沉淀成团队级 starter。",
      recommendedNextStep: "继续结构化高频节点配置与执行策略，再复用到新的业务流程里。"
    },
    "Dify 插件兼容": {
      description: "来自 editor 的工具/兼容链路草稿，适合作为插件能力复用入口。",
      workflowFocus: "优先复用 tool 节点、目录绑定和 compat adapter 相关结构。",
      recommendedNextStep: "从创建页复用后继续验证 tool binding 与插件目录链路。"
    },
    "API 调用开放": {
      description: "来自 editor 的输出/发布准备草稿，适合作为 API-ready workflow 起点。",
      workflowFocus: "围绕 output、响应格式和后续发布配置保留可复用起点。",
      recommendedNextStep: "继续补 output schema、发布配置与协议映射。"
    }
  }[businessTrack];

  return {
    workspace_id: "default",
    name: `${workflowName} Template`,
    description: trackMeta.description,
    business_track: businessTrack,
    default_workflow_name: workflowName,
    workflow_focus: trackMeta.workflowFocus,
    recommended_next_step: trackMeta.recommendedNextStep,
    tags: ["workspace starter", "editor saved", businessTrack],
    definition,
    created_from_workflow_id: workflowId,
    created_from_workflow_version: workflowVersion
  };
}
