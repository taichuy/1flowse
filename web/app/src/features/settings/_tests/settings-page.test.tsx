import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const membersApi = vi.hoisted(() => ({
  fetchSettingsMembers: vi.fn(),
  createSettingsMember: vi.fn(),
  disableSettingsMember: vi.fn(),
  resetSettingsMemberPassword: vi.fn(),
  replaceSettingsMemberRoles: vi.fn()
}));

const rolesApi = vi.hoisted(() => ({
  fetchSettingsRoles: vi.fn(),
  createSettingsRole: vi.fn(),
  updateSettingsRole: vi.fn(),
  deleteSettingsRole: vi.fn(),
  fetchSettingsRolePermissions: vi.fn(),
  replaceSettingsRolePermissions: vi.fn()
}));

const permissionsApi = vi.hoisted(() => ({
  fetchSettingsPermissions: vi.fn()
}));

vi.mock('../api/members', () => membersApi);
vi.mock('../api/roles', () => rolesApi);
vi.mock('../api/permissions', () => permissionsApi);

import { AppProviders } from '../../../app/AppProviders';
import { useAuthStore } from '../../../state/auth-store';
import { SettingsPage } from '../pages/SettingsPage';

function authenticateWithPermissions(permissions: string[]) {
  useAuthStore.getState().setAuthenticated({
    csrfToken: 'csrf-123',
    actor: {
      id: 'user-1',
      account: 'manager',
      effective_display_role: 'manager',
      current_workspace_id: 'workspace-1'
    },
    me: {
      id: 'user-1',
      account: 'manager',
      email: 'manager@example.com',
      phone: null,
      nickname: 'Manager',
      name: 'Manager',
      avatar_url: null,
      introduction: '',
      effective_display_role: 'manager',
      permissions
    }
  });
}

describe('SettingsPage', () => {
  beforeEach(() => {
    membersApi.fetchSettingsMembers.mockResolvedValue([]);
    rolesApi.fetchSettingsRoles.mockResolvedValue([]);
    rolesApi.fetchSettingsRolePermissions.mockResolvedValue({
      role_code: 'manager',
      permission_codes: []
    });
    permissionsApi.fetchSettingsPermissions.mockResolvedValue([]);
  });

  test('shows api docs for any authenticated user and hides privileged sections without permission', async () => {
    authenticateWithPermissions(['route_page.view.all']);

    render(
      <AppProviders>
        <SettingsPage />
      </AppProviders>
    );

    expect(await screen.findByTitle('API 文档')).toBeInTheDocument();
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument();
    expect(screen.queryByText('权限管理')).not.toBeInTheDocument();
  });

  test('renders the members panel when user.view.all is present', async () => {
    authenticateWithPermissions(['route_page.view.all', 'user.view.all']);

    render(
      <AppProviders>
        <SettingsPage />
      </AppProviders>
    );

    expect(await screen.findByText('用户管理')).toBeInTheDocument();
  });

  test('renders the role permission panel when role_permission.view.all is present', async () => {
    authenticateWithPermissions([
      'route_page.view.all',
      'user.view.all',
      'user.manage.all',
      'role_permission.view.all',
      'role_permission.manage.all'
    ]);

    render(
      <AppProviders>
        <SettingsPage />
      </AppProviders>
    );

    expect(await screen.findByText('权限管理')).toBeInTheDocument();
  });
});
