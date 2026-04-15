import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../applications/api/applications', () => ({
  applicationsQueryKey: ['applications'],
  fetchApplications: vi.fn().mockResolvedValue([
    {
      id: 'app-1',
      application_type: 'agent_flow',
      name: 'Support Agent',
      description: 'customer support',
      icon: 'RobotOutlined',
      icon_type: 'iconfont',
      icon_background: '#E6F7F2',
      updated_at: '2026-04-15T09:00:00Z'
    }
  ]),
  createApplication: vi.fn()
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

  test('renders application cards instead of the old health summary', async () => {
    render(
      <AppProviders>
        <HomePage />
      </AppProviders>
    );

    expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument();
    expect(await screen.findByText('Support Agent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入应用' })).toBeInTheDocument();
    expect(screen.queryByText(/api-server ok/i)).not.toBeInTheDocument();
  });
});
