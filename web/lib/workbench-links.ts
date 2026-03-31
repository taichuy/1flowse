function normalizeWorkbenchEntityId(entityId: string, entityLabel: string) {
  const normalized = entityId.trim();

  if (!normalized) {
    throw new Error(`Cannot build ${entityLabel} href without an id.`);
  }

  return normalized;
}

export const WORKFLOW_STUDIO_SURFACES = [
  "editor",
  "publish",
  "api",
  "logs",
  "monitor"
] as const;

export type WorkflowStudioSurface = (typeof WORKFLOW_STUDIO_SURFACES)[number];

export type WorkflowStudioSurfaceDefinition = {
  key: WorkflowStudioSurface;
  label: string;
  modeLabel: string;
  description: string;
};

const workflowStudioSurfaceDefinitions = [
  {
    key: "editor",
    label: "画布编排",
    modeLabel: "xyflow studio",
    description: "workflow canvas、节点编排与草稿编辑。"
  },
  {
    key: "publish",
    label: "发布治理",
    modeLabel: "publish governance",
    description: "published binding、鉴权与治理摘要。"
  },
  {
    key: "api",
    label: "访问 API",
    modeLabel: "api docs",
    description: "对外调用 contract、请求示例与团队对接入口。"
  },
  {
    key: "logs",
    label: "日志与标注",
    modeLabel: "运行日志",
    description: "运行追踪、节点日志与标注回看入口。"
  },
  {
    key: "monitor",
    label: "监测报表",
    modeLabel: "监测报表",
    description: "运行健康、报表与 follow-up 监测入口。"
  }
] satisfies WorkflowStudioSurfaceDefinition[];

export function getWorkflowStudioSurfaceDefinitions() {
  return workflowStudioSurfaceDefinitions;
}

export function getWorkflowStudioSurfaceDefinition(surface: WorkflowStudioSurface) {
  return (
    workflowStudioSurfaceDefinitions.find((item) => item.key === surface) ??
    workflowStudioSurfaceDefinitions[0]
  );
}

export function buildRunDetailHref(runId: string) {
  return `/runs/${encodeURIComponent(normalizeWorkbenchEntityId(runId, "run"))}`;
}

export function buildWorkflowStudioSurfaceHref(
  workflowId: string,
  surface: WorkflowStudioSurface = "editor"
) {
  return `/workflows/${encodeURIComponent(normalizeWorkbenchEntityId(workflowId, "workflow"))}/${surface}`;
}

export function buildWorkflowDetailHref(workflowId: string) {
  return `/workflows/${encodeURIComponent(normalizeWorkbenchEntityId(workflowId, "workflow"))}`;
}
