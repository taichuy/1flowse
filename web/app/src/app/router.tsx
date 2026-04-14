import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState
} from '@tanstack/react-router';
import { Result } from 'antd';

import { AppShellFrame } from '../app-shell/AppShellFrame';
import { SignInPage } from '../features/auth/pages/SignInPage';
import { EmbeddedAppsPage } from '../features/embedded-apps/pages/EmbeddedAppsPage';
import { HomePage } from '../features/home/pages/HomePage';
import { MePage } from '../features/me/pages/MePage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { ToolsPage } from '../features/tools/pages/ToolsPage';
import { RouteGuard } from '../routes/route-guards';

function NotFoundPage() {
  return <Result status="404" title="页面不存在" />;
}

function ShellLayout() {
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
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage
});

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: ShellLayout,
  notFoundComponent: NotFoundPage
});

const homeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  component: () => (
    <RouteGuard routeId="home">
      <HomePage />
    </RouteGuard>
  )
});

const embeddedAppsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/embedded-apps',
  notFoundComponent: NotFoundPage,
  component: () => (
    <RouteGuard routeId="embedded-apps">
      <EmbeddedAppsPage />
    </RouteGuard>
  )
});

const toolsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/tools',
  notFoundComponent: NotFoundPage,
  component: () => (
    <RouteGuard routeId="tools">
      <ToolsPage />
    </RouteGuard>
  )
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings',
  notFoundComponent: NotFoundPage,
  component: () => (
    <RouteGuard routeId="settings">
      <SettingsPage />
    </RouteGuard>
  )
});

const meRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/me',
  notFoundComponent: NotFoundPage,
  component: () => (
    <RouteGuard routeId="me">
      <MePage />
    </RouteGuard>
  )
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: () => (
    <RouteGuard routeId="sign-in">
      <SignInPage />
    </RouteGuard>
  )
});

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([homeRoute, embeddedAppsRoute, toolsRoute, settingsRoute, meRoute]),
  signInRoute
]);

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundPage,
  notFoundMode: 'root'
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouterProvider() {
  return <RouterProvider router={router} />;
}
