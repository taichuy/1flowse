import { apiFetch } from './transport';

export interface ConsolePermission {
  code: string;
  resource: string;
  action: string;
  scope: string;
  name: string;
}

export function listConsolePermissions(baseUrl?: string): Promise<ConsolePermission[]> {
  return apiFetch<ConsolePermission[]>({
    path: '/api/console/permissions',
    baseUrl
  });
}
