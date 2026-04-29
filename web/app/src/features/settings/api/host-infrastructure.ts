import {
  listConsoleHostInfrastructureProviders,
  saveConsoleHostInfrastructureProviderConfig,
  type ConsoleHostInfrastructureProviderConfig,
  type SaveConsoleHostInfrastructureProviderConfigInput
} from '@1flowbase/api-client';

export type SettingsHostInfrastructureProviderConfig =
  ConsoleHostInfrastructureProviderConfig;

export type SaveSettingsHostInfrastructureProviderConfigInput =
  SaveConsoleHostInfrastructureProviderConfigInput;

export const settingsHostInfrastructureProvidersQueryKey = [
  'settings',
  'host-infrastructure',
  'providers'
] as const;

export function fetchSettingsHostInfrastructureProviders() {
  return listConsoleHostInfrastructureProviders();
}

export function saveSettingsHostInfrastructureProviderConfig(
  installationId: string,
  providerCode: string,
  input: SaveSettingsHostInfrastructureProviderConfigInput,
  csrfToken: string
) {
  return saveConsoleHostInfrastructureProviderConfig(
    installationId,
    providerCode,
    input,
    csrfToken
  );
}
