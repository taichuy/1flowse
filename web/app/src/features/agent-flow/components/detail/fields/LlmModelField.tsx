import { CloseOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Input, Modal, Slider, Switch, Typography } from 'antd';
import { useMemo, useState } from 'react';

import type { SchemaFieldRendererProps } from '../../../../../shared/schema-ui/registry/create-renderer-registry';
import {
  fetchModelProviderOptions,
  modelProviderOptionsQueryKey
} from '../../../api/model-provider-options';
import {
  findLlmModelOption,
  findLlmProviderInstanceOption,
  listLlmProviderInstanceOptions,
  type LlmModelOption
} from '../../../lib/model-options';

function clampNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

function ParameterRow({
  label,
  value,
  enabled,
  onToggle,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
  formatter
}: {
  label: string;
  value: number;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatter?: (value: number) => string;
}) {
  return (
    <div className="agent-flow-model-settings__row">
      <div className="agent-flow-model-settings__row-head">
        <Switch size="small" checked={enabled} onChange={onToggle} />
        <Typography.Text className="agent-flow-model-settings__row-label">
          {label}
        </Typography.Text>
      </div>
      <div className="agent-flow-model-settings__row-control">
        <Slider
          disabled={!enabled}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(next) => onChange(Array.isArray(next) ? next[0] ?? value : next)}
        />
        <span className="agent-flow-model-settings__value">
          {formatter ? formatter(value) : value}
        </span>
      </div>
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
  const providerInstanceId =
    typeof adapter.getValue('config.provider_instance_id') === 'string'
      ? String(adapter.getValue('config.provider_instance_id')).trim()
      : '';
  const modelValue =
    typeof adapter.getValue('config.model') === 'string'
      ? String(adapter.getValue('config.model')).trim()
      : '';
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
  const temperature = clampNumber(adapter.getValue('config.temperature'), 0.7);
  const topP = clampNumber(adapter.getValue('config.top_p'), 1);
  const presencePenalty = clampNumber(adapter.getValue('config.presence_penalty'), 0);
  const frequencyPenalty = clampNumber(adapter.getValue('config.frequency_penalty'), 0);
  const maxTokens = clampNumber(adapter.getValue('config.max_tokens'), 512);
  const seed = clampNumber(adapter.getValue('config.seed'), 0);

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
    selectedProvider && modelValue && selectedModel === null && providerOptionsQuery.isSuccess
  );
  const hasProviderOptions = providerOptions.length > 0;

  function openSettings() {
    setOpen(true);
  }

  function closeSettings() {
    setOpen(false);
    setProviderSearchValue('');
    setModelSearchValue('');
  }

  function selectProvider(nextProviderInstanceId: string) {
    const nextProvider = providerOptions.find(
      (option) => option.value === nextProviderInstanceId
    );

    adapter.setValue('config.provider_instance_id', nextProviderInstanceId);

    if (
      !nextProvider ||
      !nextProvider.models.some((option) => option.value === modelValue)
    ) {
      adapter.setValue('config.model', '');
    }

    setModelSearchValue('');
  }

  function selectModel(nextModel: LlmModelOption) {
    if (!providerInstanceId) {
      return;
    }

    adapter.setValue('config.model', nextModel.value);
  }

  return (
    <>
      <div className="agent-flow-model-field">
        <button
          type="button"
          aria-label={block.label}
          className="agent-flow-model-field__trigger"
          onClick={openSettings}
        >
          <ModelChip
            providerLabel={
              selectedProvider?.label || (providerInstanceId ? providerInstanceId : null)
            }
            modelLabel={selectedModel?.label || (modelValue ? modelValue : null)}
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
          onClick={openSettings}
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
            <Typography.Title
              level={5}
              className="agent-flow-model-settings__section-title"
            >
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
            <Typography.Title
              level={5}
              className="agent-flow-model-settings__section-title"
            >
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
        <div className="agent-flow-model-settings__header">
          <Typography.Title level={5}>参数</Typography.Title>
          <Button type="default" size="small">
            加载预设
          </Button>
        </div>
        <div className="agent-flow-model-settings__rows">
          <ParameterRow
            label="温度"
            value={temperature}
            enabled
            onToggle={() => undefined}
            onChange={(next) => adapter.setValue('config.temperature', next)}
            formatter={(value) => value.toFixed(1)}
          />
          <ParameterRow
            label="Top P"
            value={topP}
            enabled={Boolean(adapter.getValue('config.top_p_enabled'))}
            onToggle={(checked) => adapter.setValue('config.top_p_enabled', checked)}
            onChange={(next) => adapter.setValue('config.top_p', next)}
            formatter={(value) => value.toFixed(1)}
          />
          <ParameterRow
            label="存在惩罚"
            value={presencePenalty}
            enabled={Boolean(adapter.getValue('config.presence_penalty_enabled'))}
            onToggle={(checked) =>
              adapter.setValue('config.presence_penalty_enabled', checked)
            }
            onChange={(next) => adapter.setValue('config.presence_penalty', next)}
            min={-2}
            max={2}
            formatter={(value) => value.toFixed(1)}
          />
          <ParameterRow
            label="频率惩罚"
            value={frequencyPenalty}
            enabled={Boolean(adapter.getValue('config.frequency_penalty_enabled'))}
            onToggle={(checked) =>
              adapter.setValue('config.frequency_penalty_enabled', checked)
            }
            onChange={(next) => adapter.setValue('config.frequency_penalty', next)}
            min={-2}
            max={2}
            formatter={(value) => value.toFixed(1)}
          />
          <ParameterRow
            label="最大标记"
            value={maxTokens}
            enabled={Boolean(adapter.getValue('config.max_tokens_enabled'))}
            onToggle={(checked) => adapter.setValue('config.max_tokens_enabled', checked)}
            onChange={(next) => adapter.setValue('config.max_tokens', next)}
            min={1}
            max={4096}
            step={1}
            formatter={(value) => String(Math.round(value))}
          />
          <ParameterRow
            label="种子"
            value={seed}
            enabled={Boolean(adapter.getValue('config.seed_enabled'))}
            onToggle={(checked) => adapter.setValue('config.seed_enabled', checked)}
            onChange={(next) => adapter.setValue('config.seed', next)}
            min={0}
            max={9999}
            step={1}
            formatter={(value) => String(Math.round(value))}
          />
        </div>
      </Modal>
    </>
  );
}
