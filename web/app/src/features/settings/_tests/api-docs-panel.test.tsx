import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const docsApi = vi.hoisted(() => ({
  settingsApiDocsCatalogQueryKey: ['settings', 'docs', 'catalog'],
  settingsApiDocsCategorySpecQueryKey: vi.fn((categoryId: string) => [
    'settings',
    'docs',
    'category',
    categoryId,
    'openapi'
  ]),
  fetchSettingsApiDocsCatalog: vi.fn(),
  fetchSettingsApiDocsCategorySpec: vi.fn()
}));

vi.mock('../api/api-docs', () => docsApi);
vi.mock('@tanstack/react-router', async () => {
  const React = await import('react');

  return {
    useRouterState: ({
      select
    }: {
      select: (state: { location: { search: Record<string, string> } }) => unknown;
    }) => {
      const search = React.useSyncExternalStore(
        (onStoreChange) => {
          window.addEventListener('popstate', onStoreChange);
          return () => window.removeEventListener('popstate', onStoreChange);
        },
        () => window.location.search,
        () => window.location.search
      );

      return select({
        location: {
          search: Object.fromEntries(new URLSearchParams(search))
        }
      });
    }
  };
});
vi.mock('@scalar/api-reference-react', () => ({
  ApiReferenceReact: ({
    configuration
  }: {
    configuration: { content: unknown };
  }) => <div data-testid="scalar-viewer">{JSON.stringify(configuration.content)}</div>
}));

import { AppProviders } from '../../../app/AppProviders';
import { ApiDocsPanel } from '../components/ApiDocsPanel';

const catalogPayload = {
  title: '1Flowse API',
  version: '0.1.0',
  categories: [
    {
      id: 'console',
      label: 'console',
      operation_count: 2
    },
    {
      id: 'runtime',
      label: 'runtime',
      operation_count: 1
    },
    {
      id: 'single:health',
      label: '/health',
      operation_count: 1
    }
  ]
};

const categorySpecById = {
  console: {
    openapi: '3.1.0',
    info: { title: '1Flowse API', version: '0.1.0' },
    paths: {
      '/api/console/me': {
        patch: {
          operationId: 'patch_me',
          summary: 'Update current profile',
          responses: {
            '200': { description: 'ok' }
          }
        }
      },
      '/api/console/members': {
        get: {
          operationId: 'list_members',
          summary: 'List members',
          responses: {
            '200': { description: 'ok' }
          }
        }
      }
    },
    components: {}
  },
  runtime: {
    openapi: '3.1.0',
    info: { title: '1Flowse API', version: '0.1.0' },
    paths: {
      '/api/runtime/jobs': {
        get: {
          operationId: 'list_runtime_jobs',
          summary: 'Enumerate runtime jobs',
          responses: {
            '200': { description: 'ok' }
          }
        }
      }
    },
    components: {}
  },
  'single:health': {
    openapi: '3.1.0',
    info: { title: '1Flowse API', version: '0.1.0' },
    paths: {
      '/health': {
        get: {
          operationId: 'health',
          summary: 'Health check',
          responses: {
            '200': { description: 'ok' }
          }
        }
      }
    },
    components: {}
  }
};

function renderApp(pathname: string) {
  window.history.pushState({}, '', pathname);

  return render(
    <AppProviders>
      <ApiDocsPanel />
    </AppProviders>
  );
}

describe('ApiDocsPanel', () => {
  beforeEach(() => {
    docsApi.fetchSettingsApiDocsCatalog.mockResolvedValue(catalogPayload);
    docsApi.fetchSettingsApiDocsCategorySpec.mockImplementation((categoryId: string) =>
      Promise.resolve(categorySpecById[categoryId as keyof typeof categorySpecById])
    );
  });

  test('renders category cards at the top and loads the default category spec', async () => {
    renderApp('/settings/docs');

    expect(await screen.findByRole('button', { name: /console/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /runtime/i })).toBeInTheDocument();
    expect(screen.getByText('2 个接口')).toBeInTheDocument();
    expect(await screen.findByTestId('scalar-viewer')).toHaveTextContent('/api/console/me');
    expect(screen.getByTestId('scalar-viewer')).toHaveTextContent('/api/console/members');
    expect(docsApi.fetchSettingsApiDocsCategorySpec).toHaveBeenCalledWith('console');
  });

  test('switches category cards and replaces Scalar content with the whole category spec', async () => {
    renderApp('/settings/docs');

    fireEvent.click(await screen.findByRole('button', { name: /runtime/i }));

    await waitFor(() => {
      expect(window.location.search).toBe('?category=runtime');
    });
    expect(await screen.findByTestId('scalar-viewer')).toHaveTextContent('/api/runtime/jobs');
    expect(screen.getByTestId('scalar-viewer')).not.toHaveTextContent('/api/console/me');
    expect(docsApi.fetchSettingsApiDocsCategorySpec).toHaveBeenCalledWith('runtime');
  });

  test('loads the deep-linked category and marks its card active', async () => {
    renderApp('/settings/docs?category=single%3Ahealth');

    const healthCard = await screen.findByRole('button', { name: /health/i });
    expect(healthCard).toHaveAttribute('data-active', 'true');
    expect(await screen.findByTestId('scalar-viewer')).toHaveTextContent('/health');
    expect(docsApi.fetchSettingsApiDocsCategorySpec).toHaveBeenCalledWith('single:health');
  });

  test('imports Scalar stylesheet for the detail renderer', async () => {
    const componentSource = await readFile(
      path.resolve(process.cwd(), 'src/features/settings/components/ApiDocsPanel.tsx'),
      'utf8'
    );

    expect(componentSource).toContain("import '@scalar/api-reference-react/style.css';");
  });

  test('uses top category cards instead of a left sidebar split', async () => {
    const cssSource = await readFile(
      path.resolve(process.cwd(), 'src/features/settings/components/api-docs-panel.css'),
      'utf8'
    );

    expect(cssSource).toContain('.api-docs-panel__categories');
    expect(cssSource).toContain('grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));');
  });
});
