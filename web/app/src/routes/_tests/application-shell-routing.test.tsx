import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiClientError } from '@1flowse/api-client';
import { AppProviders } from '../../app/AppProviders';
import { AppRouterProvider } from '../../app/router';
import { resetAuthStore, useAuthStore } from '../../state/auth-store';

const applicationApi = vi.hoisted(() => ({
  applicationsQueryKey: ['applications'],
  applicationDetailQueryKey: (applicationId: string) => ['applications', applicationId],
  fetchApplications: vi.fn(),
  createApplication: vi.fn(),
  fetchApplicationDetail: vi.fn()
}));

vi.mock('../../features/applications/api/applications', () => applicationApi);

function authenticate() {
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
      permissions: ['route_page.view.all', 'application.view.all']
    }
  });
}

describe('application shell routing', () => {
  beforeEach(() => {
    resetAuthStore();
    authenticate();
    applicationApi.fetchApplications.mockReset();
    applicationApi.fetchApplications.mockResolvedValue([]);
    applicationApi.fetchApplicationDetail.mockReset();
    applicationApi.fetchApplicationDetail.mockResolvedValue({
      id: 'app-1',
      application_type: 'agent_flow',
      name: 'Support Agent',
      description: 'customer support',
      icon: 'RobotOutlined',
      icon_type: 'iconfont',
      icon_background: '#E6F7F2',
      updated_at: '2026-04-15T09:00:00Z',
      sections: {
        orchestration: {
          status: 'planned',
          subject_kind: 'agent_flow',
          subject_status: 'unconfigured',
          current_subject_id: null,
          current_draft_id: null
        },
        api: {
          status: 'planned',
          credential_kind: 'application_api_key',
          invoke_routing_mode: 'api_key_bound_application',
          invoke_path_template: null,
          api_capability_status: 'planned',
          credentials_status: 'planned'
        },
        logs: {
          status: 'planned',
          runs_capability_status: 'planned',
          run_object_kind: 'application_run',
          log_retention_status: 'planned'
        },
        monitoring: {
          status: 'planned',
          metrics_capability_status: 'planned',
          metrics_object_kind: 'application_metrics',
          tracing_config_status: 'planned'
        }
      }
    });
  });

  test('redirects /applications/:id to orchestration', async () => {
    window.history.pushState({}, '', '/applications/app-1');
    render(
      <AppProviders>
        <AppRouterProvider />
      </AppProviders>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/applications/app-1/orchestration');
    });
  });

  test('renders section navigation and planned API copy', async () => {
    window.history.pushState({}, '', '/applications/app-1/api');
    render(
      <AppProviders>
        <AppRouterProvider />
      </AppProviders>
    );

    expect(
      await screen.findByRole('heading', { name: 'Support Agent', level: 4 })
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Section navigation' })).toBeInTheDocument();
    expect(screen.getByText(/API Key 绑定应用/i)).toBeInTheDocument();
  });

  test('renders formal 403 state for inaccessible applications', async () => {
    applicationApi.fetchApplicationDetail.mockRejectedValue(
      new ApiClientError({ status: 403, message: 'forbidden' })
    );

    window.history.pushState({}, '', '/applications/app-1/logs');
    render(
      <AppProviders>
        <AppRouterProvider />
      </AppProviders>
    );

    expect(await screen.findByText('无权限访问')).toBeInTheDocument();
  });
});
