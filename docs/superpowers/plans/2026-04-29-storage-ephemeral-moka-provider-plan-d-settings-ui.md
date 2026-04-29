# Storage Ephemeral Moka Provider Plan D Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings UI that lets root/system users configure installed infrastructure providers from package manifest/schema and save one pending restart change.

**Architecture:** Add a `host-infrastructure` settings section using existing settings navigation and Ant Design forms. The page fetches installed provider config metadata generated from installed `manifest.yaml` / `host-extension.yaml`, renders one row per grouped provider, lets the user select declared contracts, and saves config plus enablement in one action without claiming the provider is active until restart.

**Tech Stack:** React, TypeScript, Ant Design, TanStack Query, @1flowbase/api-client, settings feature structure, targeted Vitest tests.

---

## File Structure

**Create**
- `web/app/src/features/settings/api/host-infrastructure.ts`: settings-layer API wrappers.
- `web/app/src/features/settings/components/host-infrastructure/HostInfrastructurePanel.tsx`: section panel.
- `web/app/src/features/settings/components/host-infrastructure/HostInfrastructureProviderTable.tsx`: installed provider list.
- `web/app/src/features/settings/components/host-infrastructure/HostInfrastructureProviderDrawer.tsx`: schema-generated config form and contract selection.
- `web/app/src/features/settings/components/host-infrastructure/host-infrastructure-panel.css`: local section styles.
- `web/app/src/features/settings/components/host-infrastructure/_tests/HostInfrastructurePanel.test.tsx`: component tests.

**Modify**
- `web/app/src/features/settings/lib/settings-sections.tsx`: add `host-infrastructure` section.
- `web/app/src/app/router.tsx`: add `/settings/host-infrastructure`.
- `web/app/src/features/settings/pages/SettingsPage.tsx`: compute `canManageHostInfrastructure`.
- `web/app/src/features/settings/pages/settings-page/SettingsSectionBody.tsx`: lazy-load host infrastructure section.
- `web/app/src/features/settings/_tests/settings-page.test.tsx`: route/permission coverage.
- `web/app/src/routes/_tests/section-shell-routing.test.tsx`: redirect coverage if current route tests require it.
- `web/app/src/features/settings/api/_tests/settings-api.test.ts`: wrapper coverage.

### Task 1: Add Settings API Wrapper

**Files:**
- Create: `web/app/src/features/settings/api/host-infrastructure.ts`
- Modify: `web/app/src/features/settings/api/_tests/settings-api.test.ts`

 **Step 1: Add wrapper tests**

Extend the existing api-client mock with:

```ts
listConsoleHostInfrastructureProviders: vi.fn().mockResolvedValue([]),
saveConsoleHostInfrastructureProviderConfig: vi.fn().mockResolvedValue({
  restart_required: true,
  installation_desired_state: 'pending_restart',
  provider_config_status: 'pending_restart'
})
```

Add expectations:

```ts
import {
  fetchSettingsHostInfrastructureProviders,
  saveSettingsHostInfrastructureProviderConfig,
  settingsHostInfrastructureProvidersQueryKey
} from '../host-infrastructure';

test('forwards host infrastructure provider helpers', async () => {
  expect(settingsHostInfrastructureProvidersQueryKey).toEqual([
    'settings',
    'host-infrastructure',
    'providers'
  ]);

  await fetchSettingsHostInfrastructureProviders();
  await saveSettingsHostInfrastructureProviderConfig(
    'installation-1',
    'redis',
    {
      enabled_contracts: ['storage-ephemeral'],
      config_json: { host: 'localhost', port: 6379 }
    },
    'csrf-123'
  );

  expect(listConsoleHostInfrastructureProviders).toHaveBeenCalledTimes(1);
  expect(saveConsoleHostInfrastructureProviderConfig).toHaveBeenCalledWith(
    'installation-1',
    'redis',
    {
      enabled_contracts: ['storage-ephemeral'],
      config_json: { host: 'localhost', port: 6379 }
    },
    'csrf-123'
  );
});
```

 **Step 2: Implement wrapper**

Create:

```ts
import {
  listConsoleHostInfrastructureProviders,
  saveConsoleHostInfrastructureProviderConfig,
  type ConsoleHostInfrastructureProviderConfig,
  type SaveConsoleHostInfrastructureProviderConfigInput
} from '@1flowbase/api-client';

export type SettingsHostInfrastructureProviderConfig =
  ConsoleHostInfrastructureProviderConfig;

export type SaveSettingsHostInfrastructureProviderConfigInput =
  SaveConsoleHostInfrastructureProviderConfigInput;

export const settingsHostInfrastructureProvidersQueryKey = [
  'settings',
  'host-infrastructure',
  'providers'
] as const;

export function fetchSettingsHostInfrastructureProviders() {
  return listConsoleHostInfrastructureProviders();
}

export function saveSettingsHostInfrastructureProviderConfig(
  installationId: string,
  providerCode: string,
  input: SaveSettingsHostInfrastructureProviderConfigInput,
  csrfToken: string
) {
  return saveConsoleHostInfrastructureProviderConfig(
    installationId,
    providerCode,
    input,
    csrfToken
  );
}
```

 **Step 3: Run wrapper test**

Run:

```bash
node scripts/node/test-frontend.js fast -- settings-api
```

Expected: PASS.

### Task 2: Add Settings Route And Permission Gate

**Files:**
- Modify: `web/app/src/features/settings/lib/settings-sections.tsx`
- Modify: `web/app/src/app/router.tsx`
- Modify: `web/app/src/features/settings/pages/SettingsPage.tsx`
- Modify: `web/app/src/features/settings/pages/settings-page/SettingsSectionBody.tsx`
- Modify: `web/app/src/features/settings/_tests/settings-page.test.tsx`

 **Step 1: Write route tests**

Add:

```ts
test('shows 基础设施 when plugin_config.view.all is the only visible settings section', async () => {
  authenticateWithPermissions(['route_page.view.all', 'plugin_config.view.all']);

  renderApp('/settings');

  await waitFor(() => {
    expect(window.location.pathname).toBe('/settings/host-infrastructure');
  });
  expect(
    await screen.findByRole('heading', { name: '基础设施', level: 3 })
  ).toBeInTheDocument();
});
```

 **Step 2: Add section definition**

Update `SettingsSectionKey`:

```ts
| 'host-infrastructure'
```

Add section after `system-runtime`:

```ts
{
  key: 'host-infrastructure',
  label: '基础设施',
  to: '/settings/host-infrastructure',
  requiredPermissions: ['plugin_config.view.all']
}
```

 **Step 3: Add router entry**

Add:

```ts
const settingsHostInfrastructureRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/host-infrastructure',
  notFoundComponent: NotFoundPage,
  component: () => renderSettingsRoute('host-infrastructure')
});
```

Add it to `routeTree` next to settings routes.

 **Step 4: Lazy-load panel**

In `SettingsPage.tsx`, compute:

```ts
const canManageHostInfrastructure =
  isRoot || permissionSet.has('plugin_config.configure.all');
```

Pass it to `SettingsSectionBody`.

In `SettingsSectionBody.tsx`, add:

```ts
const HostInfrastructurePanel = lazy(() =>
  import('../../components/host-infrastructure/HostInfrastructurePanel').then((module) => ({
    default: module.HostInfrastructurePanel
  }))
);
```

Switch case:

```tsx
case 'host-infrastructure':
  return (
    <SettingsSectionBoundary>
      <HostInfrastructurePanel canManage={canManageHostInfrastructure} />
    </SettingsSectionBoundary>
  );
```

 **Step 5: Run route tests**

Run:

```bash
node scripts/node/test-frontend.js fast -- settings-page
```

Expected: PASS.

### Task 3: Build Provider List Panel

**Files:**
- Create: `web/app/src/features/settings/components/host-infrastructure/HostInfrastructurePanel.tsx`
- Create: `web/app/src/features/settings/components/host-infrastructure/HostInfrastructureProviderTable.tsx`
- Create: `web/app/src/features/settings/components/host-infrastructure/host-infrastructure-panel.css`
- Create: `web/app/src/features/settings/components/host-infrastructure/_tests/HostInfrastructurePanel.test.tsx`

 **Step 1: Write component tests**

Add:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

const api = vi.hoisted(() => ({
  settingsHostInfrastructureProvidersQueryKey: [
    'settings',
    'host-infrastructure',
    'providers'
  ],
  fetchSettingsHostInfrastructureProviders: vi.fn(),
  saveSettingsHostInfrastructureProviderConfig: vi.fn()
}));

vi.mock('../../../api/host-infrastructure', () => api);

import { HostInfrastructurePanel } from '../HostInfrastructurePanel';

function renderPanel(canManage = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HostInfrastructurePanel canManage={canManage} />
    </QueryClientProvider>
  );
}

describe('HostInfrastructurePanel', () => {
  test('renders installed inactive provider config from manifest schema', async () => {
    api.fetchSettingsHostInfrastructureProviders.mockResolvedValue([
      {
        installation_id: 'installation-1',
        extension_id: 'redis-infra-host',
        provider_code: 'redis',
        display_name: 'Redis',
        description: 'Redis backed host infrastructure.',
        runtime_status: 'inactive',
        desired_state: 'disabled',
        config_ref: 'secret://system/redis-infra-host/config',
        contracts: ['storage-ephemeral', 'cache-store'],
        enabled_contracts: [],
        config_schema: [
          { key: 'host', label: 'Host', type: 'string', required: true },
          { key: 'port', label: 'Port', type: 'number', required: true }
        ],
        config_json: {},
        restart_required: false
      }
    ]);

    renderPanel();

    expect(await screen.findByRole('heading', { name: '基础设施', level: 3 })).toBeInTheDocument();
    const row = screen.getByText('Redis').closest('tr') as HTMLElement;
    expect(within(row).getByText('disabled')).toBeInTheDocument();
    expect(within(row).getByText('inactive')).toBeInTheDocument();
    expect(within(row).getByText('storage-ephemeral')).toBeInTheDocument();
    expect(within(row).getByText('cache-store')).toBeInTheDocument();
  });

  test('renders pending restart state without claiming provider is active', async () => {
    api.fetchSettingsHostInfrastructureProviders.mockResolvedValue([
      {
        installation_id: 'installation-1',
        extension_id: 'redis-infra-host',
        provider_code: 'redis',
        display_name: 'Redis',
        description: null,
        runtime_status: 'inactive',
        desired_state: 'pending_restart',
        config_ref: 'secret://system/redis-infra-host/config',
        contracts: ['storage-ephemeral'],
        enabled_contracts: ['storage-ephemeral'],
        config_schema: [],
        config_json: {},
        restart_required: true
      }
    ]);

    renderPanel();

    const row = (await screen.findByText('Redis')).closest('tr') as HTMLElement;
    expect(within(row).getByText('pending_restart')).toBeInTheDocument();
    expect(within(row).getByText('inactive')).toBeInTheDocument();
    expect(screen.getByText('重启后生效')).toBeInTheDocument();
  });
});
```

 **Step 2: Implement panel**

Use existing settings section surface:

```tsx
import { Alert, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';

import { SettingsSectionSurface } from '../SettingsSectionSurface';
import {
  fetchSettingsHostInfrastructureProviders,
  settingsHostInfrastructureProvidersQueryKey
} from '../../api/host-infrastructure';
import { HostInfrastructureProviderTable } from './HostInfrastructureProviderTable';
import './host-infrastructure-panel.css';

export function HostInfrastructurePanel({ canManage }: { canManage: boolean }) {
  const providersQuery = useQuery({
    queryKey: settingsHostInfrastructureProvidersQueryKey,
    queryFn: fetchSettingsHostInfrastructureProviders
  });

  return (
    <SettingsSectionSurface
      title="基础设施"
      description="管理缓存、短租约、事件、任务和限流等宿主基础设施 provider。"
    >
      <Space direction="vertical" size={16} className="host-infrastructure-panel">
        <Alert
          type="info"
          showIcon
          message="安装、配置和启用会保存为待应用变更，重启 api-server 一次后生效。"
        />
        <HostInfrastructureProviderTable
          providers={providersQuery.data ?? []}
          loading={providersQuery.isLoading}
          canManage={canManage}
        />
      </Space>
    </SettingsSectionSurface>
  );
}
```

The table columns are:

```text
Provider display_name
extension_id / provider_code
contracts as compact tags
desired_state
runtime_status
restart_required as "重启后生效" tag when true
action button "配置"
```

Use `Table`, `Tag`, `Button`, and `Space`. Do not use nested cards.

 **Step 3: Run component test**

Run:

```bash
node scripts/node/test-frontend.js fast -- HostInfrastructurePanel
```

Expected: PASS.

### Task 4: Add Schema Drawer And Save Flow

**Files:**
- Create: `web/app/src/features/settings/components/host-infrastructure/HostInfrastructureProviderDrawer.tsx`
- Modify: `web/app/src/features/settings/components/host-infrastructure/HostInfrastructureProviderTable.tsx`
- Modify: `web/app/src/features/settings/components/host-infrastructure/HostInfrastructurePanel.tsx`
- Modify: `web/app/src/features/settings/components/host-infrastructure/_tests/HostInfrastructurePanel.test.tsx`

 **Step 1: Write save-flow tests**

Add:

```tsx
import userEvent from '@testing-library/user-event';

test('saves config and contract selection as one pending restart change', async () => {
  const user = userEvent.setup();
  api.fetchSettingsHostInfrastructureProviders.mockResolvedValue([
    {
      installation_id: 'installation-1',
      extension_id: 'redis-infra-host',
      provider_code: 'redis',
      display_name: 'Redis',
      description: null,
      runtime_status: 'inactive',
      desired_state: 'disabled',
      config_ref: 'secret://system/redis-infra-host/config',
      contracts: ['storage-ephemeral', 'cache-store'],
      enabled_contracts: [],
      config_schema: [
        { key: 'host', label: 'Host', type: 'string', required: true },
        { key: 'port', label: 'Port', type: 'number', required: true, default_value: 6379 },
        { key: 'password_ref', label: 'Password Secret Ref', type: 'string', send_mode: 'secret_ref' }
      ],
      config_json: {},
      restart_required: false
    }
  ]);
  api.saveSettingsHostInfrastructureProviderConfig.mockResolvedValue({
    restart_required: true,
    installation_desired_state: 'pending_restart',
    provider_config_status: 'pending_restart'
  });

  renderPanel(true);

  await user.click(await screen.findByRole('button', { name: '配置' }));
  await user.type(screen.getByLabelText('Host'), 'localhost');
  await user.clear(screen.getByLabelText('Port'));
  await user.type(screen.getByLabelText('Port'), '6379');
  await user.click(screen.getByLabelText('storage-ephemeral'));
  await user.click(screen.getByRole('button', { name: '保存并等待重启' }));

  expect(api.saveSettingsHostInfrastructureProviderConfig).toHaveBeenCalledWith(
    'installation-1',
    'redis',
    {
      enabled_contracts: ['storage-ephemeral'],
      config_json: {
        host: 'localhost',
        port: 6379
      }
    },
    'csrf-123'
  );
  expect(await screen.findByText('已保存，重启 api-server 一次后生效。')).toBeInTheDocument();
});
```

Use the existing auth store test helper pattern to seed `csrfToken: "csrf-123"`.

 **Step 2: Implement drawer controls**

Drawer behavior:

```text
title: <display_name> 配置
description area: extension_id, provider_code, config_ref
contract selection: Checkbox.Group from provider.contracts
form fields: generated from provider.config_schema
primary action: 保存并等待重启
disabled when canManage=false
success message: 已保存，重启 api-server 一次后生效。
```

Field mapping:

```text
string -> Input
number -> InputNumber
boolean -> Switch
select -> Select with field.options
password_ref/send_mode secret_ref -> Input placeholder "env://REDIS_PASSWORD"
```

Initial values:

```ts
const initialValues = {
  ...fieldDefaultValuesFromSchema,
  ...provider.config_json
};
```

Before submit:

```ts
function compactConfig(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );
}
```

Mutation invalidates:

```ts
queryClient.invalidateQueries({
  queryKey: settingsHostInfrastructureProvidersQueryKey
});
```

 **Step 3: Run drawer tests**

Run:

```bash
node scripts/node/test-frontend.js fast -- HostInfrastructurePanel
```

Expected: PASS.

### Task 5: Verify Settings Integration

**Files:**
- Modify only files touched by Tasks 1-4 if failures show route, import, or type mismatches.

 **Step 1: Run targeted settings tests**

Run:

```bash
node scripts/node/test-frontend.js fast -- settings-page
node scripts/node/test-frontend.js fast -- HostInfrastructurePanel
node scripts/node/test-frontend.js fast -- settings-api
```

Expected: PASS.

 **Step 2: Run type/build verification**

Run:

```bash
node scripts/node/test-frontend.js fast
```

Expected: PASS.

 **Step 3: Commit Plan D**

```bash
git add web/packages/api-client/src web/app/src/app/router.tsx web/app/src/features/settings
git commit -m "feat: add host infrastructure settings page"
```
