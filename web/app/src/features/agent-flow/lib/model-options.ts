import type { AgentFlowModelProviderOptions } from '../api/model-provider-options';

export interface LlmProviderOption {
  value: string;
  label: string;
  providerCode: string;
  protocol: string;
  modelGroups: LlmModelGroup[];
  models: LlmModelOption[];
}

export interface LlmModelGroup {
  key: string;
  label: string;
  sourceInstanceId: string;
  models: LlmModelOption[];
}

export interface LlmModelOption {
  value: string;
  selectionValue: string;
  label: string;
  providerLabel: string;
  providerCode: string;
  protocol: string;
  sourceInstanceId: string;
  sourceInstanceLabel: string;
  parameterForm: NonNullable<
    AgentFlowModelProviderOptions['providers'][number]['model_groups'][number]['models'][number]['parameter_form']
  > | null;
  tag?: string;
}

function toTag(source: string) {
  if (!source) {
    return undefined;
  }

  return source.replace(/_/g, ' ').toUpperCase();
}

function encodeModelSelectionValue(sourceInstanceId: string, modelId: string) {
  return `${sourceInstanceId}::${modelId}`;
}

export function listLlmProviderOptions(
  options: AgentFlowModelProviderOptions | null | undefined
): LlmProviderOption[] {
  return (options?.providers ?? []).map((provider) => ({
    value: provider.provider_code,
    label: provider.display_name,
    providerCode: provider.provider_code,
    protocol: provider.protocol,
    modelGroups: provider.model_groups.map((group) => ({
      key: group.source_instance_id,
      label: group.source_instance_display_name,
      sourceInstanceId: group.source_instance_id,
      models: group.models.map((model) => ({
        value: model.model_id,
        selectionValue: encodeModelSelectionValue(
          group.source_instance_id,
          model.model_id
        ),
        label: model.display_name || model.model_id,
        providerLabel: provider.display_name,
        providerCode: provider.provider_code,
        protocol: provider.protocol,
        sourceInstanceId: group.source_instance_id,
        sourceInstanceLabel: group.source_instance_display_name,
        parameterForm: model.parameter_form,
        tag: toTag(model.source)
      }))
    })),
    models: provider.model_groups.flatMap((group) =>
      group.models.map((model) => ({
        value: model.model_id,
        selectionValue: encodeModelSelectionValue(
          group.source_instance_id,
          model.model_id
        ),
        label: model.display_name || model.model_id,
        providerLabel: provider.display_name,
        providerCode: provider.provider_code,
        protocol: provider.protocol,
        sourceInstanceId: group.source_instance_id,
        sourceInstanceLabel: group.source_instance_display_name,
        parameterForm: model.parameter_form,
        tag: toTag(model.source)
      }))
    )
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
  sourceInstanceId: string | null | undefined,
  modelId: string | null | undefined
) {
  if (!providerCode || !sourceInstanceId || !modelId) {
    return null;
  }

  return (
    findLlmProviderOption(options, providerCode)?.models.find(
      (option) =>
        option.sourceInstanceId === sourceInstanceId && option.value === modelId
    ) ?? null
  );
}
