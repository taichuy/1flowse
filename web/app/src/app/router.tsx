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
import { getRouteDefinition } from '../routes/route-helpers';
import { RouteGuard } from '../routes/route-guards';

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
  component: () => (
    <RouteGuard permissionKey={getRouteDefinition('home').permissionKey}>
      <HomePage />
    </RouteGuard>
  )
});

const agentFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agent-flow',
  component: () => (
    <RouteGuard permissionKey={getRouteDefinition('agent-flow').permissionKey}>
      <AgentFlowPage />
    </RouteGuard>
  )
});

const embeddedAppsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/embedded-apps',
  component: () => (
    <RouteGuard permissionKey={getRouteDefinition('embedded-apps').permissionKey}>
      <EmbeddedAppsPage />
    </RouteGuard>
  )
});

const embeddedAppDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/embedded-apps/$embeddedAppId',
  component: () => (
    <RouteGuard permissionKey={getRouteDefinition('embedded-apps').permissionKey}>
      <EmbeddedAppDetailPage />
    </RouteGuard>
  )
});

const embeddedMountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/embedded/$embeddedAppId',
  component: () => (
    <RouteGuard permissionKey={getRouteDefinition('embedded-runtime').permissionKey}>
      <EmbeddedMountPage />
    </RouteGuard>
  )
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
