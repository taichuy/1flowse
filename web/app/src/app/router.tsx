import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState
} from '@tanstack/react-router';

import { AppShellFrame } from '../app-shell/AppShellFrame';
import { AgentFlowPage } from '../features/agent-flow/pages/AgentFlowPage';
import { EmbeddedAppDetailPage } from '../features/embedded-apps/pages/EmbeddedAppDetailPage';
import { EmbeddedAppsPage } from '../features/embedded-apps/pages/EmbeddedAppsPage';
import { EmbeddedMountPage } from '../features/embedded-runtime/pages/EmbeddedMountPage';
import { HomePage } from '../features/home/pages/HomePage';

function RootLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });

  return (
    <AppShellFrame pathname={pathname} useRouterLinks>
      <Outlet />
    </AppShellFrame>
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

const embeddedAppsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/embedded-apps',
  component: EmbeddedAppsPage
});

const embeddedAppDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/embedded-apps/$embeddedAppId',
  component: EmbeddedAppDetailPage
});

const embeddedMountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/embedded/$embeddedAppId',
  component: EmbeddedMountPage
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  agentFlowRoute,
  embeddedAppsRoute,
  embeddedAppDetailRoute,
  embeddedMountRoute
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
