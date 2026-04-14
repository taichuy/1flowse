import { describe, expect, test } from 'vitest';

import { APP_ROUTES, getSelectedRouteId } from '../route-config';

describe('route truth layer', () => {
  test('keeps navigation ids, labels, paths, and selected-state logic in one source', () => {
    expect(APP_ROUTES.map((route) => route.id)).toEqual([
      'home',
      'embedded-apps',
      'tools',
      'settings',
      'me',
      'sign-in'
    ]);
    expect(getSelectedRouteId('/settings')).toBe('settings');
    expect(getSelectedRouteId('/me')).toBe('me');
  });

  test('declares guard and permission metadata for formal console routes', () => {
    expect(APP_ROUTES.find((route) => route.id === 'home')?.permissionKey).toBe(
      'route_page.view.all'
    );
    expect(APP_ROUTES.find((route) => route.id === 'embedded-apps')?.permissionKey).toBe(
      'embedded_app.view.all'
    );
    expect(APP_ROUTES.find((route) => route.id === 'settings')?.permissionKey).toBeNull();
    expect(APP_ROUTES.find((route) => route.id === 'sign-in')?.guard).toBe('public-only');
  });
});
