"use client";

import { useMemo, useState } from "react";
import { Button, Card, Empty, Modal, Select, Tag, Typography } from "antd";

import type { WorkflowNodeCatalogItem } from "@/lib/get-workflow-library";
import type {
  PluginAdapterRegistryItem,
  PluginToolRegistryItem
} from "@/lib/get-plugin-registry";
import {
  getModelProviderProtocolLabel,
  resolveNativeModelProviderCatalog,
  type NativeModelProviderCatalogItem,
  type WorkspaceModelProviderConfigItem
} from "@/lib/model-provider-registry";
import { sortWorkflowNodeCatalogForAuthoring } from "@/lib/workflow-node-catalog";

const { Paragraph, Text, Title } = Typography;

const SPOTLIGHT_NODE_TYPES = [
  "llmAgentNode",
  "referenceNode",
  "toolNode",
  "mcpQueryNode",
  "sandboxCodeNode"
] as const;

type ToolSourceFilter = "native" | "dify";

type WorkspaceToolsDetailState =
  | {
      kind: "node";
      nodeType: string;
    }
  | {
      kind: "provider";
      providerId: string;
    }
  | {
      kind: "toolNode";
      toolId: string;
      toolSource: ToolSourceFilter;
    };

type WorkspaceToolsHubProps = {
  handoff: {
    returnHref: string | null;
    workflowId: string | null;
    workflowSurfaceLabel: string | null;
  };
  nodeCatalog: WorkflowNodeCatalogItem[];
  providerCatalog: NativeModelProviderCatalogItem[];
  providerConfigs: WorkspaceModelProviderConfigItem[];
  providerRegistryState: {
    kind: "ready" | "restricted" | "error";
    message: string | null;
  };
  providerManageHref: string | null;
  nativeTools: PluginToolRegistryItem[];
  pluginTools: PluginToolRegistryItem[];
  pluginAdapters: PluginAdapterRegistryItem[];
  pluginGovernanceHref: string;
  initialToolSource?: ToolSourceFilter;
  initialDetailState?: WorkspaceToolsDetailState | null;
};

const TOOL_SOURCE_OPTIONS = [
  {
    label: "7Flows 原生",
    value: "native"
  },
  {
    label: "Dify 插件",
    value: "dify"
  }
] as const satisfies Array<{ label: string; value: ToolSourceFilter }>;

export function WorkspaceToolsHub({
  handoff,
  nodeCatalog,
  providerCatalog,
  providerConfigs,
  providerRegistryState,
  providerManageHref,
  nativeTools,
  pluginTools,
  pluginAdapters,
  pluginGovernanceHref,
  initialToolSource = "native",
  initialDetailState = null
}: WorkspaceToolsHubProps) {
  const [toolSource, setToolSource] = useState<ToolSourceFilter>(initialToolSource);
  const [detailState, setDetailState] = useState<WorkspaceToolsDetailState | null>(
    initialDetailState
  );
  const resolvedProviderCatalog = useMemo(
    () => resolveNativeModelProviderCatalog(providerCatalog),
    [providerCatalog]
  );
  const spotlightNodes = useMemo(() => buildSpotlightNodeCatalog(nodeCatalog), [nodeCatalog]);
  const toolRegistryItems = toolSource === "native" ? nativeTools : pluginTools;
  const detailView = useMemo(() => {
    if (!detailState) {
      return null;
    }

    if (detailState.kind === "node") {
      const item = spotlightNodes.find((candidate) => candidate.type === detailState.nodeType);
      if (!item) {
        return null;
      }

      return {
        kind: "node" as const,
        id: item.type,
        title: `${item.label} 节点详情`,
        summary: item.description,
        tags: [
          { label: item.type },
          { label: item.capabilityGroup, color: "geekblue" },
          {
            label: item.bindingRequired ? "需要绑定" : "原生语义",
            color: item.bindingRequired ? "gold" : "blue"
          },
          {
            label: item.supportStatus === "available" ? "可编排" : "规划中",
            color: item.supportStatus === "available" ? "success" : "default"
          }
        ],
        notes: [item.supportSummary],
        actions: [
          handoff.returnHref
            ? {
                href: handoff.returnHref,
                label: "回到编辑器添加节点",
                type: "primary" as const
              }
            : {
                href: "/workspace",
                label: "返回工作台",
                type: "default" as const
              }
        ]
      };
    }

    if (detailState.kind === "provider") {
      const provider = resolvedProviderCatalog.find(
        (candidate) => candidate.id === detailState.providerId
      );
      if (!provider) {
        return null;
      }

      const configs = providerConfigs.filter((item) => item.provider_id === provider.id);

      return {
        kind: "provider" as const,
        id: provider.id,
        title: `${provider.label} Provider 详情`,
        summary: provider.description,
        tags: [
          { label: provider.id },
          {
            label: `默认协议 ${getModelProviderProtocolLabel(provider, provider.default_protocol)}`,
            color: "blue"
          },
          {
            label: configs.length > 0 ? `已配置 ${configs.length}` : "尚未配置",
            color: configs.length > 0 ? "success" : "default"
          },
          { label: provider.credential_type, color: "purple" }
        ],
        notes: [
          `默认模型：${provider.default_models.slice(0, 3).join("、") || "待团队补充"}`,
          `支持模型类型：${provider.supported_model_types.join("、") || "未声明"}`,
          `兼容凭据：${provider.compatible_credential_types.join("、") || provider.credential_type}`,
          configs.length > 0
            ? `当前团队配置：${configs.map((config) => `${config.label} · ${config.default_model}`).join("；")}`
            : "当前没有团队配置引用这个 provider；仍可先把它作为原生 provider plugin 目录事实查看。",
          providerRegistryState.message
            ? `当前 registry 状态：${providerRegistryState.message}`
            : "当前 registry 状态：目录与团队配置读取正常。"
        ],
        actions: [
          providerManageHref
            ? {
                href: providerManageHref,
                label: "管理 Provider Registry",
                type: "primary" as const
              }
            : {
                href: null,
                label: "仅团队管理员可管理",
                type: "default" as const,
                disabled: true
              },
          handoff.returnHref
            ? {
                href: handoff.returnHref,
                label: "回到当前编排",
                type: "default" as const
              }
            : {
                href: "/workspace",
                label: "返回工作台",
                type: "default" as const
              }
        ]
      };
    }

    const tools = detailState.toolSource === "native" ? nativeTools : pluginTools;
    const tool = tools.find((candidate) => candidate.id === detailState.toolId);
    if (!tool) {
      return null;
    }

    const runtimeBinding = readRuntimeBinding(tool.plugin_meta);
    const boundAdapter = runtimeBinding
      ? pluginAdapters.find((candidate) => candidate.id === runtimeBinding.provider)
      : null;

    return {
      kind: "toolNode" as const,
      id: tool.id,
      title: `${tool.name} 工具详情`,
      summary: tool.description || "当前目录项还没有补充描述。",
      tags: [
        { label: tool.id },
        {
          label: detailState.toolSource === "native" ? "7Flows Native" : "Dify Plugin",
          color: detailState.toolSource === "native" ? "purple" : "cyan"
        },
        { label: tool.ecosystem },
        { label: tool.source },
        ...(tool.default_execution_class ? [{ label: tool.default_execution_class }] : []),
        ...(tool.sensitivity_level
          ? [{ label: tool.sensitivity_level, color: "gold" }]
          : [])
      ],
      notes: [
        `输入字段：${getInputFieldNames(tool.input_schema).join("、") || "未声明"}`,
        `调用状态：${tool.callable ? "callable" : "只读目录"}`,
        runtimeBinding
          ? `compat runtime：${runtimeBinding.provider} / ${runtimeBinding.plugin_id} / ${runtimeBinding.tool_name}`
          : "当前工具不依赖 compat runtime 绑定。",
        boundAdapter
          ? `当前 adapter：${boundAdapter.endpoint} · ${boundAdapter.status}`
          : detailState.toolSource === "dify"
            ? "当前没有命中可用 adapter 详情；保持 fail-closed，不伪造 runtime 健康度。"
            : "当前工具无需 adapter 桥接。"
      ],
      actions: [
        {
          href: pluginGovernanceHref,
          label: "查看模板与插件治理",
          type: "default" as const
        },
        handoff.returnHref
          ? {
              href: handoff.returnHref,
              label: "回到当前编排绑定工具",
              type: "primary" as const
            }
          : {
              href: "/workspace",
              label: "返回工作台",
              type: "default" as const
            }
      ]
    };
  }, [
    detailState,
    handoff.returnHref,
    nativeTools,
    pluginAdapters,
    pluginGovernanceHref,
    pluginTools,
    providerConfigs,
    providerManageHref,
    providerRegistryState.message,
    resolvedProviderCatalog,
    spotlightNodes
  ]);

  return (
    <div className="workspace-tools-hub" data-component="workspace-tools-hub" data-tool-source={toolSource}>
      <Card className="workspace-tools-overview-card" data-component="workspace-tools-overview-card">
        <div className="workspace-tools-section-header">
          <div>
            <span className="workspace-panel-eyebrow">Tools Hub</span>
            <Title level={2}>工具</Title>
            <Paragraph className="workspace-tools-inline-copy">
              统一查看内置节点目录、Provider Registry 和工具注册。来源过滤只作用于工具注册，
              不会把整页切成两套系统。
            </Paragraph>
          </div>
          <div className="workspace-tools-action-row">
            {handoff.returnHref ? (
              <Button href={handoff.returnHref} type="primary">
                回到当前编排
              </Button>
            ) : null}
            <Button href="/workspace">返回工作台</Button>
          </div>
        </div>
        <div className="workspace-tools-tag-row" data-component="workspace-tools-overview-tags">
          <Tag color="blue">内置节点 {spotlightNodes.length}</Tag>
          <Tag color="gold">Provider {resolvedProviderCatalog.length}</Tag>
          <Tag color="purple">7Flows Native 工具 {nativeTools.length}</Tag>
          <Tag color="cyan">Dify Plugin 工具 {pluginTools.length}</Tag>
          {handoff.workflowId ? <Tag color="processing">workflow {handoff.workflowId}</Tag> : null}
          {handoff.workflowSurfaceLabel ? (
            <Tag color="processing">{handoff.workflowSurfaceLabel}</Tag>
          ) : null}
        </div>
      </Card>

      <section className="workspace-tools-section" data-component="workspace-tools-node-directory">
        <div className="workspace-tools-section-header">
          <div>
            <Title level={3}>内置节点目录</Title>
            <Paragraph className="workspace-tools-inline-copy">
              这里展示 7Flows 原生编排语义：节点目录始终保持稳定，不受下面“使用插件格式”的过滤影响。
            </Paragraph>
          </div>
          {handoff.returnHref ? (
            <Button href={handoff.returnHref} type="default">
              回到编辑器添加节点
            </Button>
          ) : null}
        </div>
        {spotlightNodes.length === 0 ? (
          <Card>
            <Empty
              className="workspace-tools-empty"
              description="当前还没读取到内置节点目录；继续保持 fail-closed，不伪造 LLM / Reference / Tool 等能力。"
            />
          </Card>
        ) : (
          <div className="workspace-tools-card-grid">
            {spotlightNodes.map((item) => (
              <Card
                key={item.type}
                size="small"
                title={item.label}
                extra={
                  <Tag color={item.supportStatus === "available" ? "success" : "default"}>
                    {item.supportStatus === "available" ? "可编排" : "规划中"}
                  </Tag>
                }
                data-component="workspace-tools-node-card"
              >
                <Paragraph className="workspace-tools-card-copy">{item.description}</Paragraph>
                <div className="workspace-tools-tag-row">
                  <Tag>{item.type}</Tag>
                  <Tag color="geekblue">{item.capabilityGroup}</Tag>
                  <Tag color={item.bindingRequired ? "gold" : "blue"}>
                    {item.bindingRequired ? "需要绑定" : "原生语义"}
                  </Tag>
                </div>
                <Paragraph className="workspace-tools-card-note">{item.supportSummary}</Paragraph>
                <div className="workspace-tools-action-row">
                  <Button
                    data-component="workspace-tools-detail-trigger"
                    data-detail-kind="node"
                    onClick={() => setDetailState({ kind: "node", nodeType: item.type })}
                    size="small"
                  >
                    查看详情
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="workspace-tools-section" data-component="workspace-tools-provider-registry">
        <div className="workspace-tools-section-header">
          <div>
            <Title level={3}>模型供应商</Title>
            <Paragraph className="workspace-tools-inline-copy">
              Provider Registry 与节点配置解耦：节点只引用 `providerConfigRef + modelId`，不鼓励 inline provider config。
            </Paragraph>
          </div>
          <div className="workspace-tools-action-row">
            {providerManageHref ? (
              <Button href={providerManageHref}>管理 Provider Registry</Button>
            ) : (
              <Button disabled>仅团队管理员可管理</Button>
            )}
          </div>
        </div>

        {providerRegistryState.message ? (
          <Card size="small" data-component="workspace-tools-provider-state-card">
            <div className="workspace-tools-tag-row">
              <Tag color={providerRegistryState.kind === "error" ? "error" : "default"}>
                {providerRegistryState.kind === "error" ? "Registry 异常" : "权限受限"}
              </Tag>
            </div>
            <Paragraph className="workspace-tools-card-note">
              {providerRegistryState.message}
            </Paragraph>
          </Card>
        ) : null}

        <div className="workspace-tools-card-grid">
          {resolvedProviderCatalog.map((provider) => {
            const configs = providerConfigs.filter((item) => item.provider_id === provider.id);
            return (
              <Card
                key={provider.id}
                size="small"
                title={provider.label}
                extra={<Tag color="gold">Native Provider Plugin</Tag>}
                data-component="workspace-tools-provider-card"
              >
                <Paragraph className="workspace-tools-card-copy">{provider.description}</Paragraph>
                <div className="workspace-tools-tag-row">
                  <Tag>{provider.id}</Tag>
                  <Tag color="blue">
                    默认协议 {getModelProviderProtocolLabel(provider, provider.default_protocol)}
                  </Tag>
                  <Tag color={configs.length > 0 ? "success" : "default"}>
                    {configs.length > 0 ? `已配置 ${configs.length}` : "尚未配置"}
                  </Tag>
                </div>
                <Paragraph className="workspace-tools-card-note">
                  默认模型：{provider.default_models.slice(0, 3).join("、") || "待团队补充"}
                </Paragraph>
                {configs.length > 0 ? (
                  <div className="workspace-tools-tag-row" data-component="workspace-tools-provider-configs">
                    {configs.map((config) => (
                      <Tag color={config.status === "active" ? "success" : "default"} key={config.id}>
                        {config.label} · {config.default_model}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <Paragraph className="workspace-tools-card-note">
                    当前没有团队配置引用这个 provider；仍可先把它作为原生 provider plugin 目录事实查看。
                  </Paragraph>
                )}
                <div className="workspace-tools-action-row">
                  <Button
                    data-component="workspace-tools-detail-trigger"
                    data-detail-kind="provider"
                    onClick={() => setDetailState({ kind: "provider", providerId: provider.id })}
                    size="small"
                  >
                    查看详情
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="workspace-tools-section" data-component="workspace-tools-tool-registry">
        <div className="workspace-tools-section-header">
          <div>
            <Title level={3}>工具注册</Title>
            <Paragraph className="workspace-tools-inline-copy">
              同一个工具面里展示不同来源的工具目录。来源过滤只影响这里，不会影响上面的内置节点目录和 Provider Registry。
            </Paragraph>
          </div>
          <div className="workspace-tools-action-row">
            <Button href={pluginGovernanceHref}>查看模板与插件治理</Button>
            {handoff.returnHref ? (
              <Button href={handoff.returnHref} type="primary" ghost>
                回到当前编排绑定工具
              </Button>
            ) : null}
          </div>
        </div>

        <Card size="small" data-component="workspace-tools-source-filter-card">
          <div className="workspace-tools-select-row">
            <Text strong>使用插件格式</Text>
            <Select<ToolSourceFilter>
              aria-label="使用插件格式"
              className="workspace-tools-source-select"
              data-component="workspace-tools-source-select"
              onChange={(value) => setToolSource(value)}
              options={TOOL_SOURCE_OPTIONS as Array<{ label: string; value: ToolSourceFilter }>}
              popupMatchSelectWidth={false}
              value={toolSource}
            />
            <div className="workspace-tools-tag-row">
              <Tag color="purple">7Flows Native {nativeTools.length}</Tag>
              <Tag color="cyan">Dify Plugin {pluginTools.length}</Tag>
            </div>
          </div>
          <Paragraph className="workspace-tools-card-note">
            当前过滤结果：{toolSource === "native" ? "仅展示 7Flows Native 工具注册" : "仅展示 Dify Plugin 工具注册"}。
          </Paragraph>
        </Card>

        {toolSource === "dify" ? (
          <div className="workspace-tools-card-grid" data-component="workspace-tools-adapter-grid">
            {pluginAdapters.length === 0 ? (
              <Card>
                <Empty
                  className="workspace-tools-empty"
                  description="当前还没有启用中的 Dify compat adapter。"
                />
              </Card>
            ) : (
              pluginAdapters.map((adapter) => (
                <Card
                  key={adapter.id}
                  size="small"
                  title={adapter.id}
                  extra={<Tag color={adapter.enabled ? "success" : "default"}>{adapter.status}</Tag>}
                  data-component="workspace-tools-adapter-card"
                >
                  <Paragraph className="workspace-tools-card-copy">{adapter.endpoint}</Paragraph>
                  <div className="workspace-tools-tag-row">
                    <Tag>{adapter.ecosystem}</Tag>
                    {adapter.mode ? <Tag color="geekblue">mode {adapter.mode}</Tag> : null}
                    {adapter.plugin_kinds.map((kind) => (
                      <Tag key={`${adapter.id}-${kind}`}>{kind}</Tag>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : null}

        {toolRegistryItems.length === 0 ? (
          <Card>
            <Empty
              className="workspace-tools-empty"
              description={
                toolSource === "native"
                  ? "当前还没有原生工具目录项；继续保持 fail-closed，不把节点语义误当成已注册工具。"
                  : "当前还没有同步任何 Dify Plugin 工具。"
              }
            />
          </Card>
        ) : (
          <div className="workspace-tools-card-grid" data-component="workspace-tools-registry-grid">
            {toolRegistryItems.map((tool) => {
              const provider = readRuntimeBinding(tool.plugin_meta);
              return (
                <Card
                  key={tool.id}
                  size="small"
                  title={tool.name}
                  extra={
                    <Tag color={tool.callable ? "success" : "default"}>
                      {tool.callable ? "callable" : "只读目录"}
                    </Tag>
                  }
                  data-component="workspace-tools-registry-card"
                >
                  <Paragraph className="workspace-tools-card-copy">{tool.description || "当前目录项还没有补充描述。"}</Paragraph>
                  <div className="workspace-tools-tag-row">
                    <Tag>{tool.id}</Tag>
                    <Tag color={toolSource === "native" ? "purple" : "cyan"}>
                      {toolSource === "native" ? "7Flows Native" : "Dify Plugin"}
                    </Tag>
                    <Tag>{tool.ecosystem}</Tag>
                    <Tag>{tool.source}</Tag>
                    {tool.default_execution_class ? <Tag>{tool.default_execution_class}</Tag> : null}
                    {tool.sensitivity_level ? <Tag color="gold">{tool.sensitivity_level}</Tag> : null}
                  </div>
                  <Paragraph className="workspace-tools-card-note">
                    输入字段：{getInputFieldNames(tool.input_schema).join("、") || "未声明"}
                  </Paragraph>
                  {provider ? (
                    <Paragraph className="workspace-tools-card-note">
                      compat runtime：{provider.provider} / {provider.plugin_id} / {provider.tool_name}
                    </Paragraph>
                  ) : null}
                  <div className="workspace-tools-action-row">
                    <Button
                      data-component="workspace-tools-detail-trigger"
                      data-detail-kind="toolNode"
                      onClick={() =>
                        setDetailState({
                          kind: "toolNode",
                          toolId: tool.id,
                          toolSource
                        })
                      }
                      size="small"
                    >
                      查看详情
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        destroyOnClose
        footer={null}
        onCancel={() => setDetailState(null)}
        open={Boolean(detailView)}
        title={detailView?.title ?? "详情"}
      >
        {detailView ? (
          <div
            data-component="workspace-tools-detail-modal"
            data-detail-id={detailView.id}
            data-detail-kind={detailView.kind}
          >
            <Paragraph className="workspace-tools-card-copy">{detailView.summary}</Paragraph>
            <div className="workspace-tools-tag-row">
              {detailView.tags.map((tag) => (
                <Tag color={tag.color} key={`${detailView.kind}-${detailView.id}-${tag.label}`}>
                  {tag.label}
                </Tag>
              ))}
            </div>
            {detailView.notes.map((note) => (
              <Paragraph className="workspace-tools-card-note" key={`${detailView.id}-${note}`}>
                {note}
              </Paragraph>
            ))}
            <div className="workspace-tools-action-row" data-component="workspace-tools-detail-actions">
              {detailView.actions.map((action) =>
                action.href ? (
                  <Button href={action.href} key={`${detailView.id}-${action.label}`} type={action.type}>
                    {action.label}
                  </Button>
                ) : (
                  <Button disabled key={`${detailView.id}-${action.label}`} type={action.type}>
                    {action.label}
                  </Button>
                )
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function buildSpotlightNodeCatalog(nodeCatalog: WorkflowNodeCatalogItem[]) {
  const catalogByType = new Map(
    sortWorkflowNodeCatalogForAuthoring(nodeCatalog).map((item) => [item.type, item])
  );

  return SPOTLIGHT_NODE_TYPES.flatMap((type) => {
    const item = catalogByType.get(type);
    return item ? [item] : [];
  });
}

function getInputFieldNames(inputSchema: Record<string, unknown>) {
  const properties = inputSchema.properties;
  if (!properties || typeof properties !== "object") {
    return [];
  }

  return Object.keys(properties as Record<string, unknown>);
}

function readRuntimeBinding(pluginMeta: PluginToolRegistryItem["plugin_meta"]) {
  const rawBinding = pluginMeta?.dify_runtime;
  if (!rawBinding || typeof rawBinding !== "object") {
    return null;
  }

  const provider =
    typeof (rawBinding as Record<string, unknown>).provider === "string"
      ? String((rawBinding as Record<string, unknown>).provider)
      : "-";
  const plugin_id =
    typeof (rawBinding as Record<string, unknown>).plugin_id === "string"
      ? String((rawBinding as Record<string, unknown>).plugin_id)
      : "-";
  const tool_name =
    typeof (rawBinding as Record<string, unknown>).tool_name === "string"
      ? String((rawBinding as Record<string, unknown>).tool_name)
      : "-";

  return {
    provider,
    plugin_id,
    tool_name
  };
}
