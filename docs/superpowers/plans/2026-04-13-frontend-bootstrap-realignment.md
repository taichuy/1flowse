# Frontend Bootstrap Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign the current `web` frontend from a bootstrap shell into the agreed target structure by extracting the route truth layer and app shell, moving page/API code into feature directories, cleaning test placement and lint failures, and reducing global style blast radius without breaking the current visual result.

**Architecture:** Keep the existing `TanStack Router + TanStack Query + Ant Design + Zustand` stack, but split responsibilities into `app-shell`, `routes`, `features/*`, and `shared/*`. Use compatibility-preserving moves first, then tighten tests, route metadata, and CSS ownership so the app remains runnable after every task.

**Tech Stack:** React 19, Vite, TypeScript, TanStack Router, TanStack Query, Zustand, Ant Design, Vitest, Playwright screenshots, `style-boundary`

**Source Spec:** `docs/superpowers/specs/1flowse/2026-04-13-frontend-bootstrap-directory-and-regression-design.md`

**Approval:** User approved continuing from the spec into an implementation plan on `2026-04-13 16`.

---

## Scope Notes

- This plan covers only the `web` frontend workspace.
- This plan keeps the current UI visually close to today’s screenshots; it is not a redesign pass.
- This plan does not implement a real permission product yet. It adds route metadata and a guard scaffold so later auth work has a fixed landing zone.
- The current `embedded-runtime` page is part of scope even though the spec’s example tree omitted it; the implementation must place it under `features/embedded-runtime`.

## Execution Prerequisites

- Before any Playwright screenshot or page-level `style-boundary` verification, ensure the frontend dev server is running with `node scripts/node/dev-up.js ensure --frontend-only --skip-docker`.
- Screenshot artifacts for this plan go under `uploads/frontend-bootstrap-realignment/`. Because `pnpm --dir web exec ...` resolves relative output paths inside `web/`, every screenshot command below writes to `../uploads/...`.
- For broad Vitest runs that exercise the shell plus multiple `Ant Design` scenes, use `--testTimeout=15000` so known slow `jsdom` rendering does not get misread as a product regression.

## File Structure

**Create**
- `web/app/src/app-shell/AppShellFrame.tsx`
- `web/app/src/app-shell/Navigation.tsx`
- `web/app/src/app-shell/AccountMenu.tsx`
- `web/app/src/app-shell/_tests/navigation.test.tsx`
- `web/app/src/app-shell/_tests/account-popup.boundary.test.tsx`
- `web/app/src/routes/route-config.ts`
- `web/app/src/routes/route-helpers.ts`
- `web/app/src/routes/route-guards.tsx`
- `web/app/src/routes/_tests/route-config.test.ts`
- `web/app/src/routes/_tests/route-guards.test.tsx`
- `web/app/src/features/home/pages/HomePage.tsx`
- `web/app/src/features/home/api/health.ts`
- `web/app/src/features/home/_tests/home-api.test.ts`
- `web/app/src/features/home/_tests/home-page.test.tsx`
- `web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx`
- `web/app/src/features/embedded-apps/pages/EmbeddedAppDetailPage.tsx`
- `web/app/src/features/embedded-apps/_tests/embedded-apps-page.test.tsx`
- `web/app/src/features/embedded-runtime/pages/EmbeddedMountPage.tsx`
- `web/app/src/features/agent-flow/pages/AgentFlowPage.tsx`
- `web/app/src/app/_tests/app-shell.test.tsx`
- `web/app/src/app-shell/app-shell.css`
- `web/app/src/styles/tokens.css`
- `web/app/src/styles/globals.css`
- `web/app/src/style-boundary/StyleBoundaryHarness.tsx`
- `web/packages/embed-sdk/src/_tests/createEmbedContext.test.ts`
- `web/packages/embedded-contracts/src/_tests/createEmbeddedAppManifest.test.ts`

**Modify**
- `web/app/src/app/router.tsx`
- `web/app/src/main.tsx`
- `web/app/src/style-boundary/main.tsx`
- `web/app/src/style-boundary/registry.tsx`
- `web/app/src/style-boundary/scenario-manifest.json`
- `web/app/src/style-boundary/_tests/registry.test.tsx`
- `web/packages/shared-types/src/index.ts`
- `web/packages/ui/src/index.tsx`

**Move / Delete after migration**
- `web/app/src/features/home/HomePage.tsx`
- `web/app/src/features/embedded-apps/EmbeddedAppsPage.tsx`
- `web/app/src/features/embedded-apps/EmbeddedAppDetailPage.tsx`
- `web/app/src/features/embedded-runtime/EmbeddedMountPage.tsx`
- `web/app/src/features/agent-flow/AgentFlowPage.tsx`
- `web/app/src/app/App.test.tsx`
- `web/app/src/app/_tests/router.test.tsx`
- `web/app/src/app/_tests/account-popup-layout.test.tsx`
- `web/app/src/styles/global.css`
- `web/packages/embed-sdk/src/index.test.ts`
- `web/packages/embedded-contracts/src/index.test.ts`

**Notes**
- `web/app/src/app/router.tsx` is currently both route tree, shell composition, navigation config, and account-menu factory. Splitting it is mandatory, not optional.
- `web/app/src/styles/global.css` currently mixes tokens, shell styles, and broad `.ant-*` overrides. The target state splits that file into `styles/tokens.css`, `styles/globals.css`, and `app-shell/app-shell.css`, with only wrapper-scoped slot rules surviving outside theme tokens.
- All new tests must land in the nearest `_tests/` directory. Existing root-level tests should move rather than multiply.

### Task 1: Extract Route Truth Layer And App Shell

**Files:**
- Create: `web/app/src/app-shell/AppShellFrame.tsx`
- Create: `web/app/src/app-shell/Navigation.tsx`
- Create: `web/app/src/app-shell/AccountMenu.tsx`
- Create: `web/app/src/app-shell/_tests/navigation.test.tsx`
- Create: `web/app/src/routes/route-config.ts`
- Create: `web/app/src/routes/route-helpers.ts`
- Create: `web/app/src/routes/_tests/route-config.test.ts`
- Modify: `web/app/src/app/router.tsx`
- Modify: `web/app/src/style-boundary/registry.tsx`
- Modify: `web/packages/shared-types/src/index.ts`

- [ ] **Step 1: Write the failing route-truth and navigation tests**

Create `web/app/src/routes/_tests/route-config.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import { APP_ROUTES, getSelectedRouteId } from '../route-config';

describe('route truth layer', () => {
  test('keeps navigation ids, labels, paths, and selected-state logic in one source', () => {
    expect(APP_ROUTES.map((route) => route.id)).toEqual([
      'home',
      'embedded-apps',
      'embedded-runtime',
      'agent-flow'
    ]);
    expect(getSelectedRouteId('/embedded/demo-app')).toBe('embedded-apps');
  });
});
```

Create `web/app/src/app-shell/_tests/navigation.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Navigation } from '../Navigation';

describe('Navigation', () => {
  test('renders labels from route config and marks embedded runtime under embedded apps', () => {
    render(<Navigation pathname="/embedded/demo-app" useRouterLinks={false} />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: '工作台' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: '团队' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: '前台' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { current: 'page' })).toHaveTextContent('团队');
  });
});
```

- [ ] **Step 2: Run the focused failures**

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-config.test.ts src/app-shell/_tests/navigation.test.tsx`

Expected: FAIL because `route-config.ts`, `Navigation.tsx`, and the expanded route ids do not exist yet.

- [ ] **Step 3: Implement route config, shared route ids, and shell extraction**

Create `web/app/src/routes/route-config.ts`:

```ts
import type { AppRouteId } from '@1flowse/shared-types';

export interface AppRouteDefinition {
  id: AppRouteId;
  path: string;
  navLabel: string | null;
  selectedMatchers: Array<(pathname: string) => boolean>;
  permissionKey: string | null;
}

export const APP_ROUTES: AppRouteDefinition[] = [
  {
    id: 'home',
    path: '/',
    navLabel: '工作台',
    selectedMatchers: [(pathname) => pathname === '/'],
    permissionKey: 'home.view'
  },
  {
    id: 'embedded-apps',
    path: '/embedded-apps',
    navLabel: '团队',
    selectedMatchers: [
      (pathname) => pathname.startsWith('/embedded-apps'),
      (pathname) => pathname.startsWith('/embedded/')
    ],
    permissionKey: 'embedded-apps.view'
  },
  {
    id: 'embedded-runtime',
    path: '/embedded/$embeddedAppId',
    navLabel: null,
    selectedMatchers: [(pathname) => pathname.startsWith('/embedded/')],
    permissionKey: 'embedded-runtime.view'
  },
  {
    id: 'agent-flow',
    path: '/agent-flow',
    navLabel: '前台',
    selectedMatchers: [(pathname) => pathname.startsWith('/agent-flow')],
    permissionKey: 'agent-flow.view'
  }
];

export function getSelectedRouteId(pathname: string): AppRouteId {
  return (
    APP_ROUTES.find((route) => route.selectedMatchers.some((match) => match(pathname)))?.id ??
    'home'
  );
}
```

Create `web/app/src/routes/route-helpers.ts`:

```ts
import type { AppRouteId } from '@1flowse/shared-types';

import { APP_ROUTES } from './route-config';

export function getRouteDefinition(routeId: AppRouteId) {
  const route = APP_ROUTES.find((entry) => entry.id === routeId);

  if (!route) {
    throw new Error(`Unknown route id: ${routeId}`);
  }

  return route;
}
```

Update `web/packages/shared-types/src/index.ts`:

```ts
export type AppRouteId =
  | 'home'
  | 'embedded-apps'
  | 'embedded-runtime'
  | 'agent-flow';
```

Move shell composition out of `router.tsx` by creating:

- `app-shell/Navigation.tsx`
- `app-shell/AccountMenu.tsx`
- `app-shell/AppShellFrame.tsx`

`web/app/src/app-shell/Navigation.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';

import { APP_ROUTES, getSelectedRouteId } from '../routes/route-config';

function renderNavigationLink(path: string, label: string, useRouterLinks: boolean) {
  if (useRouterLinks) {
    return (
      <Link to={path} className="app-shell-menu-link">
        {label}
      </Link>
    );
  }

  return (
    <a href={path} className="app-shell-menu-link">
      {label}
    </a>
  );
}

export function Navigation({
  pathname,
  useRouterLinks
}: {
  pathname: string;
  useRouterLinks: boolean;
}) {
  const selectedKey = getSelectedRouteId(pathname);
  const items: MenuProps['items'] = APP_ROUTES.filter((route) => route.navLabel).map((route) => ({
    key: route.id,
    label: renderNavigationLink(route.path.replace('/$embeddedAppId', ''), route.navLabel!, useRouterLinks)
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
```

`web/app/src/app-shell/AccountMenu.tsx`:

```tsx
import { LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';

export function createAccountMenuItems(): MenuProps['items'] {
  return [
    {
      key: 'account',
      label: (
        <span className="app-shell-account-block">
          <span className="app-shell-account-label">Taichu</span>
        </span>
      ),
      popupClassName: 'app-shell-account-popup',
      children: [
        { key: 'profile', label: 'Profile', icon: <UserOutlined /> },
        { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
        { type: 'divider' },
        { key: 'sign-out', label: 'Sign out', icon: <LogoutOutlined /> }
      ]
    }
  ];
}

export function AccountMenu() {
  return (
    <Menu
      className="app-shell-account-menu"
      mode="horizontal"
      selectable={false}
      items={createAccountMenuItems()}
      disabledOverflow
    />
  );
}
```

`web/app/src/app-shell/AppShellFrame.tsx`:

```tsx
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
```

`router.tsx` should end up doing only:

```tsx
const rootRoute = createRootRoute({ component: RootLayout });
const routeTree = rootRoute.addChildren([...]);
const router = createRouter({ routeTree });

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <AppShellFrame pathname={pathname} useRouterLinks>
      <Outlet />
    </AppShellFrame>
  );
}
```

- [ ] **Step 4: Re-run focused tests and existing registry coverage**

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-config.test.ts src/app-shell/_tests/navigation.test.tsx src/style-boundary/_tests/registry.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the shell and route-truth slice**

```bash
git add web/app/src/app-shell web/app/src/routes web/app/src/app/router.tsx web/app/src/style-boundary/registry.tsx web/packages/shared-types/src/index.ts
git commit -m "feat(web): extract app shell and route truth layer"
```

### Task 2: Move Page Containers Into Feature `pages/` And Introduce Feature Api Consumption

**Files:**
- Create: `web/app/src/features/home/pages/HomePage.tsx`
- Create: `web/app/src/features/home/api/health.ts`
- Create: `web/app/src/features/home/_tests/home-api.test.ts`
- Create: `web/app/src/features/home/_tests/home-page.test.tsx`
- Create: `web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx`
- Create: `web/app/src/features/embedded-apps/pages/EmbeddedAppDetailPage.tsx`
- Create: `web/app/src/features/embedded-apps/_tests/embedded-apps-page.test.tsx`
- Create: `web/app/src/features/embedded-runtime/pages/EmbeddedMountPage.tsx`
- Create: `web/app/src/features/agent-flow/pages/AgentFlowPage.tsx`
- Modify: `web/app/src/app/router.tsx`
- Modify: `web/app/src/style-boundary/registry.tsx`

- [ ] **Step 1: Write failing feature-path and feature-api tests**

Create `web/app/src/features/home/_tests/home-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@1flowse/api-client', () => ({
  getDefaultApiBaseUrl: vi.fn().mockReturnValue('http://127.0.0.1:7800'),
  fetchApiHealth: vi.fn().mockResolvedValue({
    service: 'api-server',
    status: 'ok',
    version: '0.1.0'
  })
}));

import { HomePage } from '../pages/HomePage';

describe('HomePage', () => {
  test('loads api health through feature api helpers', async () => {
    render(<HomePage />);
    expect(await screen.findByText(/api-server ok/i)).toBeInTheDocument();
  });
});
```

Create `web/app/src/features/home/_tests/home-api.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';

vi.mock('@1flowse/api-client', () => ({
  fetchApiHealth: vi.fn().mockResolvedValue({
    service: 'api-server',
    status: 'ok',
    version: '0.1.0'
  })
}));

import { fetchApiHealth } from '@1flowse/api-client';

import { homeHealthQueryOptions } from '../api/health';

describe('homeHealthQueryOptions', () => {
  test('declares a stable query key and delegates to api-client', async () => {
    const query = homeHealthQueryOptions('http://127.0.0.1:7800');

    expect(query.queryKey).toEqual(['home', 'api-health', 'http://127.0.0.1:7800']);
    await expect(query.queryFn()).resolves.toEqual({
      service: 'api-server',
      status: 'ok',
      version: '0.1.0'
    });
    expect(fetchApiHealth).toHaveBeenCalledWith('http://127.0.0.1:7800');
  });
});
```

Create `web/app/src/features/embedded-apps/_tests/embedded-apps-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { EmbeddedAppsPage } from '../pages/EmbeddedAppsPage';

describe('EmbeddedAppsPage', () => {
  test('renders formal product copy instead of placeholder language', () => {
    render(<EmbeddedAppsPage />);
    expect(screen.getByText('Embedded Apps')).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused failures**

Run: `pnpm --dir web/app exec vitest --run src/features/home/_tests/home-api.test.ts src/features/home/_tests/home-page.test.tsx src/features/embedded-apps/_tests/embedded-apps-page.test.tsx`

Expected: FAIL because the `pages/` and `api/` entrypoints do not exist yet.

- [ ] **Step 3: Implement feature `pages/` files and feature api consumption**

Create `web/app/src/features/home/api/health.ts`:

```ts
import { queryOptions } from '@tanstack/react-query';

import { fetchApiHealth } from '@1flowse/api-client';

export function homeHealthQueryOptions(apiBaseUrl: string) {
  return queryOptions({
    queryKey: ['home', 'api-health', apiBaseUrl],
    queryFn: () => fetchApiHealth(apiBaseUrl)
  });
}
```

Create `web/app/src/features/home/pages/HomePage.tsx` and update it to consume the helper:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Space, Typography } from 'antd';

import { getDefaultApiBaseUrl } from '@1flowse/api-client';

import { useAppStore } from '../../../state/app-store';
import { homeHealthQueryOptions } from '../api/health';

export function HomePage() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBaseUrl(window.location);
  const visitCount = useAppStore((state) => state.visitCount);
  const increment = useAppStore((state) => state.increment);
  const healthQuery = useQuery(homeHealthQueryOptions(apiBaseUrl));

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Workspace Bootstrap">
        <Typography.Paragraph>
          前端工作区、共享壳层和后端健康检查已接入同一条 bootstrap 链路。
        </Typography.Paragraph>
        <Typography.Paragraph>Visit count: {visitCount}</Typography.Paragraph>
        <Button onClick={increment}>Increment</Button>
      </Card>
      <Card title="API Health">
        <Typography.Paragraph>
          {healthQuery.isPending && 'Loading health status...'}
          {healthQuery.isError && 'Health request failed.'}
          {healthQuery.data &&
            `${healthQuery.data.service} ${healthQuery.data.status} (${healthQuery.data.version})`}
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
```

Move the remaining page containers into:

- `features/embedded-apps/pages/EmbeddedAppsPage.tsx`
- `features/embedded-apps/pages/EmbeddedAppDetailPage.tsx`
- `features/embedded-runtime/pages/EmbeddedMountPage.tsx`
- `features/agent-flow/pages/AgentFlowPage.tsx`

Update `router.tsx` and `style-boundary/registry.tsx` imports to reference the new `pages/` locations.

While moving these files, replace obvious placeholder copy with formal bootstrap-safe product text, for example:

```tsx
const bootstrapCapabilities = [
  '已接入应用的版本与构建产物清单',
  '路由前缀、挂载上下文和宿主约束',
  '后续接入发布、回滚和运行态诊断的入口'
];

export function EmbeddedAppsPage() {
  return (
    <Card title="Embedded Apps">
      <Typography.Paragraph>
        管理已接入的嵌入式前端应用版本、路由前缀和挂载上下文。
      </Typography.Paragraph>
      <List
        dataSource={bootstrapCapabilities}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    </Card>
  );
}
```

- [ ] **Step 4: Re-run the focused feature and route regressions**

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-config.test.ts src/app-shell/_tests/navigation.test.tsx src/features/home/_tests/home-api.test.ts src/features/home/_tests/home-page.test.tsx src/features/embedded-apps/_tests/embedded-apps-page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the feature-directory and api slice**

```bash
git add web/app/src/features web/app/src/app/router.tsx web/app/src/style-boundary/registry.tsx
git commit -m "refactor(web): move pages and feature api into target directories"
```

### Task 3: Relocate Tests Into `_tests` And Make Lint Green

**Files:**
- Create: `web/app/src/app/_tests/app-shell.test.tsx`
- Create: `web/app/src/app-shell/_tests/account-popup.boundary.test.tsx`
- Modify: `web/app/src/app-shell/_tests/navigation.test.tsx`
- Modify: `web/app/src/style-boundary/_tests/registry.test.tsx`
- Modify: `web/app/src/style-boundary/main.tsx`
- Create: `web/app/src/style-boundary/StyleBoundaryHarness.tsx`
- Create: `web/packages/embed-sdk/src/_tests/createEmbedContext.test.ts`
- Create: `web/packages/embedded-contracts/src/_tests/createEmbeddedAppManifest.test.ts`
- Delete after move: `web/app/src/app/App.test.tsx`
- Delete after move: `web/app/src/app/_tests/router.test.tsx`
- Delete after move: `web/app/src/app/_tests/account-popup-layout.test.tsx`
- Delete after move: `web/packages/embed-sdk/src/index.test.ts`
- Delete after move: `web/packages/embedded-contracts/src/index.test.ts`

- [ ] **Step 1: Move the failing test intent into proper `_tests` files**

Create `web/app/src/app/_tests/app-shell.test.tsx` with the current app-shell assertions from `App.test.tsx`, but use Testing Library and semantic queries only:

```tsx
const header = screen.getByRole('banner');
expect(header).toHaveStyle('--app-shell-edge-gap: 5%');
expect(screen.getByRole('menuitem', { name: 'Taichu' })).toBeInTheDocument();
```

Create `web/app/src/app-shell/_tests/account-popup.boundary.test.tsx` and move the popup-layout assertions there so the shell boundary test lives next to the component it protects:

```tsx
const profileItem = await screen.findByRole('menuitem', { name: 'Profile' });
const styles = window.getComputedStyle(profileItem);
expect(styles.display).toBe('block');
expect(styles.height).toBe(styles.lineHeight);
```

Also assert the horizontal trigger keeps the `Ant Design` row layout contract:

```tsx
const trigger = screen.getByRole('menuitem', { name: 'Taichu' });
const triggerStyles = window.getComputedStyle(trigger);
expect(triggerStyles.display).toBe('flex');
```

Update the style-boundary harness test to query by `data-testid` instead of container traversal:

```tsx
expect(screen.getByTestId('style-boundary-scene')).toBeInTheDocument();
```

- [ ] **Step 2: Run lint and confirm the current failures disappear only after the moves**

Run: `pnpm --dir web lint`

Expected: FAIL at first with `testing-library/no-node-access`, `testing-library/no-container`, and `react-refresh/only-export-components`.

- [ ] **Step 3: Split exports and finish the lint fixes**

Move `StyleBoundaryHarness` into `web/app/src/style-boundary/StyleBoundaryHarness.tsx`:

```tsx
export function StyleBoundaryHarness({ scene }: { scene: StyleBoundaryRuntimeScene }) {
  window.__STYLE_BOUNDARY__ = { ready: true, scene };
  return <div data-testid="style-boundary-scene">{scene.render()}</div>;
}
```

Keep `main.tsx` focused on bootstrapping only.  
With Task 1 already extracting `createAccountMenuItems` out of `router.tsx`, the `react-refresh` warning on `router.tsx` should also disappear.

Move package-level tests into `_tests`:

- `web/packages/embed-sdk/src/_tests/createEmbedContext.test.ts`
- `web/packages/embedded-contracts/src/_tests/createEmbeddedAppManifest.test.ts`

Use the same assertions they already have, only with the new import paths:

```ts
import { expect, test } from 'vitest';

import { createEmbedContext } from '../index';

test('createEmbedContext returns the provided context', () => {
  expect(
    createEmbedContext({ applicationId: 'app-1', teamId: 'team-1' })
  ).toEqual({ applicationId: 'app-1', teamId: 'team-1' });
});
```

```ts
import { expect, test } from 'vitest';

import { createEmbeddedAppManifest } from '../index';

test('createEmbeddedAppManifest returns the provided manifest', () => {
  expect(
    createEmbeddedAppManifest({
      appId: 'embedded-1',
      entry: 'dist/index.html',
      name: 'Demo Embedded App',
      routePrefix: '/embedded/embedded-1',
      version: '0.1.0'
    })
  ).toEqual({
    appId: 'embedded-1',
    entry: 'dist/index.html',
    name: 'Demo Embedded App',
    routePrefix: '/embedded/embedded-1',
    version: '0.1.0'
  });
});
```

- [ ] **Step 4: Re-run lint and all frontend tests**

Run:

```bash
pnpm --dir web lint
pnpm --dir web test -- --testTimeout=15000
```

Expected: PASS

- [ ] **Step 5: Commit the test and lint cleanup**

```bash
git add web/app/src/app/_tests web/app/src/app-shell/_tests web/app/src/style-boundary web/packages/embed-sdk/src/_tests web/packages/embedded-contracts/src/_tests
git commit -m "test(web): relocate frontend tests and fix lint violations"
```

### Task 4: Reduce `global.css` Blast Radius And Keep `style-boundary` Green

**Files:**
- Create: `web/app/src/app-shell/app-shell.css`
- Create: `web/app/src/styles/tokens.css`
- Create: `web/app/src/styles/globals.css`
- Modify: `web/app/src/app-shell/AppShellFrame.tsx`
- Modify: `web/app/src/app-shell/_tests/account-popup.boundary.test.tsx`
- Modify: `web/app/src/main.tsx`
- Modify: `web/app/src/style-boundary/main.tsx`
- Modify: `web/packages/ui/src/index.tsx`
- Modify: `web/app/src/style-boundary/scenario-manifest.json`
- Modify: `web/app/src/style-boundary/registry.tsx`
- Delete after move: `web/app/src/styles/global.css`

- [ ] **Step 1: Add failing style-boundary coverage for the new shell file layout**

Update `scenario-manifest.json` so shell scenes no longer rely only on `app/router.tsx`; they must point to the new `app-shell/*` files, `app-shell/app-shell.css`, `styles/tokens.css`, and `styles/globals.css`.

Run:

```bash
node scripts/node/check-style-boundary.js component component.account-popup
node scripts/node/check-style-boundary.js component component.account-trigger
node scripts/node/check-style-boundary.js page page.home
node scripts/node/check-style-boundary.js file web/app/src/app-shell/app-shell.css
node scripts/node/check-style-boundary.js file web/app/src/styles/tokens.css
node scripts/node/check-style-boundary.js file web/app/src/styles/globals.css
```

Expected: FAIL or report outdated impact mappings until the manifest and CSS ownership are updated.

- [ ] **Step 2: Split shell, token, and document-level CSS ownership**

Create `web/app/src/app-shell/app-shell.css` and move shell/menu/account rules there, for example:

```css
.app-shell-navigation {
  display: flex;
  align-items: center;
  min-width: 0;
}

.app-shell-menu.ant-menu-horizontal > .ant-menu-item,
.app-shell-menu.ant-menu-horizontal > .ant-menu-overflow-item {
  height: 56px;
  margin: 0 !important;
  padding-inline: 0 !important;
}
```

Create `web/app/src/styles/tokens.css` for the `:root` custom properties and selection color, and create `web/app/src/styles/globals.css` for the document resets and page background:

```css
html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--text-primary);
  background:
    radial-gradient(circle at top left, rgba(0, 217, 146, 0.16), transparent 26%),
    radial-gradient(circle at top right, rgba(47, 214, 161, 0.1), transparent 20%),
    linear-gradient(180deg, #f8fcfa 0%, #eef4f0 100%);
}
```

Import `./app-shell.css` from `web/app/src/app-shell/AppShellFrame.tsx`.

Update `web/app/src/main.tsx` to import:

```ts
import './styles/tokens.css';
import './styles/globals.css';
```

Update `web/app/src/style-boundary/main.tsx` to import:

```ts
import '../styles/tokens.css';
import '../styles/globals.css';
```

Update `web/app/src/app-shell/_tests/account-popup.boundary.test.tsx` to import `../../styles/tokens.css`, `../../styles/globals.css`, and `../app-shell.css`.  
Delete `web/app/src/styles/global.css` once both new files and the shell stylesheet are wired in.

- [ ] **Step 3: Push generic `Ant Design` styling into theme tokens where possible**

Update `web/packages/ui/src/index.tsx` to prefer component tokens over global `.ant-*` overrides, for example:

```tsx
components: {
  Layout: { headerBg: 'transparent', bodyBg: 'transparent' },
  Card: { headerBg: 'transparent' },
  Button: {
    defaultBorderColor: '#bcc8c1',
    defaultColor: '#16211d',
    primaryColor: '#06241a'
  },
  Tabs: {
    itemColor: '#55645d',
    itemSelectedColor: '#16211d',
    inkBarColor: '#00d992'
  }
}
```

After this pass, the old `global.css` responsibilities should be redistributed as:

- `tokens.css` for theme variables only
- `globals.css` for document-level resets and backgrounds only
- only the smallest possible set of wrapper-scoped slot overrides that cannot be expressed as theme tokens

- [ ] **Step 4: Re-run style-boundary and screenshot verification**

Run:

```bash
mkdir -p uploads/frontend-bootstrap-realignment
node scripts/node/dev-up.js ensure --frontend-only --skip-docker
node scripts/node/check-style-boundary.js component component.account-popup
node scripts/node/check-style-boundary.js component component.account-trigger
node scripts/node/check-style-boundary.js page page.home
node scripts/node/check-style-boundary.js file web/app/src/app-shell/app-shell.css
node scripts/node/check-style-boundary.js file web/app/src/styles/tokens.css
node scripts/node/check-style-boundary.js file web/app/src/styles/globals.css
pnpm --dir web exec playwright screenshot --browser chromium --channel chrome --viewport-size "1440,960" --timeout 15000 http://127.0.0.1:3100 ../uploads/frontend-bootstrap-realignment/home-desktop-after-style.png
```

Expected: PASS on all style-boundary commands and a stable shell screenshot.

- [ ] **Step 5: Commit the CSS ownership pass**

```bash
git add web/app/src/app-shell web/app/src/main.tsx web/app/src/style-boundary/main.tsx web/app/src/styles web/packages/ui/src/index.tsx web/app/src/style-boundary/scenario-manifest.json web/app/src/style-boundary/registry.tsx
git commit -m "refactor(web): scope shell styles and reduce global ant overrides"
```

### Task 5: Add Route Guard Scaffolding And Run Final Verification

**Files:**
- Create: `web/app/src/routes/route-guards.tsx`
- Create: `web/app/src/routes/_tests/route-guards.test.tsx`
- Modify: `web/app/src/routes/route-config.ts`
- Modify: `web/app/src/app/router.tsx`
- Modify: `web/app/src/app/_tests/app-shell.test.tsx`
- Modify: `web/app/src/routes/_tests/route-config.test.ts`

- [ ] **Step 1: Add failing tests for route metadata and guard wrapping**

Extend `web/app/src/routes/_tests/route-config.test.ts`:

```ts
test('every route definition declares explicit bootstrap guard handling', () => {
  expect(APP_ROUTES.every((route) => route.guard === 'bootstrap-allow')).toBe(true);
});
```

Create `web/app/src/routes/_tests/route-guards.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { RouteGuard } from '../route-guards';

describe('RouteGuard', () => {
  test('passes children through in bootstrap mode', () => {
    render(
      <RouteGuard permissionKey="home.view">
        <div>guarded content</div>
      </RouteGuard>
    );

    expect(screen.getByText('guarded content')).toBeInTheDocument();
  });
});
```

Add `web/app/src/app/_tests/app-shell.test.tsx` coverage that protected routes still render through the shell when the bootstrap guard allows access.

- [ ] **Step 2: Run the focused failures**

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-config.test.ts src/routes/_tests/route-guards.test.tsx src/app/_tests/app-shell.test.tsx`

Expected: FAIL until the guard scaffold and route metadata are wired into the route tree.

- [ ] **Step 3: Implement the bootstrap guard scaffold**

Create `web/app/src/routes/route-guards.tsx`:

```tsx
import type { PropsWithChildren } from 'react';

export function RouteGuard({
  children,
  permissionKey
}: PropsWithChildren<{ permissionKey: string }>) {
  void permissionKey;
  return <>{children}</>;
}
```

Update `route-config.ts` so every route definition has a `guard: 'bootstrap-allow'` field alongside its `permissionKey`.

Wrap each route component in `router.tsx` through `RouteGuard`, for example:

```tsx
component: () => (
  <RouteGuard permissionKey={getRouteDefinition('home').permissionKey}>
    <HomePage />
  </RouteGuard>
)
```

This scaffold is intentionally allow-all for now; the purpose is to establish the file boundary and metadata contract before real auth lands.

- [ ] **Step 4: Run the full frontend verification**

Run:

```bash
mkdir -p uploads/frontend-bootstrap-realignment
node scripts/node/dev-up.js ensure --frontend-only --skip-docker
pnpm --dir web lint
pnpm --dir web test -- --testTimeout=15000
pnpm --dir web/app build
node scripts/node/check-style-boundary.js component component.account-popup
node scripts/node/check-style-boundary.js component component.account-trigger
node scripts/node/check-style-boundary.js page page.home
node scripts/node/check-style-boundary.js file web/app/src/app-shell/app-shell.css
node scripts/node/check-style-boundary.js file web/app/src/styles/tokens.css
node scripts/node/check-style-boundary.js file web/app/src/styles/globals.css
pnpm --dir web exec playwright screenshot --browser chromium --channel chrome --viewport-size "1440,960" --timeout 15000 http://127.0.0.1:3100 ../uploads/frontend-bootstrap-realignment/home-desktop-final.png
pnpm --dir web exec playwright screenshot --device "Pixel 5" --browser chromium --channel chrome --timeout 15000 http://127.0.0.1:3100 ../uploads/frontend-bootstrap-realignment/home-mobile-final.png
pnpm --dir web exec playwright screenshot --browser chromium --channel chrome --viewport-size "1440,960" --timeout 15000 http://127.0.0.1:3100/embedded-apps ../uploads/frontend-bootstrap-realignment/embedded-apps-desktop-final.png
pnpm --dir web exec playwright screenshot --device "Pixel 5" --browser chromium --channel chrome --timeout 15000 http://127.0.0.1:3100/embedded-apps ../uploads/frontend-bootstrap-realignment/embedded-apps-mobile-final.png
```

Expected: all commands PASS, screenshots stable, no placeholder/debug/mock copy remains in UI.

- [ ] **Step 5: Commit the final frontend bootstrap alignment**

```bash
git add web/app/src/routes web/app/src/app web/app/src/app-shell web/app/src/features web/app/src/style-boundary web/app/src/styles web/app/src/main.tsx web/packages/shared-types/src/index.ts web/packages/ui/src/index.tsx
git commit -m "refactor(web): align frontend bootstrap structure"
```

## Self-Review

### Spec Coverage

- Directory boundaries: covered by Tasks 1 and 2.
- Route truth layer and guard scaffold: covered by Tasks 1 and 5.
- `_tests` placement and naming cleanup: covered by Task 3.
- Page / component / style / API / utility testing split: covered by Tasks 2, 3, 4, and 5, including a dedicated `home-api.test.ts` regression.
- Style-boundary and CSS blast-radius reduction: covered by Task 4, including the `tokens.css` / `globals.css` split and explicit file-level boundary checks.

### Placeholder Scan

- No `TODO` / `TBD` placeholders remain in the task steps.
- The only intentionally temporary behavior is the allow-all route guard scaffold, and it is explicitly named as a scaffold plus constrained to Task 5.

### Consistency Checks

- The plan consistently uses the same route ids: `home`, `embedded-apps`, `embedded-runtime`, `agent-flow`.
- The plan consistently separates `api-client` from `features/*/api`.
- The plan preserves the existing `style-boundary` workflow instead of inventing a second regression path, and it keeps screenshot artifacts in `uploads/` with commands that are valid from the repo root.
