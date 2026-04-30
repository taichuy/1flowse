import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Grid } from 'antd';
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
  settingsApiDocsCategoryOperationsQueryKey: vi.fn(),
  settingsApiDocsOperationSpecQueryKey: vi.fn(),
  fetchSettingsApiDocsCatalog: vi.fn(),
  fetchSettingsApiDocsCategoryOperations: vi.fn(),
  fetchSettingsApiOperationSpec: vi.fn()
}));

const modelProvidersApi = vi.hoisted(() => ({
  settingsModelProviderCatalogQueryKey: ['settings', 'model-providers', 'catalog'],
  settingsModelProviderInstancesQueryKey: [
    'settings',
    'model-providers',
    'instances'
  ],
  settingsModelProviderOptionsQueryKey: ['settings', 'model-providers', 'options'],
  settingsModelProviderModelsQueryKey: vi.fn(),
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

const pluginsApi = vi.hoisted(() => ({
  settingsOfficialPluginsQueryKey: ['settings', 'plugins', 'official-catalog'],
  settingsPluginFamiliesQueryKey: ['settings', 'plugins', 'families'],
  fetchSettingsPluginFamilies: vi.fn(),
  fetchSettingsOfficialPluginCatalog: vi.fn(),
  installSettingsOfficialPlugin: vi.fn(),
  uploadSettingsPluginPackage: vi.fn(),
  upgradeSettingsPluginFamilyLatest: vi.fn(),
  switchSettingsPluginFamilyVersion: vi.fn(),
  fetchSettingsPluginTask: vi.fn()
}));

const systemRuntimeApi = vi.hoisted(() => ({
  settingsSystemRuntimeQueryKey: ['settings', 'system-runtime'],
  fetchSettingsSystemRuntimeProfile: vi.fn()
}));

const fileManagementApi = vi.hoisted(() => ({
  settingsFileStoragesQueryKey: ['settings', 'files', 'storages'],
  settingsFileTablesQueryKey: ['settings', 'files', 'tables'],
  fetchSettingsFileStorages: vi.fn(),
  createSettingsFileStorage: vi.fn(),
  updateSettingsFileStorage: vi.fn(),
  deleteSettingsFileStorage: vi.fn(),
  fetchSettingsFileTables: vi.fn(),
  createSettingsFileTable: vi.fn(),
  updateSettingsFileTableBinding: vi.fn(),
  deleteSettingsFileTable: vi.fn()
}));

const hostInfrastructureApi = vi.hoisted(() => ({
  settingsHostInfrastructureProvidersQueryKey: [
    'settings',
    'host-infrastructure',
    'providers'
  ],
  fetchSettingsHostInfrastructureProviders: vi.fn(),
  saveSettingsHostInfrastructureProviderConfig: vi.fn()
}));

const dataModelsApi = vi.hoisted(() => ({
  settingsDataSourcesQueryKey: ['settings', 'data-models', 'sources'],
  settingsDataModelsQueryKey: vi.fn((sourceId: string) => [
    'settings',
    'data-models',
    'models',
    sourceId
  ]),
  settingsDataModelScopeGrantsQueryKey: vi.fn((modelId: string) => [
    'settings',
    'data-models',
    'scope-grants',
    modelId
  ]),
  settingsDataModelAdvisorFindingsQueryKey: vi.fn((modelId: string) => [
    'settings',
    'data-models',
    'advisor',
    modelId
  ]),
  settingsDataModelRecordPreviewQueryKey: vi.fn((modelCode: string) => [
    'settings',
    'data-models',
    'record-preview',
    modelCode
  ]),
  fetchSettingsDataSourceInstances: vi.fn(),
  updateSettingsDataSourceDefaults: vi.fn(),
  fetchSettingsDataModels: vi.fn(),
  createSettingsDataModel: vi.fn(),
  updateSettingsDataModel: vi.fn(),
  fetchSettingsDataModelScopeGrants: vi.fn(),
  createSettingsDataModelScopeGrant: vi.fn(),
  updateSettingsDataModelScopeGrant: vi.fn(),
  fetchSettingsDataModelAdvisorFindings: vi.fn(),
  fetchSettingsDataModelRecordPreview: vi.fn()
}));

vi.mock('../api/members', () => membersApi);
vi.mock('../api/roles', () => rolesApi);
vi.mock('../api/permissions', () => permissionsApi);
vi.mock('../api/api-docs', () => docsApi);
vi.mock('../api/model-providers', () => modelProvidersApi);
vi.mock('../api/plugins', () => pluginsApi);
vi.mock('../api/system-runtime', () => systemRuntimeApi);
vi.mock('../api/file-management', () => fileManagementApi);
vi.mock('../api/host-infrastructure', () => hostInfrastructureApi);
vi.mock('../api/data-models', () => dataModelsApi);
vi.mock('@scalar/api-reference-react', () => ({
  ApiReferenceReact: () => <div data-testid="settings-page-scalar">Scalar</div>
}));

import { AppProviders } from '../../../app/AppProviders';
import { AppRouterProvider } from '../../../app/router';
import { resetAuthStore, useAuthStore } from '../../../state/auth-store';

const useBreakpointSpy = vi.spyOn(Grid, 'useBreakpoint');

function authenticate() {
  useAuthStore.getState().setAuthenticated({
    csrfToken: 'csrf-123',
    actor: {
      id: 'user-1',
      account: 'root',
      effective_display_role: 'root',
      current_workspace_id: 'workspace-1'
    },
    me: {
      id: 'user-1',
      account: 'root',
      email: 'root@example.com',
      phone: null,
      nickname: 'root',
      name: 'root',
      avatar_url: null,
      introduction: '',
      effective_display_role: 'root',
      permissions: [
        'state_model.view.all',
        'state_model.manage.all',
        'api_reference.view.all'
      ]
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

function findDataModelsNavigation() {
  return screen.findByRole('link', { name: '数据源' }, { timeout: 5000 });
}

describe('Settings data models page', () => {
  beforeEach(() => {
    resetAuthStore();
    authenticate();
    useBreakpointSpy.mockReturnValue({
      xs: true,
      sm: true,
      md: true,
      lg: true,
      xl: false,
      xxl: false
    });

    membersApi.fetchSettingsMembers.mockResolvedValue([]);
    rolesApi.fetchSettingsRoles.mockResolvedValue([]);
    rolesApi.fetchSettingsRolePermissions.mockResolvedValue({
      role_code: 'root',
      permission_codes: []
    });
    permissionsApi.fetchSettingsPermissions.mockResolvedValue([]);
    docsApi.fetchSettingsApiDocsCatalog.mockResolvedValue({
      title: '1flowbase API',
      version: '0.1.0',
      categories: []
    });
    modelProvidersApi.fetchSettingsModelProviderCatalog.mockResolvedValue([]);
    modelProvidersApi.fetchSettingsModelProviderInstances.mockResolvedValue([]);
    modelProvidersApi.fetchSettingsModelProviderOptions.mockResolvedValue({
      providers: []
    });
    pluginsApi.fetchSettingsPluginFamilies.mockResolvedValue({
      locale_meta: {},
      i18n_catalog: {},
      entries: []
    });
    pluginsApi.fetchSettingsOfficialPluginCatalog.mockResolvedValue({
      source_kind: 'official_registry',
      entries: []
    });
    systemRuntimeApi.fetchSettingsSystemRuntimeProfile.mockResolvedValue({
      topology: { relationship: 'same_host' },
      hosts: []
    });
    fileManagementApi.fetchSettingsFileStorages.mockResolvedValue([]);
    fileManagementApi.fetchSettingsFileTables.mockResolvedValue([]);
    hostInfrastructureApi.fetchSettingsHostInfrastructureProviders.mockResolvedValue([]);

    dataModelsApi.fetchSettingsDataSourceInstances.mockResolvedValue([
      {
        id: 'main_source',
        source_kind: 'main_source',
        installation_id: 'main_source',
        source_code: 'main_source',
        display_name: '主数据源',
        status: 'ready',
        default_data_model_status: 'published',
        default_api_exposure_status: 'published_not_exposed',
        config_json: {},
        secret_ref: null,
        secret_version: null,
        catalog_refresh_status: null,
        catalog_last_error_message: null,
        catalog_refreshed_at: null
      },
      {
        id: 'source-1',
        source_kind: 'external_source',
        installation_id: 'installation-1',
        source_code: 'hubspot',
        display_name: 'HubSpot',
        status: 'ready',
        default_data_model_status: 'draft',
        default_api_exposure_status: 'draft',
        config_json: {},
        secret_ref: null,
        secret_version: null,
        catalog_refresh_status: 'ready',
        catalog_last_error_message: null,
        catalog_refreshed_at: '2026-04-30T08:00:00Z'
      }
    ]);
    dataModelsApi.fetchSettingsDataModels.mockResolvedValue([
      {
        id: 'model-1',
        scope_kind: 'workspace',
        scope_id: 'workspace-1',
        code: 'contacts',
        title: 'Contacts',
        status: 'published',
        api_exposure_status: 'published_not_exposed',
        runtime_availability: 'available',
        data_source_instance_id: 'source-1',
        source_kind: 'external_source',
        external_resource_key: 'contacts',
        physical_table_name: 'dm_contacts',
        acl_namespace: 'data_model.contacts',
        audit_namespace: 'data_model.contacts',
        fields: [
          {
            id: 'field-1',
            code: 'email',
            title: 'Email',
            physical_column_name: 'email',
            external_field_key: 'email',
            field_kind: 'string',
            is_required: true,
            is_unique: true,
            default_value: null,
            display_interface: 'input',
            display_options: {},
            relation_target_model_id: null,
            relation_options: {},
            sort_order: 0
          }
        ]
      }
    ]);
    dataModelsApi.fetchSettingsDataModelScopeGrants.mockResolvedValue([
      {
        id: 'grant-owner',
        scope_kind: 'workspace',
        scope_id: 'workspace-1',
        data_model_id: 'model-1',
        enabled: true,
        permission_profile: 'owner'
      },
      {
        id: 'grant-scope',
        scope_kind: 'workspace',
        scope_id: 'workspace-1',
        data_model_id: 'model-1',
        enabled: true,
        permission_profile: 'scope_all'
      },
      {
        id: 'grant-system',
        scope_kind: 'system',
        scope_id: '00000000-0000-0000-0000-000000000000',
        data_model_id: 'model-1',
        enabled: false,
        permission_profile: 'system_all'
      }
    ]);
    dataModelsApi.fetchSettingsDataModelAdvisorFindings.mockResolvedValue([
      {
        id: 'finding-1',
        data_model_id: 'model-1',
        severity: 'blocking',
        code: 'unsafe_external_source',
        message: 'External source needs scope filtering.',
        recommended_action: 'Enable scope filtering.',
        can_acknowledge: false
      },
      {
        id: 'finding-2',
        data_model_id: 'model-1',
        severity: 'high',
        code: 'api_exposed_no_permission',
        message: 'Permission path is incomplete.',
        recommended_action: 'Check API key permissions.',
        can_acknowledge: false
      },
      {
        id: 'finding-3',
        data_model_id: 'model-1',
        severity: 'info',
        code: 'published_not_exposed',
        message: 'Published but not exposed.',
        recommended_action: 'Create API key only if needed.',
        can_acknowledge: true
      }
    ]);
    dataModelsApi.fetchSettingsDataModelRecordPreview.mockResolvedValue({
      items: [
        {
          id: 'record-1',
          email: 'person@example.com'
        }
      ],
      total: 1
    });
    dataModelsApi.updateSettingsDataModel.mockResolvedValue({
      id: 'model-1'
    });
    dataModelsApi.updateSettingsDataModelScopeGrant.mockResolvedValue({
      id: 'grant-owner'
    });
    dataModelsApi.createSettingsDataModelScopeGrant.mockResolvedValue({
      id: 'grant-new'
    });
  });

  test('shows data source navigation, defaults, and the Data Model table', async () => {
    renderApp('/settings/data-models');

    expect(await findDataModelsNavigation()).toBeInTheDocument();
    expect(await screen.findByText('主数据源')).toBeInTheDocument();
    expect(await screen.findByText('HubSpot')).toBeInTheDocument();
    expect(screen.getByLabelText('默认 Data Model 状态')).toBeInTheDocument();
    expect(screen.getByLabelText('默认 API 暴露状态')).toBeInTheDocument();

    fireEvent.click(screen.getByText('HubSpot'));
    expect(await screen.findByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('contacts')).toBeInTheDocument();
  });

  test('selects a Data Model and exposes detail tabs with safe status controls', async () => {
    renderApp('/settings/data-models');

    fireEvent.click(await screen.findByText('Contacts'));
    expect(await screen.findByRole('tab', { name: '字段' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '关系' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '权限' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'API' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '记录预览' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Advisor' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText('Data Model 状态'));
    expect(await screen.findByText('draft')).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getByText('disabled')).toBeInTheDocument();
    expect(screen.getByText('broken')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'API' }));
    expect(await screen.findByText('published_not_exposed')).toBeInTheDocument();
    expect(screen.getByText('api_exposed_ready')).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'api_exposed_ready' })
    ).not.toBeInTheDocument();
  });

  test('shows editable grants, record preview, and Advisor severities', async () => {
    renderApp('/settings/data-models');

    fireEvent.click(await screen.findByText('Contacts'));
    fireEvent.click(screen.getByRole('tab', { name: '权限' }));
    expect(await screen.findByText('owner')).toBeInTheDocument();
    expect(screen.getByText('scope_all')).toBeInTheDocument();
    expect(screen.getByText('system_all')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保存权限' }));
    await waitFor(() =>
      expect(dataModelsApi.updateSettingsDataModelScopeGrant).toHaveBeenCalled()
    );

    fireEvent.click(screen.getByRole('tab', { name: '记录预览' }));
    expect(await screen.findByText('person@example.com')).toBeInTheDocument();
    expect(dataModelsApi.fetchSettingsDataModelRecordPreview).toHaveBeenCalledWith(
      'contacts'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Advisor' }));
    const advisorTab = await screen.findByTestId('data-model-advisor-tab');
    expect(within(advisorTab).getByText('blocking')).toBeInTheDocument();
    expect(within(advisorTab).getByText('high')).toBeInTheDocument();
    expect(within(advisorTab).getByText('info')).toBeInTheDocument();
  });
});
