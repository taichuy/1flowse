import { Menu } from 'antd';

import { createAccountMenuItems } from './account-menu-items';

export function AccountMenu() {
  return (
    <Menu
      className="app-shell-account-menu"
      mode="horizontal"
      selectable={false}
      items={createAccountMenuItems()}
      disabledOverflow
    />
  );
}
