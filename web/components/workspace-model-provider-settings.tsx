"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";

import type { CredentialItem } from "@/lib/get-credentials";
import {
  createDefaultModelProviderDraft,
  createWorkspaceModelProviderConfig,
  deactivateWorkspaceModelProviderConfig,
  getCompatibleCredentials,
  getModelProviderCatalogItem,
  type NativeModelProviderCatalogItem,
  type WorkspaceModelProviderConfigDraft,
  type WorkspaceModelProviderConfigItem,
  updateWorkspaceModelProviderConfig
} from "@/lib/model-provider-registry";

type WorkspaceModelProviderSettingsProps = {
  initialCatalog: NativeModelProviderCatalogItem[];
  initialCredentials: CredentialItem[];
  initialProviderConfigs: WorkspaceModelProviderConfigItem[];
  workspaceName: string;
};

type MessageTone = "idle" | "success" | "error";

export function WorkspaceModelProviderSettings({
  initialCatalog,
  initialCredentials,
  initialProviderConfigs,
  workspaceName
}: WorkspaceModelProviderSettingsProps) {
  const [providerConfigs, setProviderConfigs] = useState(initialProviderConfigs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkspaceModelProviderConfigDraft>(() =>
    createDefaultModelProviderDraft(initialCatalog, initialCredentials)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeProvider = useMemo(
    () => getModelProviderCatalogItem(initialCatalog, draft.provider_id),
    [draft.provider_id, initialCatalog]
  );
  const compatibleCredentials = useMemo(
    () => getCompatibleCredentials(activeProvider, initialCredentials),
    [activeProvider, initialCredentials]
  );

  const handleDraftChange = (
    key: keyof WorkspaceModelProviderConfigDraft,
    value: WorkspaceModelProviderConfigDraft[keyof WorkspaceModelProviderConfigDraft]
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextProvider = getModelProviderCatalogItem(initialCatalog, event.target.value);
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

  const resetDraft = () => {
    setEditingId(null);
    setDraft(createDefaultModelProviderDraft(initialCatalog, initialCredentials));
  };

  const handleEdit = (item: WorkspaceModelProviderConfigItem) => {
    setEditingId(item.id);
    setDraft({
      provider_id: item.provider_id,
      label: item.label,
      description: item.description,
      credential_ref: item.credential_ref,
      base_url: item.base_url,
      default_model: item.default_model,
      protocol: item.protocol,
      status: item.status
    });
    setMessage(`已载入 ${item.label}，可继续修改。`);
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
      resetDraft();
    }
  };

  return (
    <section data-component="workspace-model-provider-settings">
      <section className="workspace-panel workspace-settings-header-card" data-component="workspace-model-provider-summary">
        <div className="workspace-settings-header-copy">
          <span className="workspace-panel-eyebrow">Native Provider Registry</span>
          <h1>团队模型供应商</h1>
          <p className="workspace-muted">
            {workspaceName} 的 OpenAI / Claude 供应商配置先在这里落到 workspace registry，后续节点只引用
            <code> provider_config_ref + model</code>。
          </p>
        </div>
        <div className="workspace-settings-header-actions">
          <a className="workspace-ghost-button compact" href="/workspace/settings/team">
            返回成员设置
          </a>
        </div>
      </section>

      <div className="workspace-member-admin-grid" data-component="workspace-model-provider-grid">
        <section className="workspace-panel workspace-member-list-card" data-component="workspace-model-provider-registry-list">
          <div className="workspace-section-heading-row">
            <div>
              <span className="workspace-panel-eyebrow">Registry</span>
              <h2>已配置供应商</h2>
            </div>
            <button className="workspace-ghost-button compact" onClick={resetDraft} type="button">
              新建配置
            </button>
          </div>
          <p className="workspace-muted">
            当前 catalog 内置 {initialCatalog.length} 个原生 provider；已配置 {providerConfigs.length} 条团队级记录。
          </p>
          {providerConfigs.length ? (
            <ul className="workspace-list-reset">
              {providerConfigs.map((item) => (
                <li className="workspace-provider-config-row" key={item.id}>
                  <div>
                    <strong>{item.label}</strong>
                    <p className="workspace-muted">
                      {item.provider_label} · {item.default_model} · {item.protocol}
                    </p>
                    <p className="workspace-muted">
                      {item.credential_name}（{item.credential_ref}）
                    </p>
                    <p className="workspace-muted">{item.base_url}</p>
                  </div>
                  <div className="workspace-provider-config-actions">
                    <span className="workspace-user-role-pill">
                      {item.status === "active" ? "生效中" : "已停用"}
                    </span>
                    <button className="workspace-ghost-button compact" onClick={() => handleEdit(item)} type="button">
                      编辑
                    </button>
                    <button
                      className="workspace-ghost-button compact"
                      disabled={isSubmitting || item.status === "inactive"}
                      onClick={() => handleDeactivate(item.id)}
                      type="button"
                    >
                      停用
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="workspace-muted">还没有团队级 provider registry 记录，可先从右侧创建 OpenAI 或 Claude 配置。</p>
          )}
        </section>

        <form className="workspace-panel workspace-member-create-card" data-component="workspace-model-provider-form" onSubmit={handleSubmit}>
          <div className="workspace-section-heading-row">
            <div>
              <span className="workspace-panel-eyebrow">Config</span>
              <h2>{editingId ? "更新供应商配置" : "新增供应商配置"}</h2>
            </div>
            {editingId ? (
              <button className="workspace-ghost-button compact" onClick={resetDraft} type="button">
                取消编辑
              </button>
            ) : null}
          </div>
          <label className="workspace-form-field">
            <span>Provider</span>
            <select name="provider_id" onChange={handleProviderChange} value={draft.provider_id}>
              {initialCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
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
              name="default_model"
              onChange={(event) => handleDraftChange("default_model", event.target.value)}
              placeholder={activeProvider?.default_models[0] ?? "gpt-4.1"}
              value={draft.default_model}
            />
          </label>
          <label className="workspace-form-field">
            <span>协议</span>
            <select
              name="protocol"
              onChange={(event) => handleDraftChange("protocol", event.target.value)}
              value={draft.protocol}
            >
              {activeProvider?.credential_fields
                .find((field) => field.variable === "api_protocol")
                ?.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )) ?? <option value={activeProvider?.default_protocol ?? draft.protocol}>{activeProvider?.default_protocol ?? draft.protocol}</option>}
            </select>
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
          </label>
          <label className="workspace-form-field">
            <span>状态</span>
            <select name="status" onChange={(event) => handleDraftChange("status", event.target.value as "active" | "inactive")} value={draft.status}>
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
          {compatibleCredentials.length ? null : (
            <p className="workspace-empty-notice">
              当前没有可兼容的凭据，请先创建 {activeProvider?.label ?? "模型供应商"} 对应的 credential 记录。
            </p>
          )}
          {message ? (
            <p className={`workspace-inline-message workspace-inline-message-${messageTone}`.trim()}>{message}</p>
          ) : null}
          <div className="workspace-section-actions">
            <button
              className="workspace-primary-button compact"
              disabled={isSubmitting || !draft.credential_ref || !draft.label.trim()}
              type="submit"
            >
              {editingId ? "保存变更" : "创建供应商"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
