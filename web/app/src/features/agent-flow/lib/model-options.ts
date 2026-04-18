import type { AgentFlowModelProviderOptions } from '../api/model-provider-options';

export interface LlmProviderInstanceOption {
  value: string;
  label: string;
  providerCode: string;
  protocol: string;
  models: LlmModelOption[];
}

export interface LlmModelOption {
  value: string;
  label: string;
  providerInstanceId: string;
  providerLabel: string;
  providerCode: string;
  protocol: string;
  tag?: string;
}

function toTag(source: string) {
  if (!source) {
    return undefined;
  }

  return source.replace(/_/g, ' ').toUpperCase();
}

export function listLlmProviderInstanceOptions(
  options: AgentFlowModelProviderOptions | null | undefined
): LlmProviderInstanceOption[] {
  return (options?.instances ?? []).map((instance) => ({
    value: instance.provider_instance_id,
    label: instance.display_name,
    providerCode: instance.provider_code,
    protocol: instance.protocol,
    models: instance.models.map((model) => ({
      value: model.model_id,
      label: model.display_name || model.model_id,
      providerInstanceId: instance.provider_instance_id,
      providerLabel: instance.display_name,
      providerCode: instance.provider_code,
      protocol: instance.protocol,
      tag: toTag(model.source)
    }))
  }));
}

export function findLlmProviderInstanceOption(
  options: AgentFlowModelProviderOptions | null | undefined,
  providerInstanceId: string | null | undefined
) {
  if (!providerInstanceId) {
    return null;
  }

  return (
    listLlmProviderInstanceOptions(options).find(
      (instance) => instance.value === providerInstanceId
    ) ?? null
  );
}

export function findLlmModelOption(
  options: AgentFlowModelProviderOptions | null | undefined,
  providerInstanceId: string | null | undefined,
  modelId: string | null | undefined
) {
  if (!providerInstanceId || !modelId) {
    return null;
  }

  return (
    findLlmProviderInstanceOption(options, providerInstanceId)?.models.find(
      (option) => option.value === modelId
    ) ?? null
  );
}
