import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

export function createAccountMenuItems(accountLabel = '用户'): MenuProps['items'] {
  return [
    {
      key: 'account',
      label: (
        <span className="app-shell-account-block">
          <span className="app-shell-account-label">{accountLabel}</span>
        </span>
      ),
      popupClassName: 'app-shell-account-popup',
      children: [
        {
          key: 'profile',
          label: '个人资料',
          icon: <UserOutlined />
        },
        {
          key: 'sign-out',
          label: '退出登录',
          icon: <LogoutOutlined />
        }
      ]
    }
  ];
}
