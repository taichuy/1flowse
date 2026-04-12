import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router';

import { WorkspaceLayout } from '../features/workspace/WorkspaceLayout';
import { ApiView } from '../features/workspace/views/ApiView';
import { LogsView } from '../features/workspace/views/LogsView';
import { MonitoringView } from '../features/workspace/views/MonitoringView';
import { OrchestrationView } from '../features/workspace/views/OrchestrationView';
import { OverviewView } from '../features/workspace/views/OverviewView';

function RootLayout() {
  return (
    <WorkspaceLayout>
      <Outlet />
    </WorkspaceLayout>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewView
});

const orchestrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orchestration',
  component: OrchestrationView
});

const apiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/api',
  component: ApiView
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsView
});

const monitoringRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/monitoring',
  component: MonitoringView
});

const routeTree = rootRoute.addChildren([
  overviewRoute,
  orchestrationRoute,
  apiRoute,
  logsRoute,
  monitoringRoute
]);

const router = createRouter({
  routeTree
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function DemoRouterProvider() {
  return <RouterProvider router={router} />;
}
