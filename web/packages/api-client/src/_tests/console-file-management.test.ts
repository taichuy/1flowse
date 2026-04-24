import { describe, expect, test, vi } from 'vitest';

vi.mock('../transport', () => ({
  apiFetch: vi.fn(async (input) => input)
}));

import {
  createConsoleFileStorage,
  createConsoleFileTable,
  fetchConsoleFileStorages,
  fetchConsoleFileTables,
  updateConsoleFileTableBinding
} from '../console-file-management';

describe('console-file-management client', () => {
  test('fetchConsoleFileStorages points at the storage collection route', async () => {
    await expect(fetchConsoleFileStorages()).resolves.toMatchObject({
      path: '/api/console/file-storages'
    });
  });

  test('fetchConsoleFileTables points at the file-table collection route', async () => {
    await expect(fetchConsoleFileTables()).resolves.toMatchObject({
      path: '/api/console/file-tables'
    });
  });

  test('updateConsoleFileTableBinding puts to the binding route', async () => {
    await expect(
      updateConsoleFileTableBinding(
        'table-1',
        { bound_storage_id: 'storage-1' },
        'csrf-123'
      )
    ).resolves.toMatchObject({
      path: '/api/console/file-tables/table-1/binding',
      method: 'PUT',
      csrfToken: 'csrf-123'
    });
  });

  test('createConsoleFileStorage posts the storage payload', async () => {
    await expect(
      createConsoleFileStorage(
        {
          code: 'local-default',
          title: 'Local',
          driver_type: 'local',
          enabled: true,
          is_default: true,
          config_json: { root_path: 'api/storage' },
          rule_json: {}
        },
        'csrf-123'
      )
    ).resolves.toMatchObject({
      path: '/api/console/file-storages',
      method: 'POST',
      csrfToken: 'csrf-123'
    });
  });

  test('createConsoleFileTable posts the table payload', async () => {
    await expect(
      createConsoleFileTable(
        {
          code: 'workspace_assets',
          title: 'Workspace Assets'
        },
        'csrf-123'
      )
    ).resolves.toMatchObject({
      path: '/api/console/file-tables',
      method: 'POST',
      csrfToken: 'csrf-123'
    });
  });
});
