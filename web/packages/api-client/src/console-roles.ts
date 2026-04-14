import { apiFetch, apiFetchVoid } from './transport';

export interface ConsoleRole {
  code: string;
  name: string;
  scope_kind: 'system' | 'workspace';
  is_builtin: boolean;
  is_editable: boolean;
  permission_codes: string[];
}

export interface ConsoleRolePermissions {
  role_code: string;
  permission_codes: string[];
}

export interface CreateConsoleRoleInput {
  code: string;
  name: string;
  introduction: string;
}

export interface UpdateConsoleRoleInput {
  name: string;
  introduction: string;
}

export interface ReplaceConsoleRolePermissionsInput {
  permission_codes: string[];
}

export function listConsoleRoles(baseUrl?: string): Promise<ConsoleRole[]> {
  return apiFetch<ConsoleRole[]>({
    path: '/api/console/roles',
    baseUrl
  });
}

export function createConsoleRole(
  input: CreateConsoleRoleInput,
  csrfToken: string,
  baseUrl?: string
): Promise<ConsoleRole> {
  return apiFetch<ConsoleRole>({
    path: '/api/console/roles',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function updateConsoleRole(
  roleCode: string,
  input: UpdateConsoleRoleInput,
  csrfToken: string,
  baseUrl?: string
): Promise<void> {
  return apiFetchVoid({
    path: `/api/console/roles/${roleCode}`,
    method: 'PATCH',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function deleteConsoleRole(
  roleCode: string,
  csrfToken: string,
  baseUrl?: string
): Promise<void> {
  return apiFetchVoid({
    path: `/api/console/roles/${roleCode}`,
    method: 'DELETE',
    csrfToken,
    baseUrl
  });
}

export function fetchConsoleRolePermissions(
  roleCode: string,
  baseUrl?: string
): Promise<ConsoleRolePermissions> {
  return apiFetch<ConsoleRolePermissions>({
    path: `/api/console/roles/${roleCode}/permissions`,
    baseUrl
  });
}

export function replaceConsoleRolePermissions(
  roleCode: string,
  input: ReplaceConsoleRolePermissionsInput,
  csrfToken: string,
  baseUrl?: string
): Promise<void> {
  return apiFetchVoid({
    path: `/api/console/roles/${roleCode}/permissions`,
    method: 'PUT',
    body: input,
    csrfToken,
    baseUrl
  });
}
