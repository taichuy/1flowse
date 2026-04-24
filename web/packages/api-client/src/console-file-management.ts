import { apiFetch } from './transport';

export interface ConsoleFileStorage {
  id: string;
  code: string;
  title: string;
  driver_type: string;
  enabled: boolean;
  is_default: boolean;
  health_status: string;
  last_health_error: string | null;
  config_json: Record<string, unknown>;
  rule_json: Record<string, unknown>;
}

export interface CreateConsoleFileStorageInput {
  code: string;
  title: string;
  driver_type: string;
  enabled: boolean;
  is_default: boolean;
  config_json: Record<string, unknown>;
  rule_json: Record<string, unknown>;
}

export interface ConsoleFileTable {
  id: string;
  code: string;
  title: string;
  scope_kind: 'system' | 'workspace';
  scope_id: string;
  model_definition_id: string;
  bound_storage_id: string;
  bound_storage_title: string | null;
  is_builtin: boolean;
  is_default: boolean;
  status: string;
}

export interface CreateConsoleFileTableInput {
  code: string;
  title: string;
}

export interface UpdateConsoleFileTableBindingInput {
  bound_storage_id: string;
}

export function fetchConsoleFileStorages(baseUrl?: string) {
  return apiFetch<ConsoleFileStorage[]>({
    path: '/api/console/file-storages',
    baseUrl
  });
}

export function createConsoleFileStorage(
  input: CreateConsoleFileStorageInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleFileStorage>({
    path: '/api/console/file-storages',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function fetchConsoleFileTables(baseUrl?: string) {
  return apiFetch<ConsoleFileTable[]>({
    path: '/api/console/file-tables',
    baseUrl
  });
}

export function createConsoleFileTable(
  input: CreateConsoleFileTableInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleFileTable>({
    path: '/api/console/file-tables',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function updateConsoleFileTableBinding(
  fileTableId: string,
  input: UpdateConsoleFileTableBindingInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleFileTable>({
    path: `/api/console/file-tables/${fileTableId}/binding`,
    method: 'PUT',
    body: input,
    csrfToken,
    baseUrl
  });
}
