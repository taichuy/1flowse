"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Modal, Space, Tag, Typography } from "antd";

import type { CredentialItem } from "@/lib/get-credentials";
import {
  createDefaultModelProviderDraft,
  createWorkspaceModelProviderConfig,
  deactivateWorkspaceModelProviderConfig,
  getCompatibleCredentials,
  getModelProviderDraftPreflight,
  getModelProviderCatalogItem,
  getModelProviderCredentialField,
  getModelProviderProtocolLabel,
  getModelProviderProtocolOptions,
  type NativeModelProviderCatalogItem,
  resolveNativeModelProviderCatalog,
  type WorkspaceModelProviderConfigDraft,
  type WorkspaceModelProviderConfigItem,
  updateWorkspaceModelProviderConfig
} from "@/lib/model-provider-registry";

const { Paragraph, Text, Title } = Typography;

type WorkspaceModelProviderModalState =
  | {
      kind: "create";
      providerId?: string | null;
    }
  | {
      kind: "edit";
      providerConfigId: string;
    };

type WorkspaceModelProviderSettingsProps = {
  initialCatalog: NativeModelProviderCatalogItem[];
  initialCredentials: CredentialItem[];
  initialProviderConfigs: WorkspaceModelProviderConfigItem[];
  initialModalState?: WorkspaceModelProviderModalState | null;
  workspaceName: string;
};

type MessageTone = "idle" | "success" | "error";

function formatProviderConfigurationMethod(method: string) {
  switch (method) {
    case "predefined-model":
      return "内置推荐模型";
    case "customizable-model":
      return "支持自定义模型";
    default:
      return method;
  }
}

function createDraftFromProvider(
  catalog: NativeModelProviderCatalogItem[],
  credentials: CredentialItem[],
  providerId?: string | null
): WorkspaceModelProviderConfigDraft {
  const fallbackDraft = createDefaultModelProviderDraft(catalog, credentials);
  const provider = getModelProviderCatalogItem(catalog, providerId ?? fallbackDraft.provider_id);
  const compatibleCredential = getCompatibleCredentials(provider, credentials)[0] ?? null;

  return {
    ...fallbackDraft,
    provider_id: provider?.id ?? fallbackDraft.provider_id,
    label: provider ? `${provider.label} Team` : fallbackDraft.label,
    description: "",
    credential_ref: compatibleCredential ? `credential://${compatibleCredential.id}` : "",
    base_url: provider?.default_base_url ?? fallbackDraft.base_url,
    default_model: provider?.default_models[0] ?? fallbackDraft.default_model,
    protocol: provider?.default_protocol ?? fallbackDraft.protocol,
    status: "active"
  };
}

function createDraftFromProviderConfig(
  item: WorkspaceModelProviderConfigItem
): WorkspaceModelProviderConfigDraft {
  return {
    provider_id: item.provider_id,
    label: item.label,
    description: item.description,
    credential_ref: item.credential_ref,
    base_url: item.base_url,
    default_model: item.default_model,
    protocol: item.protocol,
    status: item.status
  };
}

function getMessageAlertType(messageTone: MessageTone) {
  switch (messageTone) {
    case "success":
      return "success";
    case "error":
      return "error";
    default:
      return "info";
  }
}

export function WorkspaceModelProviderSettings({
  initialCatalog,
  initialCredentials,
  initialProviderConfigs,
  initialModalState = null,
  workspaceName
}: WorkspaceModelProviderSettingsProps) {
  const catalog = useMemo(() => resolveNativeModelProviderCatalog(initialCatalog), [initialCatalog]);
  const defaultDraft = useMemo(
    () => createDefaultModelProviderDraft(catalog, initialCredentials),
    [catalog, initialCredentials]
  );
  const initialEditorState = useMemo(() => {
    if (!initialModalState) {
      return {
        draft: defaultDraft,
        editingId: null,
        isModalOpen: false
      };
    }

    if (initialModalState.kind === "edit") {
      const item = initialProviderConfigs.find(
        (candidate) => candidate.id === initialModalState.providerConfigId
      );

      if (item) {
        return {
          draft: createDraftFromProviderConfig(item),
          editingId: item.id,
          isModalOpen: true
        };
      }
    }

    const seededProviderId =
      initialModalState.kind === "create" ? initialModalState.providerId : undefined;

    return {
      draft: createDraftFromProvider(catalog, initialCredentials, seededProviderId),
      editingId: null,
      isModalOpen: true
    };
  }, [catalog, defaultDraft, initialCredentials, initialModalState, initialProviderConfigs]);

  const [providerConfigs, setProviderConfigs] = useState(initialProviderConfigs);
  const [editingId, setEditingId] = useState<string | null>(initialEditorState.editingId);
  const [draft, setDraft] = useState<WorkspaceModelProviderConfigDraft>(initialEditorState.draft);
  const [isModalOpen, setIsModalOpen] = useState(initialEditorState.isModalOpen);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeProvider = useMemo(
    () => getModelProviderCatalogItem(catalog, draft.provider_id),
    [catalog, draft.provider_id]
  );
  const compatibleCredentials = useMemo(
    () => getCompatibleCredentials(activeProvider, initialCredentials),
    [activeProvider, initialCredentials]
  );
  const protocolField = useMemo(
    () => getModelProviderCredentialField(activeProvider, "api_protocol"),
    [activeProvider]
  );
  const protocolOptions = useMemo(
    () => getModelProviderProtocolOptions(activeProvider),
    [activeProvider]
  );
  const draftPreflight = useMemo(
    () => getModelProviderDraftPreflight(activeProvider, initialCredentials, draft),
    [activeProvider, draft, initialCredentials]
  );
  const hasBlockingPreflight = draftPreflight.some((issue) => issue.tone === "error");

  const handleDraftChange = (
    key: keyof WorkspaceModelProviderConfigDraft,
    value: WorkspaceModelProviderConfigDraft[keyof WorkspaceModelProviderConfigDraft]
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  };

  const resetDraft = () => {
    setEditingId(null);
    setDraft(defaultDraft);
  };

  const openCreateModal = (providerId?: string | null) => {
    setEditingId(null);
    setDraft(createDraftFromProvider(catalog, initialCredentials, providerId));
    setIsModalOpen(true);
    setMessage(null);
    setMessageTone("idle");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetDraft();
  };

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextProvider = getModelProviderCatalogItem(catalog, event.target.value);
    const nextCompatibleCredential = getCompatibleCredentials(nextProvider, initialCredentials)[0] ?? null;
    setDraft((current) => ({
      ...current,
      provider_id: event.target.value,
      label:
        editingId && current.label.trim()
          ? current.label
          : `${nextProvider?.label ?? "模型供应商"} Team`,
      base_url: nextProvider?.default_base_url ?? current.base_url,
      default_model: nextProvider?.default_models[0] ?? current.default_model,
      protocol: nextProvider?.default_protocol ?? current.protocol,
      credential_ref:
        current.credential_ref &&
        getCompatibleCredentials(nextProvider, initialCredentials).some(
          (item) => `credential://${item.id}` === current.credential_ref
        )
          ? current.credential_ref
          : nextCompatibleCredential
            ? `credential://${nextCompatibleCredential.id}`
            : ""
    }));
  };

  const handleEdit = (item: WorkspaceModelProviderConfigItem) => {
    setEditingId(item.id);
    setDraft(createDraftFromProviderConfig(item));
    setIsModalOpen(true);
    setMessage(null);
    setMessageTone("idle");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(editingId ? "正在更新模型供应商配置..." : "正在创建模型供应商配置...");
    setMessageTone("idle");

    const result = editingId
      ? await updateWorkspaceModelProviderConfig(editingId, draft)
      : await createWorkspaceModelProviderConfig(draft);

    if (result.status === "error") {
      setMessage(result.message);
      setMessageTone("error");
      setIsSubmitting(false);
      return;
    }

    setProviderConfigs((current) => {
      const next = current.filter((item) => item.id !== result.item.id);
      return [result.item, ...next];
    });
    setMessage(`已保存 ${result.item.label}。`);
    setMessageTone("success");
    setIsSubmitting(false);
    setIsModalOpen(false);
    resetDraft();
  };

  const handleDeactivate = async (providerConfigId: string) => {
    setIsSubmitting(true);
    setMessage("正在停用模型供应商配置...");
    setMessageTone("idle");

    const result = await deactivateWorkspaceModelProviderConfig(providerConfigId);
    if (result.status === "error") {
      setMessage(result.message);
      setMessageTone("error");
      setIsSubmitting(false);
      return;
    }

    setProviderConfigs((current) =>
      current.map((item) => (item.id === result.item.id ? result.item : item))
    );
    setMessage(`已停用 ${result.item.label}。`);
    setMessageTone("success");
    setIsSubmitting(false);
    if (editingId === providerConfigId) {
      closeModal();
    }
  };

  const messageAlert = message ? (
    <Alert
      data-component="workspace-model-provider-message"
      message={message}
      showIcon
      type={getMessageAlertType(messageTone)}
    />
  ) : null;

  return (
    <section data-component="workspace-model-provider-settings">
      <Card className="workspace-settings-header-card" data-component="workspace-model-provider-summary">
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <div className="workspace-settings-header-copy">
            <span className="workspace-panel-eyebrow">Native Provider Registry</span>
            <Title level={2} style={{ margin: 0 }}>
              团队模型供应商
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {workspaceName} 的 OpenAI / Claude 供应商配置先在这里落到 workspace registry，后续节点只引用
              <code> provider_config_ref + model</code>。
            </Paragraph>
          </div>
          <Space wrap>
            <Button href="/workspace/settings/team">返回成员设置</Button>
            <Button onClick={() => openCreateModal()} type="primary">
              创建供应商配置
            </Button>
          </Space>
        </Space>
      </Card>

      {!isModalOpen && messageAlert ? <div style={{ marginTop: 16 }}>{messageAlert}</div> : null}

      <section data-component="workspace-model-provider-catalog" style={{ marginTop: 16 }}>
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <div>
            <span className="workspace-panel-eyebrow">Catalog</span>
            <Title level={3} style={{ marginBottom: 0, marginTop: 4 }}>
              Provider 目录
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              先选原生 provider，再决定是否创建团队配置；每张卡都保留 credential、协议与默认模型事实。
            </Paragraph>
          </div>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
            }}
          >
            {catalog.map((item) => {
              const providerCredentials = getCompatibleCredentials(item, initialCredentials);
              const activeConfigCount = providerConfigs.filter(
                (providerConfig) =>
                  providerConfig.provider_id === item.id && providerConfig.status === "active"
              ).length;

              return (
                <Card
                  data-component="workspace-model-provider-catalog-card"
                  data-provider-id={item.id}
                  key={item.id}
                  title={item.label}
                  extra={
                    <Tag color={activeConfigCount > 0 ? "success" : "default"}>
                      {activeConfigCount > 0 ? `已生效 ${activeConfigCount} 条` : "尚未配置"}
                    </Tag>
                  }
                >
                  <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                    <Paragraph style={{ marginBottom: 0 }}>{item.description}</Paragraph>
                    <Space size={[8, 8]} wrap>
                      <Tag color="blue">{item.credential_type}</Tag>
                      <Tag color="purple">{getModelProviderProtocolLabel(item, item.default_protocol)}</Tag>
                      <Tag>{item.default_models[0] ?? "未提供默认模型"}</Tag>
                    </Space>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      配置方式：{item.configuration_methods.map(formatProviderConfigurationMethod).join(" / ")}
                    </Paragraph>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      兼容凭据：{item.compatible_credential_types.join(" / ")}；当前可用 {providerCredentials.length} 条
                    </Paragraph>
                    <Space wrap>
                      <Button onClick={() => openCreateModal(item.id)} type="primary">
                        为 {item.label} 新建配置
                      </Button>
                      {item.help_url ? (
                        <Button href={item.help_url} rel="noreferrer" target="_blank">
                          查看 {item.label} 帮助文档
                        </Button>
                      ) : null}
                    </Space>
                  </Space>
                </Card>
              );
            })}
          </div>
        </Space>
      </section>

      <section
        data-component="workspace-model-provider-registry-directory"
        data-provider-count={providerConfigs.length}
        style={{ marginTop: 16 }}
      >
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <div className="workspace-section-heading-row">
            <div>
              <span className="workspace-panel-eyebrow">Registry</span>
              <Title level={3} style={{ marginBottom: 0, marginTop: 4 }}>
                已配置供应商
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                当前 catalog 内置 {catalog.length} 个原生 provider；已配置 {providerConfigs.length} 条团队级记录。
              </Paragraph>
            </div>
            <Button onClick={() => openCreateModal()} type="primary">
              新建配置
            </Button>
          </div>
          <Alert
            data-component="workspace-model-provider-scope-note"
            description="当前只开放创建、编辑与停用；delete / duplicate / marketplace sync 仍未接入，因此页面不会展示假按钮。"
            showIcon
            type="info"
          />
          {providerConfigs.length ? (
            <div
              data-component="workspace-model-provider-registry-card-list"
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
              }}
            >
              {providerConfigs.map((item) => (
                <Card
                  data-component="workspace-model-provider-registry-card"
                  data-provider-config-id={item.id}
                  key={item.id}
                  title={item.label}
                  extra={
                    <Space size={8} wrap>
                      <Tag color={item.status === "active" ? "success" : "default"}>
                        {item.status === "active" ? "生效中" : "已停用"}
                      </Tag>
                      <Tag>{item.provider_label}</Tag>
                    </Space>
                  }
                >
                  <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                    <Paragraph style={{ marginBottom: 0 }}>
                      {item.provider_label} · {item.default_model} · {item.protocol}
                    </Paragraph>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {item.credential_name}（{item.credential_ref}）
                    </Paragraph>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Endpoint：{item.base_url}
                    </Paragraph>
                    {item.description ? (
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        说明：{item.description}
                      </Paragraph>
                    ) : null}
                    <Space wrap>
                      <Button onClick={() => handleEdit(item)} type="primary">
                        编辑
                      </Button>
                      <Button
                        disabled={isSubmitting || item.status === "inactive"}
                        onClick={() => handleDeactivate(item.id)}
                      >
                        停用
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <Empty
                description="还没有团队级 provider registry 记录，可先从上方 Provider 目录创建 OpenAI 或 Claude 配置。"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button onClick={() => openCreateModal()} type="primary">
                  创建第一条供应商配置
                </Button>
              </Empty>
            </Card>
          )}
        </Space>
      </section>

      <Modal
        footer={null}
        onCancel={closeModal}
        open={isModalOpen}
        title={editingId ? "更新供应商配置" : "新增供应商配置"}
        width={720}
      >
        <section data-component="workspace-model-provider-modal" data-modal-mode={editingId ? "edit" : "create"}>
          <form data-component="workspace-model-provider-form" onSubmit={handleSubmit}>
            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
              <Alert
                data-component="workspace-model-provider-modal-note"
                description="弹窗继续复用现有 create / update / deactivate / preflight seam，不新增 backend contract。"
                showIcon
                type="info"
              />
              {isModalOpen && messageAlert ? messageAlert : null}
              <label className="workspace-form-field">
                <span>Provider</span>
                <select name="provider_id" onChange={handleProviderChange} value={draft.provider_id}>
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <section data-component="workspace-model-provider-active-metadata">
                <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                  <div>
                    <Text strong>{activeProvider?.label ?? "Native Provider"}</Text>
                  </div>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {activeProvider?.description ?? "当前 provider metadata 暂不可用。"}
                  </Paragraph>
                  <Space size={[8, 8]} wrap>
                    <Tag>{activeProvider?.default_models[0] ?? "未提供默认模型"}</Tag>
                    <Tag color="blue">
                      {protocolOptions.map((option) => option.label).join(" / ") ||
                        activeProvider?.default_protocol ||
                        "未提供协议"}
                    </Tag>
                    <Tag color="purple">
                      {activeProvider?.compatible_credential_types.join(" / ") ?? "未提供凭据类型"}
                    </Tag>
                  </Space>
                  {activeProvider?.help_url ? (
                    <Button href={activeProvider.help_url} rel="noreferrer" target="_blank">
                      获取 {activeProvider.label} API Key
                    </Button>
                  ) : null}
                </Space>
              </section>
              <label className="workspace-form-field">
                <span>显示名称</span>
                <input
                  name="label"
                  onChange={(event) => handleDraftChange("label", event.target.value)}
                  placeholder="OpenAI Production"
                  value={draft.label}
                />
              </label>
              <label className="workspace-form-field">
                <span>默认 Endpoint</span>
                <input
                  name="base_url"
                  onChange={(event) => handleDraftChange("base_url", event.target.value)}
                  placeholder={activeProvider?.default_base_url ?? "https://api.example.com"}
                  value={draft.base_url}
                />
              </label>
              <label className="workspace-form-field">
                <span>默认模型</span>
                <input
                  list={`workspace-model-provider-default-models-${activeProvider?.id ?? "default"}`}
                  name="default_model"
                  onChange={(event) => handleDraftChange("default_model", event.target.value)}
                  placeholder={activeProvider?.default_models[0] ?? "gpt-4.1"}
                  value={draft.default_model}
                />
                <datalist id={`workspace-model-provider-default-models-${activeProvider?.id ?? "default"}`}>
                  {activeProvider?.default_models.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
                <p className="workspace-muted">
                  {activeProvider?.configuration_methods.includes("customizable-model")
                    ? "可直接选择推荐模型，也可以继续输入自定义模型 ID。"
                    : "当前 provider 仅支持 catalog 中的预置模型。"}
                </p>
              </label>
              <label className="workspace-form-field">
                <span>协议</span>
                <select
                  name="protocol"
                  onChange={(event) => handleDraftChange("protocol", event.target.value)}
                  value={draft.protocol}
                >
                  {protocolOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {protocolField?.help ? <p className="workspace-muted">{protocolField.help}</p> : null}
              </label>
              <label className="workspace-form-field">
                <span>凭据引用</span>
                <select
                  name="credential_ref"
                  onChange={(event) => handleDraftChange("credential_ref", event.target.value)}
                  value={draft.credential_ref}
                >
                  <option value="">请选择 credential:// 记录</option>
                  {compatibleCredentials.map((credential) => (
                    <option key={credential.id} value={`credential://${credential.id}`}>
                      {credential.name} · {credential.credential_type}
                    </option>
                  ))}
                </select>
                <p className="workspace-muted">
                  保存后会把当前 provider 绑定到 {getModelProviderProtocolLabel(activeProvider, draft.protocol)} 协议，默认走 {draft.default_model || activeProvider?.default_models[0] || "当前填写值"}。
                </p>
              </label>
              <label className="workspace-form-field">
                <span>状态</span>
                <select
                  name="status"
                  onChange={(event) =>
                    handleDraftChange("status", event.target.value as "active" | "inactive")
                  }
                  value={draft.status}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label className="workspace-form-field">
                <span>说明</span>
                <textarea
                  name="description"
                  onChange={(event) => handleDraftChange("description", event.target.value)}
                  placeholder="例如：供团队默认 Claude 节点引用的生产配置。"
                  value={draft.description}
                />
              </label>
              <p className="workspace-muted">
                当前 provider 支持 {activeProvider?.supported_model_types.join(" / ") ?? "llm"}；兼容凭据类型：
                {activeProvider?.compatible_credential_types.join("、") ?? "api_key"}。
              </p>
              <section data-component="workspace-model-provider-preflight">
                <span className="workspace-panel-eyebrow">Preflight</span>
                <h3>保存前检查</h3>
                {draftPreflight.length ? (
                  <ul className="workspace-list-reset">
                    {draftPreflight.map((issue) => (
                      <li
                        className={issue.tone === "error" ? "workspace-empty-notice" : "workspace-muted"}
                        key={issue.code}
                      >
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="workspace-muted">
                    当前配置已满足本地 preflight：默认模型、协议与凭据兼容关系一致，可提交到 workspace registry。
                  </p>
                )}
              </section>
              {compatibleCredentials.length ? null : (
                <p className="workspace-empty-notice">
                  当前没有可兼容的凭据，请先创建 {activeProvider?.label ?? "模型供应商"} 对应的 credential 记录。
                </p>
              )}
              <Space wrap>
                <Button onClick={closeModal}>取消</Button>
                <Button
                  disabled={isSubmitting || !draft.credential_ref || !draft.label.trim() || hasBlockingPreflight}
                  htmlType="submit"
                  loading={isSubmitting}
                  type="primary"
                >
                  {editingId ? "保存变更" : "创建供应商"}
                </Button>
              </Space>
            </Space>
          </form>
        </section>
      </Modal>
    </section>
  );
}
