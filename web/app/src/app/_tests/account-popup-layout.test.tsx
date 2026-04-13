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

  test('horizontal submenu popup does not override native row metrics', async () => {
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
    const popupItemRuleMatch = globalCss.match(
      /\.app-shell-account-popup \.ant-menu-item,\s*\n\.app-shell-account-popup \.ant-menu-submenu-title \{([\s\S]*?)\n\}/
    );

    expect(popupItemRuleMatch).not.toBeNull();
    const popupItemRule = popupItemRuleMatch?.[1] ?? '';

    expect(popupItemRule).not.toContain('display: flex;');
    expect(popupItemRule).not.toContain('min-height:');
    expect(popupItemRule).not.toContain('line-height: 1.25;');
    expect(globalCss).toContain('.app-shell-account-popup .ant-menu-title-content');
    expect(globalCss).toContain('line-height: inherit;');
  });
});
