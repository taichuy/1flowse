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
import { useAppStore } from '../../../state/app-store';
import { HomePage } from '../pages/HomePage';

describe('HomePage', () => {
  beforeEach(() => {
    useAppStore.setState({ visitCount: 0 });
  });

  test('renders visit count and resolved health status from the feature api layer', async () => {
    render(
      <AppProviders>
        <HomePage />
      </AppProviders>
    );

    expect(await screen.findByText('Workspace Bootstrap')).toBeInTheDocument();
    expect(screen.getByText('Visit count: 0')).toBeInTheDocument();
    expect(await screen.findByText('api-server ok (0.1.0)')).toBeInTheDocument();
  });
});
