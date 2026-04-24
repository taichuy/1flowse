import {
  createConsoleFileStorage,
  createConsoleFileTable,
  fetchConsoleFileStorages,
  fetchConsoleFileTables,
  updateConsoleFileTableBinding,
  type ConsoleFileStorage,
  type ConsoleFileTable,
  type CreateConsoleFileStorageInput,
  type CreateConsoleFileTableInput,
  type UpdateConsoleFileTableBindingInput
} from '@1flowbase/api-client';

export type SettingsFileStorage = ConsoleFileStorage;
export type SettingsFileTable = ConsoleFileTable;
export type CreateSettingsFileStorageInput = CreateConsoleFileStorageInput;
export type CreateSettingsFileTableInput = CreateConsoleFileTableInput;
export type UpdateSettingsFileTableBindingInput =
  UpdateConsoleFileTableBindingInput;

export const settingsFileStoragesQueryKey = [
  'settings',
  'files',
  'storages'
] as const;

export const settingsFileTablesQueryKey = [
  'settings',
  'files',
  'tables'
] as const;

export function fetchSettingsFileStorages() {
  return fetchConsoleFileStorages();
}

export function createSettingsFileStorage(
  input: CreateSettingsFileStorageInput,
  csrfToken: string
) {
  return createConsoleFileStorage(input, csrfToken);
}

export function fetchSettingsFileTables() {
  return fetchConsoleFileTables();
}

export function createSettingsFileTable(
  input: CreateSettingsFileTableInput,
  csrfToken: string
) {
  return createConsoleFileTable(input, csrfToken);
}

export function updateSettingsFileTableBinding(
  fileTableId: string,
  input: UpdateSettingsFileTableBindingInput,
  csrfToken: string
) {
  return updateConsoleFileTableBinding(fileTableId, input, csrfToken);
}
