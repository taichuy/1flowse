import type { PropsWithChildren } from 'react';

import { AppShell } from '@1flowse/ui';

import { AccountMenu } from './AccountMenu';
import { Navigation } from './Navigation';
import './app-shell.css';

export function AppShellFrame({
  children,
  pathname = '/',
  useRouterLinks = false
}: PropsWithChildren<{ pathname?: string; useRouterLinks?: boolean }>) {
  return (
    <AppShell
      title="1Flowse Bootstrap"
      navigation={<Navigation pathname={pathname} useRouterLinks={useRouterLinks} />}
      actions={<AccountMenu />}
    >
      {children}
    </AppShell>
  );
}
