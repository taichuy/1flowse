import {
  fetchConsoleApiDocsCatalog,
  fetchConsoleApiDocsCategorySpec,
  type ConsoleApiDocsCatalog
} from '@1flowse/api-client';

export type SettingsApiDocsCatalog = ConsoleApiDocsCatalog;

export const settingsApiDocsCatalogQueryKey = ['settings', 'docs', 'catalog'] as const;
export const settingsApiDocsCategorySpecQueryKey = (categoryId: string) =>
  ['settings', 'docs', 'category', categoryId, 'openapi'] as const;

export function fetchSettingsApiDocsCatalog(): Promise<SettingsApiDocsCatalog> {
  return fetchConsoleApiDocsCatalog();
}

export function fetchSettingsApiDocsCategorySpec(categoryId: string) {
  return fetchConsoleApiDocsCategorySpec(categoryId);
}
