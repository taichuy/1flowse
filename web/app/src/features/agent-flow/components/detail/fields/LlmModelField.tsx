import { CloseOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Input, Modal, Typography } from 'antd';
import { useMemo, useState } from 'react';

import type { SchemaFieldRendererProps } from '../../../../../shared/schema-ui/registry/create-renderer-registry';
import {
  fetchModelProviderOptions,
  modelProviderOptionsQueryKey
} from '../../../api/model-provider-options';
import {
  buildLlmParameterState,
  getLlmModelProvider
} from '../../../lib/llm-node-config';
import {
  findLlmModelOption,
  findLlmProviderInstanceOption,
  listLlmProviderInstanceOptions,
  type LlmModelOption
} from '../../../lib/model-options';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNodeConfig(adapter: SchemaFieldRendererProps['adapter']) {
  const node = adapter.getDerived('node') as { config?: Record<string, unknown> } | null | undefined;
  return isRecord(node?.config) ? node.config : {};
}

function ModelChip({
  providerLabel,
  modelLabel,
  tag,
  placeholder = '选择模型'
}: {
  providerLabel?: string | null;
  modelLabel?: string | null;
  tag?: string;
  placeholder?: string;
}) {
  return (
    <div
      className={`agent-flow-model-chip${modelLabel ? '' : ' agent-flow-model-chip--empty'}`}
    >
      <span className="agent-flow-model-chip__provider" aria-hidden="true">
        ◎
      </span>
      <span className="agent-flow-model-chip__content">
        <span className="agent-flow-model-chip__eyebrow">
          {providerLabel || '模型供应商'}
        </span>
        <span className="agent-flow-model-chip__label">{modelLabel || placeholder}</span>
      </span>
      {tag ? <span className="agent-flow-model-chip__tag">{tag}</span> : null}
    </div>
  );
}

function filterByQuery<T extends { label: string }>(items: T[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
}

export function LlmModelField({ adapter, block }: SchemaFieldRendererProps) {
  const [open, setOpen] = useState(false);
  const [providerSearchValue, setProviderSearchValue] = useState('');
  const [modelSearchValue, setModelSearchValue] = useState('');
  const providerOptionsQuery = useQuery({
    queryKey: modelProviderOptionsQueryKey,
    queryFn: fetchModelProviderOptions
  });
  const config = getNodeConfig(adapter);
  const modelProvider = getLlmModelProvider(config);
  const providerInstanceId = modelProvider.provider_instance_id.trim();
  const modelValue = modelProvider.model_id.trim();
  const providerOptions = useMemo(
    () => listLlmProviderInstanceOptions(providerOptionsQuery.data),
    [providerOptionsQuery.data]
  );
  const selectedProvider = findLlmProviderInstanceOption(
    providerOptionsQuery.data,
    providerInstanceId
  );
  const selectedModel = findLlmModelOption(
    providerOptionsQuery.data,
    providerInstanceId,
    modelValue
  );

  const filteredProviderOptions = useMemo(
    () => filterByQuery(providerOptions, providerSearchValue),
    [providerOptions, providerSearchValue]
  );
  const filteredModelOptions = useMemo(
    () => filterByQuery(selectedProvider?.models ?? [], modelSearchValue),
    [modelSearchValue, selectedProvider?.models]
  );
  const providerUnavailable = Boolean(
    providerInstanceId &&
      providerOptionsQuery.isSuccess &&
      selectedProvider === null
  );
  const modelUnavailable = Boolean(
    providerInstanceId &&
      modelValue &&
      providerOptionsQuery.isSuccess &&
      selectedModel === null
  );
  const hasProviderOptions = providerOptions.length > 0;

  function closeSettings() {
    setOpen(false);
    setProviderSearchValue('');
    setModelSearchValue('');
  }

  function selectProvider(nextProviderInstanceId: string) {
    const nextProvider = providerOptions.find((option) => option.value === nextProviderInstanceId);
    const nextModelStillValid = Boolean(
      nextProvider && nextProvider.models.some((option) => option.value === modelValue)
    );

    adapter.setValue('config.model_provider', {
      provider_instance_id: nextProviderInstanceId,
      model_id: nextModelStillValid ? modelValue : '',
      provider_code: nextProvider?.providerCode,
      protocol: nextProvider?.protocol,
      provider_label: nextProvider?.label,
      model_label: nextModelStillValid ? selectedModel?.label ?? modelProvider.model_label : undefined
    });

    if (!nextModelStillValid) {
      adapter.setValue('config.llm_parameters', buildLlmParameterState(null));
    }

    setModelSearchValue('');
  }

  function selectModel(nextModel: LlmModelOption) {
    adapter.setValue('config.model_provider', {
      provider_instance_id: nextModel.providerInstanceId,
      model_id: nextModel.value,
      provider_code: nextModel.providerCode,
      protocol: nextModel.protocol,
      provider_label: nextModel.providerLabel,
      model_label: nextModel.label,
      schema_fetched_at: new Date().toISOString()
    });
    adapter.setValue('config.llm_parameters', buildLlmParameterState(nextModel.parameterForm));
  }

  return (
    <>
      <div className="agent-flow-model-field">
        <button
          type="button"
          aria-label={block.label}
          className="agent-flow-model-field__trigger"
          onClick={() => setOpen(true)}
        >
          <ModelChip
            providerLabel={
              selectedProvider?.label ||
              modelProvider.provider_label ||
              (providerInstanceId ? providerInstanceId : null)
            }
            modelLabel={
              selectedModel?.label ||
              modelProvider.model_label ||
              (modelValue ? modelValue : null)
            }
            tag={selectedModel?.tag}
          />
          <span className="agent-flow-model-field__caret" aria-hidden="true">
            ▾
          </span>
        </button>
        <button
          type="button"
          aria-label={`${block.label}设置`}
          className="agent-flow-model-field__settings"
          onClick={() => setOpen(true)}
        >
          <SettingOutlined />
        </button>
      </div>
      <Modal
        open={open}
        footer={null}
        width={560}
        title="模型设置"
        closeIcon={<CloseOutlined />}
        onCancel={closeSettings}
        className="agent-flow-model-settings"
      >
        {providerOptionsQuery.isError ? (
          <Alert
            className="agent-flow-model-settings__notice"
            type="error"
            showIcon
            message="模型供应商列表加载失败。"
          />
        ) : null}
        {providerUnavailable ? (
          <Alert
            className="agent-flow-model-settings__notice"
            type="error"
            showIcon
            message="当前节点引用的模型供应商实例不可用。"
          />
        ) : null}
        {modelUnavailable ? (
          <Alert
            className="agent-flow-model-settings__notice"
            type="error"
            showIcon
            message="当前节点引用的模型不属于所选模型供应商实例。"
          />
        ) : null}
        <div className="agent-flow-model-settings__selector-shell">
          <div className="agent-flow-model-settings__section">
            <Typography.Title level={5} className="agent-flow-model-settings__section-title">
              模型供应商实例
            </Typography.Title>
            <Typography.Text className="agent-flow-model-settings__section-subtitle">
              先选择一个已就绪的供应商实例，再选择该实例下可用的模型。
            </Typography.Text>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              aria-label="搜索模型供应商实例"
              placeholder="搜索模型供应商实例"
              value={providerSearchValue}
              onChange={(event) => setProviderSearchValue(event.target.value)}
            />
            <div className="agent-flow-model-settings__dropdown">
              <div className="agent-flow-model-settings__options">
                {providerOptionsQuery.isPending ? (
                  <div className="agent-flow-model-settings__empty">
                    <Typography.Text>正在加载模型供应商实例…</Typography.Text>
                  </div>
                ) : filteredProviderOptions.length > 0 ? (
                  filteredProviderOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`选择模型供应商实例 ${option.label}`}
                      className={`agent-flow-model-settings__option${
                        option.value === providerInstanceId
                          ? ' agent-flow-model-settings__option--active'
                          : ''
                      }`}
                      onClick={() => selectProvider(option.value)}
                    >
                      <ModelChip
                        providerLabel={option.providerCode}
                        modelLabel={option.label}
                        tag={`${option.models.length} 个模型`}
                      />
                    </button>
                  ))
                ) : (
                  <Empty
                    className="agent-flow-model-settings__empty"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={hasProviderOptions ? '没有匹配的模型供应商实例' : '暂无可用模型供应商实例'}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="agent-flow-model-settings__section">
            <Typography.Title level={5} className="agent-flow-model-settings__section-title">
              模型
            </Typography.Title>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              aria-label="搜索模型"
              placeholder="搜索模型"
              value={modelSearchValue}
              onChange={(event) => setModelSearchValue(event.target.value)}
            />
            <div className="agent-flow-model-settings__dropdown">
              <div className="agent-flow-model-settings__options">
                {selectedProvider ? (
                  filteredModelOptions.length > 0 ? (
                    filteredModelOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-label={`选择模型 ${option.label}`}
                        className={`agent-flow-model-settings__option${
                          option.value === modelValue
                            ? ' agent-flow-model-settings__option--active'
                            : ''
                        }`}
                        onClick={() => selectModel(option)}
                      >
                        <ModelChip
                          providerLabel={selectedProvider.label}
                          modelLabel={option.label}
                          tag={option.tag}
                        />
                      </button>
                    ))
                  ) : (
                    <Empty
                      className="agent-flow-model-settings__empty"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="当前实例下没有匹配模型"
                    />
                  )
                ) : (
                  <Empty
                    className="agent-flow-model-settings__empty"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="请先选择模型供应商实例"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="agent-flow-model-settings__footer">
          <Button type="link" href="/settings/model-providers">
            <span aria-hidden="true" style={{ display: 'inline-flex', marginRight: 8 }}>
              <SettingOutlined />
            </span>
            模型供应商设置
          </Button>
        </div>
      </Modal>
    </>
  );
}
