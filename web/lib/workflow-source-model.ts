import type { PluginToolRegistryItem } from "@/lib/get-plugin-registry";

export type WorkflowLibrarySourceKind = "starter" | "node" | "tool";
export type WorkflowLibrarySourceScope = "builtin" | "workspace" | "ecosystem";
export type WorkflowLibrarySourceStatus = "available" | "planned";
export type WorkflowLibrarySourceGovernance = "repo" | "workspace" | "adapter";

export type WorkflowLibrarySourceDescriptor = {
  kind: WorkflowLibrarySourceKind;
  scope: WorkflowLibrarySourceScope;
  status: WorkflowLibrarySourceStatus;
  governance: WorkflowLibrarySourceGovernance;
  ecosystem: string;
  label: string;
  shortLabel: string;
  summary: string;
};

export type WorkflowLibrarySourceLane = WorkflowLibrarySourceDescriptor & {
  count: number;
};

export const BUILTIN_STARTER_SOURCE: WorkflowLibrarySourceDescriptor = {
  kind: "starter",
  scope: "builtin",
  status: "available",
  governance: "repo",
  ecosystem: "native",
  label: "Builtin starter library",
  shortLabel: "7Flows builtin",
  summary: "仓库内置 starter，当前由代码库统一维护，是创建入口的真实来源。"
};

export const WORKSPACE_TEMPLATE_SOURCE: WorkflowLibrarySourceDescriptor = {
  kind: "starter",
  scope: "workspace",
  status: "planned",
  governance: "workspace",
  ecosystem: "workspace",
  label: "Workspace templates",
  shortLabel: "workspace planned",
  summary: "下一步接入工作空间级模板治理，让团队模板不再混进仓库内置 starter。"
};

export const ECOSYSTEM_TEMPLATE_SOURCE: WorkflowLibrarySourceDescriptor = {
  kind: "starter",
  scope: "ecosystem",
  status: "planned",
  governance: "adapter",
  ecosystem: "compat:*",
  label: "Ecosystem templates",
  shortLabel: "ecosystem planned",
  summary: "后续允许 compat / plugin 生态提供模板，但必须先经过来源治理和受约束建模。"
};

export const NATIVE_NODE_SOURCE: WorkflowLibrarySourceDescriptor = {
  kind: "node",
  scope: "builtin",
  status: "available",
  governance: "repo",
  ecosystem: "native",
  label: "Native node catalog",
  shortLabel: "native nodes",
  summary: "当前 palette 中的原生节点目录，由 7Flows 内部事实模型直接维护。"
};

export const TOOL_REGISTRY_SOURCE: WorkflowLibrarySourceDescriptor = {
  kind: "tool",
  scope: "builtin",
  status: "available",
  governance: "adapter",
  ecosystem: "native",
  label: "Tool registry",
  shortLabel: "tool registry",
  summary: "工具目录与节点目录分层存在，通过 registry 接回 editor 和 workflow 绑定链路。"
};

export function buildWorkflowLibrarySourceLane(
  source: WorkflowLibrarySourceDescriptor,
  count: number
): WorkflowLibrarySourceLane {
  return {
    ...source,
    count
  };
}

export function describePluginToolSource(
  tool: PluginToolRegistryItem
): WorkflowLibrarySourceDescriptor {
  if (tool.ecosystem.startsWith("compat:")) {
    return {
      kind: "tool",
      scope: "ecosystem",
      status: "available",
      governance: "adapter",
      ecosystem: tool.ecosystem,
      label: `${tool.ecosystem} tools`,
      shortLabel: tool.ecosystem,
      summary: "兼容层同步进来的工具目录项，后端已先压成受约束 IR 再进入 registry。"
    };
  }

  if (tool.source === "builtin") {
    return TOOL_REGISTRY_SOURCE;
  }

  return {
    kind: "tool",
    scope: "ecosystem",
    status: "available",
    governance: "adapter",
    ecosystem: tool.ecosystem,
    label: `${tool.ecosystem} plugin tools`,
    shortLabel: tool.source,
    summary: "通过插件目录暴露给 workflow 的工具入口，仍走统一 registry，而不是直连页面。"
  };
}

export function summarizePluginToolSources(
  tools: PluginToolRegistryItem[]
): WorkflowLibrarySourceLane[] {
  const summary = new Map<string, WorkflowLibrarySourceLane>();

  tools.forEach((tool) => {
    const source = describePluginToolSource(tool);
    const key = `${source.scope}:${source.ecosystem}:${source.shortLabel}`;
    const existing = summary.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    summary.set(key, buildWorkflowLibrarySourceLane(source, 1));
  });

  return Array.from(summary.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "zh-CN")
  );
}
