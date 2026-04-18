import { apiFetch } from './transport';

export interface ConsolePluginInstallation {
  id: string;
  provider_code: string;
  plugin_id: string;
  plugin_version: string;
  contract_version: string;
  protocol: string;
  display_name: string;
  source_kind: string;
  verification_status: string;
  enabled: boolean;
  install_path: string;
  checksum: string | null;
  signature_status: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConsolePluginCatalogEntry {
  installation: ConsolePluginInstallation;
  help_url: string | null;
  default_base_url: string | null;
  model_discovery_mode: string;
  assigned_to_current_workspace: boolean;
}

export interface ConsolePluginTask {
  id: string;
  installation_id: string | null;
  workspace_id: string | null;
  provider_code: string;
  task_kind: string;
  status: string;
  status_message: string | null;
  detail_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface InstallConsolePluginInput {
  package_root: string;
}

export interface InstallConsolePluginResult {
  installation: ConsolePluginInstallation;
  task: ConsolePluginTask;
}

export function listConsolePluginCatalog(baseUrl?: string) {
  return apiFetch<ConsolePluginCatalogEntry[]>({
    path: '/api/console/plugins/catalog',
    baseUrl
  });
}

export function installConsolePlugin(
  input: InstallConsolePluginInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<InstallConsolePluginResult>({
    path: '/api/console/plugins/install',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function enableConsolePlugin(
  installationId: string,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsolePluginTask>({
    path: `/api/console/plugins/${installationId}/enable`,
    method: 'POST',
    csrfToken,
    baseUrl
  });
}

export function assignConsolePlugin(
  installationId: string,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsolePluginTask>({
    path: `/api/console/plugins/${installationId}/assign`,
    method: 'POST',
    csrfToken,
    baseUrl
  });
}

export function listConsolePluginTasks(baseUrl?: string) {
  return apiFetch<ConsolePluginTask[]>({
    path: '/api/console/plugins/tasks',
    baseUrl
  });
}

export function getConsolePluginTask(taskId: string, baseUrl?: string) {
  return apiFetch<ConsolePluginTask>({
    path: `/api/console/plugins/tasks/${taskId}`,
    baseUrl
  });
}
