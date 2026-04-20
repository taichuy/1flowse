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
  trust_level: string;
  verification_status: string;
  enabled: boolean;
  install_path: string;
  checksum: string | null;
  signature_status: string | null;
  signature_algorithm: string | null;
  signing_key_id: string | null;
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

export type ConsoleOfficialPluginInstallStatus =
  | 'not_installed'
  | 'installed'
  | 'assigned';

export interface ConsoleOfficialPluginCatalogEntry {
  plugin_id: string;
  provider_code: string;
  display_name: string;
  protocol: string;
  latest_version: string;
  help_url: string | null;
  model_discovery_mode: string;
  install_status: ConsoleOfficialPluginInstallStatus;
}

export interface ConsoleOfficialPluginCatalogResponse {
  source_kind: string;
  source_label: string;
  registry_url: string;
  entries: ConsoleOfficialPluginCatalogEntry[];
}

export interface ConsolePluginInstalledVersion {
  installation_id: string;
  plugin_version: string;
  source_kind: string;
  trust_level: string;
  created_at: string;
  is_current: boolean;
}

export interface ConsolePluginFamilyEntry {
  provider_code: string;
  display_name: string;
  protocol: string;
  help_url: string | null;
  default_base_url: string | null;
  model_discovery_mode: string;
  current_installation_id: string;
  current_version: string;
  latest_version: string | null;
  has_update: boolean;
  installed_versions: ConsolePluginInstalledVersion[];
}

export interface ConsolePluginFamilyCatalogResponse {
  locale_meta: Record<string, unknown>;
  i18n_catalog: Record<string, unknown>;
  entries: ConsolePluginFamilyEntry[];
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

export interface InstallConsoleOfficialPluginInput {
  plugin_id: string;
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

export function listConsolePluginFamilies(baseUrl?: string) {
  return apiFetch<ConsolePluginFamilyCatalogResponse>({
    path: '/api/console/plugins/families',
    baseUrl
  });
}

export function listConsoleOfficialPluginCatalog(baseUrl?: string) {
  return apiFetch<ConsoleOfficialPluginCatalogResponse>({
    path: '/api/console/plugins/official-catalog',
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

export function installConsoleOfficialPlugin(
  input: InstallConsoleOfficialPluginInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<InstallConsolePluginResult>({
    path: '/api/console/plugins/install-official',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function uploadConsolePluginPackage(
  file: File,
  csrfToken: string,
  baseUrl?: string
) {
  const formData = new FormData();
  formData.set('file', file);

  return apiFetch<InstallConsolePluginResult>({
    path: '/api/console/plugins/install-upload',
    method: 'POST',
    rawBody: formData,
    contentType: null,
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

export function upgradeConsolePluginFamilyLatest(
  providerCode: string,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsolePluginTask>({
    path: `/api/console/plugins/families/${providerCode}/upgrade-latest`,
    method: 'POST',
    csrfToken,
    baseUrl
  });
}

export function switchConsolePluginFamilyVersion(
  providerCode: string,
  input: { installation_id: string },
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsolePluginTask>({
    path: `/api/console/plugins/families/${providerCode}/switch-version`,
    method: 'POST',
    body: input,
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
