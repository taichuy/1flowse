import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../api/health', () => ({
  getApiHealthQueryOptions: vi.fn(() => ({
    queryKey: ['api-health', 'http://127.0.0.1:7800'],
    queryFn: async () => ({
      service: 'api-server',
      status: 'ok',
      version: '0.1.0'
    })
  }))
}));

import { AppProviders } from '../../../app/AppProviders';
import { useAuthStore } from '../../../state/auth-store';
import { HomePage } from '../pages/HomePage';

describe('HomePage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuthenticated({
      csrfToken: 'csrf-123',
      actor: {
        id: 'user-1',
        account: 'root',
        effective_display_role: 'manager',
        current_workspace_id: 'workspace-1'
      },
      me: {
        id: 'user-1',
        account: 'root',
        email: 'root@example.com',
        phone: null,
        nickname: 'Captain Root',
        name: 'Root',
        avatar_url: null,
        introduction: '',
        effective_display_role: 'manager',
        permissions: ['route_page.view.all']
      }
    });
  });

  test('renders authenticated welcome copy, role summary, and compact backend health', async () => {
    render(
      <AppProviders>
        <HomePage />
      </AppProviders>
    );

    expect(await screen.findByText('欢迎，Root')).toBeInTheDocument();
    expect(screen.getByText('当前角色 manager')).toBeInTheDocument();
    expect(await screen.findByText('api-server ok (0.1.0)')).toBeInTheDocument();
    expect(screen.queryByText('API Health')).not.toBeInTheDocument();
  });
});
