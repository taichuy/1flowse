import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@1flowse/api-client', () => ({
  createConsoleApplication: vi.fn().mockResolvedValue({
    id: 'app-1'
  }),
  getConsoleApplication: vi.fn().mockResolvedValue({
    id: 'app-1'
  }),
  listConsoleApplications: vi.fn().mockResolvedValue([]),
  getDefaultApiBaseUrl: vi.fn().mockReturnValue('http://127.0.0.1:7800')
}));

import {
  createConsoleApplication,
  getConsoleApplication,
  getDefaultApiBaseUrl,
  listConsoleApplications
} from '@1flowse/api-client';

import {
  createApplication,
  fetchApplicationDetail,
  fetchApplications,
  getApplicationsApiBaseUrl
} from '../api/applications';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('applications api', () => {
  test('prefers VITE_API_BASE_URL when it is present', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.flowse.test');

    expect(getApplicationsApiBaseUrl({ protocol: 'http:', hostname: 'ignored-host' })).toBe(
      'https://api.flowse.test'
    );
    expect(getDefaultApiBaseUrl).not.toHaveBeenCalled();
  });

  test('passes the resolved base url to list detail and create requests', async () => {
    const input = {
      application_type: 'agent_flow' as const,
      name: 'Support Agent',
      description: 'customer support',
      icon: 'RobotOutlined',
      icon_type: 'iconfont',
      icon_background: '#E6F7F2'
    };

    expect(
      getApplicationsApiBaseUrl({
        protocol: 'https:',
        hostname: 'workspace.local'
      })
    ).toBe('http://127.0.0.1:7800');

    await fetchApplications();
    await fetchApplicationDetail('app-1');
    await createApplication(input, 'csrf-123');

    expect(listConsoleApplications).toHaveBeenCalledWith('http://127.0.0.1:7800');
    expect(getConsoleApplication).toHaveBeenCalledWith('app-1', 'http://127.0.0.1:7800');
    expect(createConsoleApplication).toHaveBeenCalledWith(
      input,
      'csrf-123',
      'http://127.0.0.1:7800'
    );
    expect(getDefaultApiBaseUrl).toHaveBeenCalled();
  });
});
