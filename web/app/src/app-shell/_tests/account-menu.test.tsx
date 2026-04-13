import { describe, expect, test } from 'vitest';

import { createAccountMenuItems } from '../account-menu-items';

describe('createAccountMenuItems', () => {
  test('uses native Ant menu icons for account actions', () => {
    const items = createAccountMenuItems() ?? [];
    const accountItem = items[0];
    const rawChildren =
      accountItem &&
      typeof accountItem === 'object' &&
      'children' in accountItem &&
      Array.isArray(accountItem.children)
        ? accountItem.children
        : [];

    expect(
      rawChildren.flatMap((item: unknown) => {
        if (
          !item ||
          typeof item !== 'object' ||
          !('key' in item) ||
          typeof item.key !== 'string' ||
          !('label' in item) ||
          typeof item.label !== 'string'
        ) {
          return [];
        }

        return [
          {
            key: item.key,
            label: item.label,
            hasIcon: 'icon' in item && Boolean(item.icon)
          }
        ];
      })
    ).toEqual([
      { key: 'profile', label: 'Profile', hasIcon: true },
      { key: 'settings', label: 'Settings', hasIcon: true },
      { key: 'sign-out', label: 'Sign out', hasIcon: true }
    ]);
  });
});
