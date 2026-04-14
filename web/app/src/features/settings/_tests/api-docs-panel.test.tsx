import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

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
    configuration: unknown;
  }) => <div data-testid="scalar-viewer">{JSON.stringify(configuration)}</div>
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

const categoryOperationsById = {
  console: {
    id: 'console',
    label: 'console',
    operations: [
      {
        id: 'patch_me',
        method: 'PATCH',
        path: '/api/console/me',
        summary: 'Update current profile',
        description: 'Update current profile',
        tags: ['console'],
        group: 'console',
        deprecated: false
      },
      {
        id: 'list_members',
        method: 'GET',
        path: '/api/console/members',
        summary: 'List members',
        description: 'List members',
        tags: ['console'],
        group: 'console',
        deprecated: false
      }
    ]
  },
  runtime: {
    id: 'runtime',
    label: 'runtime',
    operations: [
      {
        id: 'list_runtime_jobs',
        method: 'GET',
        path: '/api/runtime/jobs',
        summary: 'Enumerate runtime jobs',
        description: 'Enumerate runtime jobs',
        tags: ['runtime'],
        group: 'runtime',
        deprecated: false
      }
    ]
  },
  'single:health': {
    id: 'single:health',
    label: '/health',
    operations: [
      {
        id: 'health',
        method: 'GET',
        path: '/health',
        summary: 'Health check',
        description: 'Health check',
        tags: ['health'],
        group: '/health',
        deprecated: false
      }
    ]
  }
};

const operationSpecById = {
  patch_me: {
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
      }
    },
    components: {}
  },
  list_members: {
    openapi: '3.1.0',
    info: { title: '1Flowse API', version: '0.1.0' },
    paths: {
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
  list_runtime_jobs: {
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
  health: {
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

async function selectCategory(label: string) {
  const combobox = await screen.findByRole('combobox', { name: '接口分类' });

  fireEvent.mouseDown(combobox);

  const [option] = await screen.findAllByText((_, element) => {
    if (!element) {
      return false;
    }

    return (
      element.matches('.ant-select-item-option-content') &&
      Boolean(element.textContent?.includes(label))
    );
  });

  fireEvent.click(option);
}

describe('ApiDocsPanel', () => {
  beforeEach(() => {
    docsApi.fetchSettingsApiDocsCatalog.mockResolvedValue(catalogPayload);
    docsApi.fetchSettingsApiDocsCategoryOperations.mockImplementation((categoryId: string) =>
      Promise.resolve(
        categoryOperationsById[categoryId as keyof typeof categoryOperationsById]
      )
    );
    docsApi.fetchSettingsApiDocsOperationSpec.mockImplementation((operationId: string) =>
      Promise.resolve(operationSpecById[operationId as keyof typeof operationSpecById])
    );
  });

  test('renders a header category selector and keeps the detail empty until an operation is chosen', async () => {
    renderApp('/settings/docs');

    expect(await screen.findByRole('combobox', { name: '接口分类' })).toBeInTheDocument();
    expect(screen.getByText('选择一个分类后查看接口列表')).toBeInTheDocument();
    expect(screen.getByText('选择接口后查看详情')).toBeInTheDocument();
    expect(docsApi.fetchSettingsApiDocsCategoryOperations).not.toHaveBeenCalled();
    expect(docsApi.fetchSettingsApiDocsOperationSpec).not.toHaveBeenCalled();
  });

  test('loads operations after selecting a category and keeps detail blank until an operation is chosen', async () => {
    renderApp('/settings/docs');

    await selectCategory('console');

    await waitFor(() => {
      expect(window.location.search).toBe('?category=console');
    });

    expect(await screen.findByRole('button', { name: /patch \/api\/console\/me/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get \/api\/console\/members/i })).toBeInTheDocument();
    expect(screen.getByText('选择接口后查看详情')).toBeInTheDocument();
    expect(docsApi.fetchSettingsApiDocsCategoryOperations).toHaveBeenCalledWith('console');
    expect(docsApi.fetchSettingsApiDocsOperationSpec).not.toHaveBeenCalled();
  });

  test('loads a single operation detail after choosing an operation and keeps scalar features enabled', async () => {
    renderApp('/settings/docs?category=console');

    fireEvent.click(await screen.findByRole('button', { name: /get \/api\/console\/members/i }));

    await waitFor(() => {
      expect(window.location.search).toBe('?category=console&operation=list_members');
    });

    expect(await screen.findByTestId('scalar-viewer')).toHaveTextContent('/api/console/members');
    expect(screen.getByTestId('scalar-viewer')).not.toHaveTextContent('"operationId":"patch_me"');
    expect(screen.getByTestId('scalar-viewer')).not.toHaveTextContent(
      '"hideTestRequestButton":true'
    );
    expect(screen.getByTestId('scalar-viewer')).not.toHaveTextContent('"hiddenClients":true');
    expect(screen.getByTestId('scalar-viewer')).not.toHaveTextContent(
      '"documentDownloadType":"none"'
    );
    expect(docsApi.fetchSettingsApiDocsOperationSpec).toHaveBeenCalledWith('list_members');
  });

  test('loads the deep-linked category and operation into the list-detail flow', async () => {
    renderApp('/settings/docs?category=single%3Ahealth&operation=health');

    expect(await screen.findByRole('combobox', { name: '接口分类' })).toBeInTheDocument();
    expect(screen.getByText('/health')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /get \/health/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await screen.findByTestId('scalar-viewer')).toHaveTextContent('/health');
    expect(docsApi.fetchSettingsApiDocsCategoryOperations).toHaveBeenCalledWith('single:health');
    expect(docsApi.fetchSettingsApiDocsOperationSpec).toHaveBeenCalledWith('health');
  });

  test('imports Scalar stylesheet for the detail renderer', async () => {
    const componentSource = await readFile(
      path.resolve(process.cwd(), 'src/features/settings/components/ApiDocsPanel.tsx'),
      'utf8'
    );

    expect(componentSource).toContain("import '@scalar/api-reference-react/style.css';");
  });

  test('removes the old fixed-height and clipped detail wrapper styles', async () => {
    const cssSource = await readFile(
      path.resolve(process.cwd(), 'src/features/settings/components/api-docs-panel.css'),
      'utf8'
    );

    expect(cssSource).not.toContain('min-height: 720px');
    expect(cssSource).not.toContain('overflow: hidden');
  });
});
