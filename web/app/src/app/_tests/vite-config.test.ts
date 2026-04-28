import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

describe('vite config', () => {
  test('proxies API and health routes to the backend for same-origin docs requests', async () => {
    const source = await readFile(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(source).toContain("'/api'");
    expect(source).toContain("'/health'");
    expect(source).toContain("'/openapi.json'");
    expect(source).toContain('target: apiProxyTarget');
  });

  test('keeps heavyweight route pages behind dynamic imports', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'src/app/router.tsx'),
      'utf8'
    );

  expect(source).toMatch(
    /lazy\(\(\) =>\s+import\('\.\.\/features\/applications\/pages\/ApplicationDetailPage'\)/
  );
  expect(source).toMatch(
    /lazy\(\(\) =>\s+import\('\.\.\/features\/settings\/pages\/SettingsPage'\)/
  );
    expect(source).not.toContain(
      "import { ApplicationDetailPage } from '../features/applications/pages/ApplicationDetailPage'"
    );
    expect(source).not.toContain(
      "import { SettingsPage } from '../features/settings/pages/SettingsPage'"
    );
  });

  test('splits large frontend dependencies into named chunks', async () => {
    const source = await readFile(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(source).toContain('manualChunks');
    expect(source).toContain('flow-vendor');
    expect(source).toContain('monaco-vendor');
    expect(source).toContain('chunkSizeWarningLimit: 3500');
  });
});
