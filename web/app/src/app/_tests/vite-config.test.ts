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
});
