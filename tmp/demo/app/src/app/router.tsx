import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState
} from '@tanstack/react-router';
import { Menu, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';

import { AppShell } from '@1flowse/ui';

import { AgentFlowPage } from '../features/agent-flow/AgentFlowPage';
import { HomePage } from '../features/home/HomePage';
import { EmbeddedAppsPage } from '../features/embedded-apps/EmbeddedAppsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ToolsPage } from '../features/tools/ToolsPage';

const primaryRoutes = [
  { key: 'home', label: '工作台', to: '/' },
  { key: 'subsystems', label: '子系统', to: '/subsystems' },
  { key: 'tools', label: '工具', to: '/tools' },
  { key: 'settings', label: '设置', to: '/settings' }
] as const;

function getSelectedKey(pathname: string) {
  if (pathname.startsWith('/subsystems')) {
    return 'subsystems';
  }

  if (pathname.startsWith('/tools')) {
    return 'tools';
  }

  if (pathname.startsWith('/settings')) {
    return 'settings';
  }

  return 'home';
}

function AppNavigation() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });

  const selectedKey = getSelectedKey(pathname);
  const items: MenuProps['items'] = primaryRoutes.map((route) => ({
    key: route.key,
    label: (
      <Link
        to={route.to}
        className="app-shell-menu-link"
        aria-current={route.key === selectedKey ? 'page' : undefined}
      >
        {route.label}
      </Link>
    )
  }));

  return (
    <nav className="app-shell-navigation" aria-label="Primary">
      <Menu
        className="app-shell-menu"
        mode="horizontal"
        selectedKeys={[selectedKey]}
        items={items}
        disabledOverflow
      />
    </nav>
  );
}

function AppHeaderActions() {
  return (
    <Space size={12} className="demo-shell-actions">
      <Tag className="demo-shell-status" bordered={false}>
        平台健康 99.94%
      </Tag>
      <Link to="/settings" className="demo-shell-profile">
        <span className="demo-shell-profile-name">Mina Chen</span>
        <span className="demo-shell-profile-meta">Growth Lab</span>
      </Link>
    </Space>
  );
}

function RootLayout() {
  return (
    <AppShell title="1Flowse" navigation={<AppNavigation />} actions={<AppHeaderActions />}>
      <Outlet />
    </AppShell>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <Typography.Paragraph>未找到对应的演示页面。</Typography.Paragraph>
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage
});

const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio',
  component: AgentFlowPage
});

const subsystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subsystems',
  component: EmbeddedAppsPage
});

const toolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools',
  component: ToolsPage
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  studioRoute,
  subsystemRoute,
  toolsRoute,
  settingsRoute
]);

const router = createRouter({
  routeTree
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouterProvider() {
  return <RouterProvider router={router} />;
}
