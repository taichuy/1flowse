import {
  getConsolePluginTask,
  installConsoleOfficialPlugin,
  listConsolePluginFamilies,
  listConsoleOfficialPluginCatalog,
  uploadConsolePluginPackage,
  type ConsoleOfficialPluginCatalogResponse,
  switchConsolePluginFamilyVersion,
  upgradeConsolePluginFamilyLatest,
  type ConsolePluginFamilyEntry,
  type ConsoleOfficialPluginCatalogEntry,
  type ConsolePluginInstallation,
  type InstallConsolePluginResult,
  type ConsolePluginTask
} from '@1flowbase/api-client';

export type SettingsPluginFamilyEntry = ConsolePluginFamilyEntry;
export type SettingsOfficialPluginCatalogEntry = ConsoleOfficialPluginCatalogEntry;
export type SettingsOfficialPluginCatalogResponse =
  ConsoleOfficialPluginCatalogResponse;
export type SettingsPluginInstallation = ConsolePluginInstallation;
export type SettingsInstallPluginResult = InstallConsolePluginResult;
export type SettingsPluginTask = ConsolePluginTask;

export const settingsPluginFamiliesQueryKey = [
  'settings',
  'plugins',
  'families'
] as const;

export const settingsOfficialPluginsQueryKey = [
  'settings',
  'plugins',
  'official-catalog'
] as const;

export function fetchSettingsPluginFamilies() {
  return listConsolePluginFamilies();
}

export function fetchSettingsOfficialPluginCatalog() {
  return listConsoleOfficialPluginCatalog();
}

export function installSettingsOfficialPlugin(
  plugin_id: string,
  csrfToken: string
) {
  return installConsoleOfficialPlugin({ plugin_id }, csrfToken);
}

export function uploadSettingsPluginPackage(file: File, csrfToken: string) {
  return uploadConsolePluginPackage(file, csrfToken);
}

export function upgradeSettingsPluginFamilyLatest(
  providerCode: string,
  csrfToken: string
) {
  return upgradeConsolePluginFamilyLatest(providerCode, csrfToken);
}

export function switchSettingsPluginFamilyVersion(
  providerCode: string,
  installation_id: string,
  csrfToken: string
) {
  return switchConsolePluginFamilyVersion(
    providerCode,
    { installation_id },
    csrfToken
  );
}

export function fetchSettingsPluginTask(taskId: string) {
  return getConsolePluginTask(taskId);
}
