import type { AgentFlowModelProviderOptions } from '../api/model-provider-options';

export interface LlmProviderOption {
  value: string;
  label: string;
  providerCode: string;
  protocol: string;
  models: LlmModelOption[];
}

export interface LlmModelOption {
  value: string;
  label: string;
  providerLabel: string;
  providerCode: string;
  protocol: string;
  parameterForm: NonNullable<
    AgentFlowModelProviderOptions['providers'][number]['models'][number]['parameter_form']
  > | null;
  tag?: string;
}

function toTag(source: string) {
  if (!source) {
    return undefined;
  }

  return source.replace(/_/g, ' ').toUpperCase();
}

export function listLlmProviderOptions(
  options: AgentFlowModelProviderOptions | null | undefined
): LlmProviderOption[] {
  return (options?.providers ?? []).map((provider) => ({
    value: provider.provider_code,
    label: provider.display_name,
    providerCode: provider.provider_code,
    protocol: provider.protocol,
    models: provider.models.map((model) => ({
      value: model.model_id,
      label: model.display_name || model.model_id,
      providerLabel: provider.display_name,
      providerCode: provider.provider_code,
      protocol: provider.protocol,
      parameterForm: model.parameter_form,
      tag: toTag(model.source)
    }))
  }));
}

export function findLlmProviderOption(
  options: AgentFlowModelProviderOptions | null | undefined,
  providerCode: string | null | undefined
) {
  if (!providerCode) {
    return null;
  }

  return (
    listLlmProviderOptions(options).find((provider) => provider.value === providerCode) ?? null
  );
}

export function findLlmModelOption(
  options: AgentFlowModelProviderOptions | null | undefined,
  providerCode: string | null | undefined,
  modelId: string | null | undefined
) {
  if (!providerCode || !modelId) {
    return null;
  }

  return (
    findLlmProviderOption(options, providerCode)?.models.find((option) => option.value === modelId) ??
    null
  );
}
