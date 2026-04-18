import { apiFetch } from './transport';

export interface ConsoleModelProviderConfigField {
  key: string;
  field_type: string;
  required: boolean;
}

export interface ConsoleProviderModelDescriptor {
  model_id: string;
  display_name: string;
  source: string;
  supports_streaming: boolean;
  supports_tool_call: boolean;
  supports_multimodal: boolean;
  context_window: number | null;
  max_output_tokens: number | null;
  provider_metadata: Record<string, unknown>;
}

export interface ConsoleModelProviderCatalogEntry {
  installation_id: string;
  provider_code: string;
  plugin_id: string;
  plugin_version: string;
  display_name: string;
  protocol: string;
  help_url: string | null;
  default_base_url: string | null;
  model_discovery_mode: string;
  supports_model_fetch_without_credentials: boolean;
  enabled: boolean;
  form_schema: ConsoleModelProviderConfigField[];
  predefined_models: ConsoleProviderModelDescriptor[];
}

export interface ConsoleModelProviderInstance {
  id: string;
  installation_id: string;
  provider_code: string;
  protocol: string;
  display_name: string;
  status: string;
  config_json: Record<string, unknown>;
  last_validated_at: string | null;
  last_validation_status: string | null;
  last_validation_message: string | null;
  catalog_refresh_status: string | null;
  catalog_last_error_message: string | null;
  catalog_refreshed_at: string | null;
  model_count: number;
}

export interface CreateConsoleModelProviderInput {
  installation_id: string;
  display_name: string;
  config: Record<string, unknown>;
}

export interface UpdateConsoleModelProviderInput {
  display_name: string;
  config: Record<string, unknown>;
}

export interface ConsoleValidateModelProviderResult {
  instance: ConsoleModelProviderInstance;
  output: Record<string, unknown>;
}

export interface ConsoleModelProviderModelCatalog {
  provider_instance_id: string;
  refresh_status: string;
  source: string;
  last_error_message: string | null;
  refreshed_at: string | null;
  models: ConsoleProviderModelDescriptor[];
}

export interface ConsoleModelProviderOption {
  provider_instance_id: string;
  provider_code: string;
  protocol: string;
  display_name: string;
  models: ConsoleProviderModelDescriptor[];
}

export interface ConsoleModelProviderOptions {
  instances: ConsoleModelProviderOption[];
}

export interface DeleteConsoleModelProviderResult {
  deleted: boolean;
}

export function listConsoleModelProviderCatalog(baseUrl?: string) {
  return apiFetch<ConsoleModelProviderCatalogEntry[]>({
    path: '/api/console/model-providers/catalog',
    baseUrl
  });
}

export function listConsoleModelProviderInstances(baseUrl?: string) {
  return apiFetch<ConsoleModelProviderInstance[]>({
    path: '/api/console/model-providers',
    baseUrl
  });
}

export function createConsoleModelProviderInstance(
  input: CreateConsoleModelProviderInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleModelProviderInstance>({
    path: '/api/console/model-providers',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function updateConsoleModelProviderInstance(
  instanceId: string,
  input: UpdateConsoleModelProviderInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleModelProviderInstance>({
    path: `/api/console/model-providers/${instanceId}`,
    method: 'PATCH',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function validateConsoleModelProviderInstance(
  instanceId: string,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleValidateModelProviderResult>({
    path: `/api/console/model-providers/${instanceId}/validate`,
    method: 'POST',
    csrfToken,
    baseUrl
  });
}

export function getConsoleModelProviderModels(instanceId: string, baseUrl?: string) {
  return apiFetch<ConsoleModelProviderModelCatalog>({
    path: `/api/console/model-providers/${instanceId}/models`,
    baseUrl
  });
}

export function refreshConsoleModelProviderModels(
  instanceId: string,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleModelProviderModelCatalog>({
    path: `/api/console/model-providers/${instanceId}/models/refresh`,
    method: 'POST',
    csrfToken,
    baseUrl
  });
}

export function deleteConsoleModelProviderInstance(
  instanceId: string,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<DeleteConsoleModelProviderResult>({
    path: `/api/console/model-providers/${instanceId}`,
    method: 'DELETE',
    csrfToken,
    baseUrl
  });
}

export function listConsoleModelProviderOptions(baseUrl?: string) {
  return apiFetch<ConsoleModelProviderOptions>({
    path: '/api/console/model-providers/options',
    baseUrl
  });
}
