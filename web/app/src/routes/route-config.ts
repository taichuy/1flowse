import type { AppRouteId } from '@1flowse/shared-types';

export interface AppRouteDefinition {
  id: AppRouteId;
  path: string;
  navLabel: string | null;
  selectedMatchers: Array<(pathname: string) => boolean>;
  permissionKey: string;
  guard: 'bootstrap-allow';
}

export const APP_ROUTES: AppRouteDefinition[] = [
  {
    id: 'home',
    path: '/',
    navLabel: '工作台',
    selectedMatchers: [(pathname) => pathname === '/'],
    permissionKey: 'home.view',
    guard: 'bootstrap-allow'
  },
  {
    id: 'embedded-apps',
    path: '/embedded-apps',
    navLabel: '团队',
    selectedMatchers: [
      (pathname) => pathname.startsWith('/embedded-apps'),
      (pathname) => pathname.startsWith('/embedded/')
    ],
    permissionKey: 'embedded-apps.view',
    guard: 'bootstrap-allow'
  },
  {
    id: 'embedded-runtime',
    path: '/embedded/$embeddedAppId',
    navLabel: null,
    selectedMatchers: [(pathname) => pathname.startsWith('/embedded/')],
    permissionKey: 'embedded-runtime.view',
    guard: 'bootstrap-allow'
  },
  {
    id: 'agent-flow',
    path: '/agent-flow',
    navLabel: '前台',
    selectedMatchers: [(pathname) => pathname.startsWith('/agent-flow')],
    permissionKey: 'agent-flow.view',
    guard: 'bootstrap-allow'
  }
];

export function getSelectedRouteId(pathname: string): AppRouteId {
  return (
    APP_ROUTES.find((route) => route.selectedMatchers.some((match) => match(pathname)))?.id ??
    'home'
  );
}
