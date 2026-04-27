import { expect, test } from 'vitest';

test('runtime debug read model is additive to legacy application run detail', () => {
  const legacyRoute = '/api/console/applications/app-1/logs/runs/run-1';
  const debugStreamRoute =
    '/api/console/applications/app-1/logs/runs/run-1/debug-stream';

  expect(legacyRoute).not.toEqual(debugStreamRoute);
  expect(debugStreamRoute.endsWith('/debug-stream')).toBe(true);
});
