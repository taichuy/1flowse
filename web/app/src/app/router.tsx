import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router';
import { Space } from 'antd';

import { AppShell } from '@1flowse/ui';

import { AgentFlowPage } from '../features/agent-flow/AgentFlowPage';
import { HomePage } from '../features/home/HomePage';

function RootLayout() {
  return (
    <AppShell
      title="1Flowse Bootstrap"
      navigation={
        <Space>
          <Link to="/">Home</Link>
          <Link to="/agent-flow">agentFlow</Link>
        </Space>
      }
    >
      <Outlet />
    </AppShell>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage
});

const agentFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agent-flow',
  component: AgentFlowPage
});

const routeTree = rootRoute.addChildren([homeRoute, agentFlowRoute]);

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
