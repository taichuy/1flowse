import fs from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';
import { Menu } from 'antd';
import { describe, expect, test } from 'vitest';

import '../../styles/global.css';
import { createAccountMenuItems } from '../router';

function getAccountPopupChildren() {
  const items = createAccountMenuItems() ?? [];
  const accountItem = items[0];

  if (
    !accountItem ||
    typeof accountItem !== 'object' ||
    !('children' in accountItem) ||
    !Array.isArray(accountItem.children)
  ) {
    return [];
  }

  return accountItem.children;
}

describe('account popup layout', () => {
  test('keeps native vertical menu row sizing', async () => {
    render(
      <div className="app-shell-account-popup">
        <Menu mode="vertical" selectable={false} items={getAccountPopupChildren()} />
      </div>
    );

    const profileItem = (await screen.findByText('Profile')).closest('.ant-menu-item');

    expect(profileItem).not.toBeNull();
    const styles = window.getComputedStyle(profileItem as HTMLElement);
    expect(styles.display).toBe('block');
    expect(styles.height).toBe(styles.lineHeight);
  });

  test('horizontal submenu popup does not stretch title content', async () => {
    render(
      <Menu
        className="app-shell-account-menu"
        mode="horizontal"
        selectable={false}
        items={createAccountMenuItems()}
        openKeys={['account']}
      />
    );

    await screen.findByText('Settings');

    const globalCss = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../styles/global.css'),
      'utf8'
    );

    expect(globalCss).toContain('.app-shell-account-popup .ant-menu-title-content');
    expect(globalCss).toContain('line-height: inherit;');
    expect(globalCss).not.toContain('line-height: 1.15;');
  });
});
