import {
  LogoutOutlined,
  SettingOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

export function createAccountMenuItems(): MenuProps['items'] {
  return [
    {
      key: 'account',
      label: (
        <span className="app-shell-account-block">
          <span className="app-shell-account-label">Taichu</span>
        </span>
      ),
      popupClassName: 'app-shell-account-popup',
      children: [
        {
          key: 'profile',
          label: 'Profile',
          icon: <UserOutlined />
        },
        {
          key: 'settings',
          label: 'Settings',
          icon: <SettingOutlined />
        },
        { type: 'divider' },
        {
          key: 'sign-out',
          label: 'Sign out',
          icon: <LogoutOutlined />
        }
      ]
    }
  ];
}
