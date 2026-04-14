import { useNavigate } from '@tanstack/react-router';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';

import { signOut } from '../features/auth/api/session';
import { useAuthStore } from '../state/auth-store';
import { createAccountMenuItems } from './account-menu-items';

interface AccountMenuBaseProps {
  navigateTo: (path: '/me' | '/sign-in') => Promise<void> | void;
}

function AccountMenuBase({ navigateTo }: AccountMenuBaseProps) {
  const { csrfToken, actor, me, setAnonymous } = useAuthStore();
  const accountLabel = me?.nickname || me?.name || actor?.account || '用户';

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') {
      void navigateTo('/me');
      return;
    }

    if (key === 'sign-out') {
      void (async () => {
        try {
          if (csrfToken) {
            await signOut(csrfToken);
          }
        } finally {
          setAnonymous();
          await navigateTo('/sign-in');
        }
      })();
    }
  };

  return (
    <Menu
      className="app-shell-account-menu"
      mode="horizontal"
      selectable={false}
      items={createAccountMenuItems(accountLabel)}
      onClick={handleClick}
      disabledOverflow
    />
  );
}

function RoutedAccountMenu() {
  const navigate = useNavigate();

  return (
    <AccountMenuBase
      navigateTo={(path) => navigate({ to: path })}
    />
  );
}

function StaticAccountMenu() {
  return (
    <AccountMenuBase
      navigateTo={(path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
    />
  );
}

export function AccountMenu({
  useRouterNavigation = false
}: {
  useRouterNavigation?: boolean;
}) {
  return useRouterNavigation ? <RoutedAccountMenu /> : <StaticAccountMenu />;
}
