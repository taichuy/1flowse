import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const membersApi = vi.hoisted(() => ({
  settingsMembersQueryKey: ['settings', 'members'],
  fetchSettingsMembers: vi.fn(),
  createSettingsMember: vi.fn(),
  disableSettingsMember: vi.fn(),
  resetSettingsMemberPassword: vi.fn(),
  replaceSettingsMemberRoles: vi.fn()
}));

const rolesApi = vi.hoisted(() => ({
  settingsRolesQueryKey: ['settings', 'roles'],
  settingsRolePermissionsQueryKey: vi.fn((roleCode: string) => [
    'settings',
    'roles',
    roleCode,
    'permissions'
  ]),
  fetchSettingsRoles: vi.fn(),
  createSettingsRole: vi.fn(),
  updateSettingsRole: vi.fn(),
  deleteSettingsRole: vi.fn(),
  fetchSettingsRolePermissions: vi.fn(),
  replaceSettingsRolePermissions: vi.fn()
}));

const permissionsApi = vi.hoisted(() => ({
  settingsPermissionsQueryKey: ['settings', 'permissions'],
  fetchSettingsPermissions: vi.fn()
}));

const docsApi = vi.hoisted(() => ({
  settingsApiDocsCatalogQueryKey: ['settings', 'docs', 'catalog'],
  settingsApiDocsCategoryOperationsQueryKey: vi.fn((categoryId: string) => [
    'settings',
    'docs',
    'category',
    categoryId,
    'operations'
  ]),
  settingsApiDocsOperationSpecQueryKey: vi.fn((operationId: string) => [
    'settings',
    'docs',
    'operation',
    operationId,
    'openapi'
  ]),
  fetchSettingsApiDocsCatalog: vi.fn(),
  fetchSettingsApiDocsCategoryOperations: vi.fn(),
  fetchSettingsApiDocsOperationSpec: vi.fn()
}));

const modelProvidersApi = vi.hoisted(() => ({
  settingsModelProviderCatalogQueryKey: ['settings', 'model-providers', 'catalog'],
  settingsModelProviderInstancesQueryKey: ['settings', 'model-providers', 'instances'],
  settingsModelProviderOptionsQueryKey: ['settings', 'model-providers', 'options'],
  settingsModelProviderModelsQueryKey: vi.fn((instanceId: string) => [
    'settings',
    'model-providers',
    'models',
    instanceId
  ]),
  fetchSettingsModelProviderCatalog: vi.fn(),
  fetchSettingsModelProviderInstances: vi.fn(),
  fetchSettingsModelProviderOptions: vi.fn(),
  fetchSettingsModelProviderMainInstance: vi.fn(),
  fetchSettingsModelProviderModels: vi.fn(),
  previewSettingsModelProviderModels: vi.fn(),
  createSettingsModelProviderInstance: vi.fn(),
  updateSettingsModelProviderInstance: vi.fn(),
  updateSettingsModelProviderMainInstance: vi.fn(),
  revealSettingsModelProviderSecret: vi.fn(),
  validateSettingsModelProviderInstance: vi.fn(),
  refreshSettingsModelProviderModels: vi.fn(),
  deleteSettingsModelProviderInstance: vi.fn()
}));

const fileManagementApi = vi.hoisted(() => ({
  settingsFileStoragesQueryKey: ['settings', 'files', 'storages'],
  settingsFileTablesQueryKey: ['settings', 'files', 'tables'],
  fetchSettingsFileStorages: vi.fn(),
  createSettingsFileStorage: vi.fn(),
  fetchSettingsFileTables: vi.fn(),
  createSettingsFileTable: vi.fn(),
  updateSettingsFileTableBinding: vi.fn()
}));

vi.mock('../../features/settings/api/members', () => membersApi);
vi.mock('../../features/settings/api/roles', () => rolesApi);
vi.mock('../../features/settings/api/permissions', () => permissionsApi);
vi.mock('../../features/settings/api/api-docs', () => docsApi);
vi.mock('../../features/settings/api/model-providers', () => modelProvidersApi);
vi.mock('../../features/settings/api/file-management', () => fileManagementApi);

import { AppProviders } from '../../app/AppProviders';
import { AppRouterProvider } from '../../app/router';
import { resetAuthStore, useAuthStore } from '../../state/auth-store';

function authenticateWithPermissions(
  permissions: string[],
  effectiveDisplayRole: 'manager' | 'root' = 'manager'
) {
  useAuthStore.getState().setAuthenticated({
    csrfToken: 'csrf-123',
    actor: {
      id: 'user-1',
      account: effectiveDisplayRole,
      effective_display_role: effectiveDisplayRole,
      current_workspace_id: 'workspace-1'
    },
    me: {
      id: 'user-1',
      account: effectiveDisplayRole,
      email: 'user@example.com',
      phone: null,
      nickname: 'User',
      name: 'User',
      avatar_url: null,
      introduction: '',
      effective_display_role: effectiveDisplayRole,
      permissions
    }
  });
}

function renderApp(pathname: string) {
  window.history.pushState({}, '', pathname);

  return render(
    <AppProviders>
      <AppRouterProvider />
    </AppProviders>
  );
}

describe('section shell routing', () => {
  beforeEach(() => {
    resetAuthStore();
    membersApi.fetchSettingsMembers.mockResolvedValue([]);
    rolesApi.fetchSettingsRoles.mockResolvedValue([]);
    rolesApi.fetchSettingsRolePermissions.mockResolvedValue({
      role_code: 'manager',
      permission_codes: []
    });
    permissionsApi.fetchSettingsPermissions.mockResolvedValue([]);
    docsApi.fetchSettingsApiDocsCatalog.mockResolvedValue({
      title: '1flowbase API',
      version: '0.1.0',
      categories: []
    });
    docsApi.fetchSettingsApiDocsCategoryOperations.mockResolvedValue({
      id: 'console',
      label: '控制面',
      operations: []
    });
    docsApi.fetchSettingsApiDocsOperationSpec.mockResolvedValue({
      openapi: '3.1.0',
      info: { title: '1flowbase API', version: '0.1.0' },
      paths: {},
      components: {}
    });
    modelProvidersApi.fetchSettingsModelProviderCatalog.mockResolvedValue([]);
    modelProvidersApi.fetchSettingsModelProviderInstances.mockResolvedValue([]);
    modelProvidersApi.fetchSettingsModelProviderOptions.mockResolvedValue({
      locale_meta: {
        requested_locale: 'zh_Hans',
        resolved_locale: 'zh_Hans',
        fallback_locale: 'en_US',
        supported_locales: ['zh_Hans', 'en_US']
      },
      i18n_catalog: {},
      providers: []
    });
    modelProvidersApi.fetchSettingsModelProviderMainInstance.mockResolvedValue({
      provider_code: 'openai_compatible',
      auto_include_new_instances: true
    });
    fileManagementApi.fetchSettingsFileStorages.mockResolvedValue([]);
    fileManagementApi.fetchSettingsFileTables.mockResolvedValue([
      {
        id: 'table-1',
        code: 'attachments',
        title: 'Attachments',
        scope_kind: 'workspace',
        scope_id: 'workspace-1',
        model_definition_id: 'model-1',
        bound_storage_id: 'storage-1',
        bound_storage_title: 'Local Default',
        is_builtin: true,
        is_default: true,
        status: 'active'
      }
    ]);
  });

  test(
    'redirects /me to /me/profile',
    async () => {
      authenticateWithPermissions(['route_page.view.all']);

      renderApp('/me');

      await waitFor(() => {
        expect(window.location.pathname).toBe('/me/profile');
      });
    },
    10000
  );

  test('redirects /settings to /settings/members when docs is hidden but members is visible', async () => {
    authenticateWithPermissions(['route_page.view.all', 'user.view.all']);

    renderApp('/settings');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/settings/members');
    });
    expect(await screen.findByRole('link', { name: '用户管理' })).toHaveAttribute(
      'href',
      '/settings/members'
    );
  }, 10000);

  test('redirects /settings/docs to /settings/roles when docs is hidden but roles is visible', async () => {
    authenticateWithPermissions(['route_page.view.all', 'role_permission.view.all']);

    renderApp('/settings/docs');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/settings/roles');
    });
    expect(await screen.findByRole('link', { name: '权限管理' })).toHaveAttribute(
      'href',
      '/settings/roles'
    );
  });

  test('redirects /settings/docs to /settings/model-providers when model providers is the only visible section', async () => {
    authenticateWithPermissions(['route_page.view.all', 'state_model.view.all']);

    renderApp('/settings/docs');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/settings/model-providers');
    });
    expect(await screen.findByRole('link', { name: '模型供应商' })).toHaveAttribute(
      'href',
      '/settings/model-providers'
    );
  });

  test('redirects /settings/docs to /settings/files when file management is the only visible section', async () => {
    authenticateWithPermissions(['route_page.view.all', 'file_table.view.own']);

    renderApp('/settings/docs');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/settings/files');
    });
    expect(await screen.findByRole('link', { name: '文件管理' })).toHaveAttribute(
      'href',
      '/settings/files'
    );
  });
});
