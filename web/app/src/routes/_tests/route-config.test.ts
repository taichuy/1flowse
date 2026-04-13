import { describe, expect, test } from 'vitest';

import { APP_ROUTES, getSelectedRouteId } from '../route-config';

describe('route truth layer', () => {
  test('keeps navigation ids, labels, paths, and selected-state logic in one source', () => {
    expect(APP_ROUTES.map((route) => route.id)).toEqual([
      'home',
      'embedded-apps',
      'embedded-runtime',
      'agent-flow'
    ]);
    expect(getSelectedRouteId('/embedded/demo-app')).toBe('embedded-apps');
  });
});
