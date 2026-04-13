# Console Shell, Auth, And Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the approved console-shell redesign by replacing the bootstrap shell with the formal console routes, adding real sign-in/session handling, implementing `/me` and `/settings`, and closing the remaining backend contract gaps for `csrf_token` recovery and profile updates.

**Architecture:** Do the work in six slices that keep the app runnable after every commit. First, close the small backend contract gap (`GET /api/console/session` + `PATCH /api/console/me`) so the frontend can depend on a stable API. Then rebuild the route truth layer and shell chrome, add a typed `api-client` plus auth/session state, implement settings management and the personal profile page on top of that foundation, and finally refresh style-boundary plus full-stack verification.

**Tech Stack:** React 19, TypeScript, TanStack Router, TanStack Query, Zustand, Ant Design, Vitest, Playwright-backed `style-boundary`, Rust stable, Axum, SQLx/PostgreSQL

**Source Spec:** `docs/superpowers/specs/1flowse/2026-04-13-console-shell-auth-settings-design.md`

**Approval:** User approved moving this design doc into an implementation plan on `2026-04-14 07`.

---

## Scope Notes

- Keep `/embedded-apps` as the stable route path; only its product copy changes from “团队” to “子系统”.
- Remove `agent-flow`, embedded runtime mount, and embedded detail routes from the active route tree instead of leaving dead navigation metadata behind.
- Route-level permission metadata must align to real backend catalog codes such as `route_page.view.all`, `embedded_app.view.all`, `user.view.all`, `user.manage.all`, `role_permission.view.all`, and `role_permission.manage.all`; do not keep the current placeholder keys like `home.view`.
- `设置` is a session-only route whose internal sections are permission-gated; `个人资料` is always session-only and never doubles as a system-management page.
- Backend route tests in `api-server` require the local Postgres/Redis test services referenced by `api/apps/api-server/src/_tests/support.rs`; run the cargo commands serially.

## File Structure

**Create**
- `api/crates/control-plane/src/_tests/profile_service_tests.rs`
- `web/packages/api-client/src/errors.ts`
- `web/packages/api-client/src/transport.ts`
- `web/packages/api-client/src/public-auth.ts`
- `web/packages/api-client/src/console-session.ts`
- `web/packages/api-client/src/console-me.ts`
- `web/packages/api-client/src/console-members.ts`
- `web/packages/api-client/src/console-roles.ts`
- `web/packages/api-client/src/console-permissions.ts`
- `web/packages/api-client/src/_tests/transport.test.ts`
- `web/app/src/features/auth/api/session.ts`
- `web/app/src/features/auth/components/AuthBootstrap.tsx`
- `web/app/src/features/auth/pages/SignInPage.tsx`
- `web/app/src/features/auth/_tests/sign-in-page.test.tsx`
- `web/app/src/features/auth/_tests/auth-bootstrap.test.tsx`
- `web/app/src/features/tools/pages/ToolsPage.tsx`
- `web/app/src/features/settings/api/members.ts`
- `web/app/src/features/settings/api/roles.ts`
- `web/app/src/features/settings/api/permissions.ts`
- `web/app/src/features/settings/components/ApiDocsPanel.tsx`
- `web/app/src/features/settings/components/MemberManagementPanel.tsx`
- `web/app/src/features/settings/components/RolePermissionPanel.tsx`
- `web/app/src/features/settings/components/SettingsSidebar.tsx`
- `web/app/src/features/settings/pages/SettingsPage.tsx`
- `web/app/src/features/settings/_tests/settings-page.test.tsx`
- `web/app/src/features/me/api/me.ts`
- `web/app/src/features/me/components/ProfileForm.tsx`
- `web/app/src/features/me/components/ChangePasswordForm.tsx`
- `web/app/src/features/me/pages/MePage.tsx`
- `web/app/src/features/me/_tests/me-page.test.tsx`
- `web/app/src/shared/ui/PermissionDeniedState.tsx`
- `web/app/src/state/auth-store.ts`

**Modify**
- `api/crates/control-plane/src/profile.rs`
- `api/crates/control-plane/src/ports.rs`
- `api/crates/control-plane/src/_tests/mod.rs`
- `api/crates/control-plane/src/_tests/support.rs`
- `api/crates/storage-pg/src/auth_repository.rs`
- `api/crates/storage-pg/src/repositories.rs`
- `api/apps/api-server/src/routes/me.rs`
- `api/apps/api-server/src/routes/session.rs`
- `api/apps/api-server/src/openapi.rs`
- `api/apps/api-server/src/_tests/me_routes.rs`
- `api/apps/api-server/src/_tests/session_routes.rs`
- `api/apps/api-server/src/_tests/openapi_alignment.rs`
- `web/packages/shared-types/src/index.ts`
- `web/packages/api-client/src/index.ts`
- `web/app/src/app/App.tsx`
- `web/app/src/app/AppProviders.tsx`
- `web/app/src/app/router.tsx`
- `web/app/src/app/_tests/app-shell.test.tsx`
- `web/app/src/app-shell/AppShellFrame.tsx`
- `web/app/src/app-shell/Navigation.tsx`
- `web/app/src/app-shell/AccountMenu.tsx`
- `web/app/src/app-shell/account-menu-items.tsx`
- `web/app/src/app-shell/_tests/account-menu.test.tsx`
- `web/app/src/app-shell/_tests/navigation.test.tsx`
- `web/app/src/routes/route-config.ts`
- `web/app/src/routes/route-guards.tsx`
- `web/app/src/routes/_tests/route-config.test.ts`
- `web/app/src/routes/_tests/route-guards.test.tsx`
- `web/app/src/features/home/pages/HomePage.tsx`
- `web/app/src/features/home/_tests/home-page.test.tsx`
- `web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx`
- `web/app/src/style-boundary/registry.tsx`
- `web/app/src/style-boundary/scenario-manifest.json`
- `web/app/src/style-boundary/_tests/registry.test.tsx`

**Delete After Migration**
- `web/app/src/features/agent-flow/pages/AgentFlowPage.tsx`
- `web/app/src/features/embedded-runtime/pages/EmbeddedMountPage.tsx`
- `web/app/src/features/embedded-apps/pages/EmbeddedAppDetailPage.tsx`
- `web/app/src/state/app-store.ts`

### Task 1: Close The Backend Session/Profile Contract

**Files:**
- Create: `api/crates/control-plane/src/_tests/profile_service_tests.rs`
- Modify: `api/crates/control-plane/src/profile.rs`
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`
- Modify: `api/crates/control-plane/src/_tests/support.rs`
- Modify: `api/crates/storage-pg/src/auth_repository.rs`
- Modify: `api/crates/storage-pg/src/repositories.rs`
- Modify: `api/apps/api-server/src/routes/me.rs`
- Modify: `api/apps/api-server/src/routes/session.rs`
- Modify: `api/apps/api-server/src/openapi.rs`
- Modify: `api/apps/api-server/src/_tests/me_routes.rs`
- Modify: `api/apps/api-server/src/_tests/session_routes.rs`
- Modify: `api/apps/api-server/src/_tests/openapi_alignment.rs`

- [ ] **Step 1: Add failing service and route coverage for the missing contract**

Create `api/crates/control-plane/src/_tests/profile_service_tests.rs`:

```rust
#[tokio::test]
async fn update_me_updates_only_profile_fields() {}
```

Extend `api/apps/api-server/src/_tests/session_routes.rs` with:

```rust
#[tokio::test]
async fn session_route_returns_wrapped_actor_payload_and_csrf_token() {}
```

Extend `api/apps/api-server/src/_tests/me_routes.rs` with:

```rust
#[tokio::test]
async fn patch_me_route_updates_editable_fields() {}
```

Extend `api/apps/api-server/src/_tests/openapi_alignment.rs` with:

```rust
#[tokio::test]
async fn openapi_contains_session_csrf_and_patch_me_routes() {}
```

- [ ] **Step 2: Run the focused backend failures**

Run: `cargo test -p control-plane _tests::profile_service_tests::update_me_updates_only_profile_fields -- --exact`
Expected: FAIL because `ProfileService` has no update command.

Run: `cargo test -p api-server _tests::me_routes::patch_me_route_updates_editable_fields -- --exact`
Expected: FAIL because `PATCH /api/console/me` is not registered.

- [ ] **Step 3: Implement the profile update path and `csrf_token` recovery**

Add an explicit repository input in `api/crates/control-plane/src/ports.rs`:

```rust
#[derive(Debug, Clone)]
pub struct UpdateProfileInput {
    pub actor_user_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub nickname: String,
    pub email: String,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub introduction: String,
}
```

and extend `AuthRepository` with:

```rust
async fn update_profile(&self, input: &UpdateProfileInput) -> anyhow::Result<UserRecord>;
```

Extend `api/crates/control-plane/src/profile.rs` with:

```rust
pub struct UpdateMeCommand {
    pub actor_user_id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub nickname: String,
    pub email: String,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub introduction: String,
}
```

and a new `update_me()` method that:
- updates only the editable profile columns;
- reloads the actor context after persistence;
- returns the same `MeProfile` shape as `get_me()`.

Update `api/crates/storage-pg/src/auth_repository.rs` to persist:
- `name`
- `nickname`
- `email`
- `phone`
- `avatar_url`
- `introduction`

with `updated_by/updated_at`, and return the reloaded `UserRecord`.

Update `api/apps/api-server/src/routes/session.rs` so `SessionResponse` becomes:

```rust
#[derive(Debug, Serialize, ToSchema)]
pub struct SessionResponse {
    pub actor: serde_json::Value,
    pub session: serde_json::Value,
    pub csrf_token: String,
}
```

Update `api/apps/api-server/src/routes/me.rs` to:
- expand `MeResponse` with `phone`, `avatar_url`, and `introduction`;
- add:

```rust
#[derive(Debug, Deserialize, ToSchema)]
pub struct PatchMeBody {
    pub name: String,
    pub nickname: String,
    pub email: String,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub introduction: String,
}
```

- expose `PATCH /api/console/me` with `require_session + require_csrf`;
- return `Json<ApiSuccess<MeResponse>>`.

Update `api/apps/api-server/src/openapi.rs` so the new `patch_me` path and `PatchMeBody` schema are exported.

- [ ] **Step 4: Re-run the focused backend tests**

Run: `cargo test -p control-plane _tests::profile_service_tests::update_me_updates_only_profile_fields -- --exact`
Expected: PASS

Run: `cargo test -p api-server _tests::session_routes::session_route_returns_wrapped_actor_payload_and_csrf_token -- --exact`
Expected: PASS

Run: `cargo test -p api-server _tests::me_routes::patch_me_route_updates_editable_fields -- --exact`
Expected: PASS

Run: `cargo test -p api-server _tests::openapi_alignment::openapi_contains_session_csrf_and_patch_me_routes -- --exact`
Expected: PASS

- [ ] **Step 5: Commit the backend contract slice**

```bash
git add api/crates/control-plane/src/profile.rs api/crates/control-plane/src/ports.rs api/crates/control-plane/src/_tests/mod.rs api/crates/control-plane/src/_tests/support.rs api/crates/control-plane/src/_tests/profile_service_tests.rs api/crates/storage-pg/src/auth_repository.rs api/crates/storage-pg/src/repositories.rs api/apps/api-server/src/routes/me.rs api/apps/api-server/src/routes/session.rs api/apps/api-server/src/openapi.rs api/apps/api-server/src/_tests/me_routes.rs api/apps/api-server/src/_tests/session_routes.rs api/apps/api-server/src/_tests/openapi_alignment.rs
git commit -m "feat(api): add session csrf recovery and me profile update"
```

### Task 2: Replace The Bootstrap Route Tree With The Formal Console Shell

**Files:**
- Create: `web/app/src/features/tools/pages/ToolsPage.tsx`
- Create: `web/app/src/features/settings/pages/SettingsPage.tsx`
- Create: `web/app/src/features/me/pages/MePage.tsx`
- Create: `web/app/src/features/auth/pages/SignInPage.tsx`
- Modify: `web/packages/shared-types/src/index.ts`
- Modify: `web/app/src/routes/route-config.ts`
- Modify: `web/app/src/app/router.tsx`
- Modify: `web/app/src/app-shell/AppShellFrame.tsx`
- Modify: `web/app/src/app-shell/Navigation.tsx`
- Modify: `web/app/src/app-shell/account-menu-items.tsx`
- Modify: `web/app/src/app-shell/_tests/account-menu.test.tsx`
- Modify: `web/app/src/app-shell/_tests/navigation.test.tsx`
- Modify: `web/app/src/app/_tests/app-shell.test.tsx`
- Modify: `web/app/src/routes/_tests/route-config.test.ts`
- Modify: `web/app/src/features/home/pages/HomePage.tsx`
- Modify: `web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx`

- [ ] **Step 1: Update the existing frontend tests to express the new shell**

Change `web/app/src/routes/_tests/route-config.test.ts` to assert:

```ts
expect(APP_ROUTES.map((route) => route.id)).toEqual([
  'home',
  'embedded-apps',
  'tools',
  'settings',
  'me',
  'sign-in'
]);
expect(getSelectedRouteId('/settings')).toBe('settings');
expect(getSelectedRouteId('/me')).toBe('me');
```

Change `web/app/src/app-shell/_tests/navigation.test.tsx` to assert:
- primary nav labels are `工作台 / 子系统 / 工具`;
- `settings` is no longer mixed into the primary nav;
- `/embedded-apps` is marked current for the “子系统” entry.

Change `web/app/src/app/_tests/app-shell.test.tsx` to assert:
- shell title is `1Flowse`;
- bootstrap copy is absent;
- right-side actions contain `设置` and `用户`;
- `/agent-flow`, `/embedded/*`, and `/embedded-apps/:id` no longer resolve.

- [ ] **Step 2: Run the shell-focused failures**

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-config.test.ts src/app-shell/_tests/navigation.test.tsx src/app/_tests/app-shell.test.tsx`
Expected: FAIL because the route ids, shell title, and route tree still describe the bootstrap console.

- [ ] **Step 3: Rebuild the route truth layer and shell chrome**

Update `web/packages/shared-types/src/index.ts`:

```ts
export type AppRouteId =
  | 'home'
  | 'embedded-apps'
  | 'tools'
  | 'settings'
  | 'me'
  | 'sign-in';
```

Update `web/app/src/routes/route-config.ts` so each route declares:

```ts
export interface AppRouteDefinition {
  id: AppRouteId;
  path: string;
  navLabel: string | null;
  chromeSlot: 'primary' | 'secondary' | 'hidden';
  guard: 'public-only' | 'session-required';
  permissionKey: string | null;
  selectedMatchers: Array<(pathname: string) => boolean>;
}
```

with this route set:
- `/` → `home`, primary nav, `route_page.view.all`
- `/embedded-apps` → `embedded-apps`, primary nav, `embedded_app.view.all`
- `/tools` → `tools`, primary nav, `route_page.view.all`
- `/settings` → `settings`, secondary chrome action, no single hard gate
- `/me` → `me`, hidden nav, session-only
- `/sign-in` → `sign-in`, hidden nav, public-only

Refactor `web/app/src/app/router.tsx` to use a pathless shell layout:

```tsx
const rootRoute = createRootRoute({ component: () => <Outlet /> });
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: ShellLayout
});
```

Put `home / embedded-apps / tools / settings / me` under `shellRoute`, and `sign-in` directly under `rootRoute`.

Update `web/app/src/app-shell/AppShellFrame.tsx` so it renders:
- title `1Flowse`;
- primary navigation from `chromeSlot === 'primary'`;
- right-side actions as `设置` entry plus `用户` menu.

Update `web/app/src/app-shell/account-menu-items.tsx` so the menu only contains:

```ts
[
  { key: 'profile', label: '个人资料', icon: <UserOutlined /> },
  { key: 'sign-out', label: '退出登录', icon: <LogoutOutlined /> }
]
```

Update page copy:
- `HomePage` becomes a formal empty-state dashboard shell, not “Workspace Bootstrap”;
- `EmbeddedAppsPage` headline becomes `子系统`;
- `ToolsPage` is a formal “建设中” page with no demo language;
- `SettingsPage`, `MePage`, and `SignInPage` are created as route-valid placeholders for later tasks.

- [ ] **Step 4: Re-run the route and shell tests**

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-config.test.ts src/app-shell/_tests/account-menu.test.tsx src/app-shell/_tests/navigation.test.tsx src/app/_tests/app-shell.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the shell realignment**

```bash
git add web/packages/shared-types/src/index.ts web/app/src/routes/route-config.ts web/app/src/app/router.tsx web/app/src/app-shell/AppShellFrame.tsx web/app/src/app-shell/Navigation.tsx web/app/src/app-shell/account-menu-items.tsx web/app/src/app-shell/_tests/account-menu.test.tsx web/app/src/app-shell/_tests/navigation.test.tsx web/app/src/app/_tests/app-shell.test.tsx web/app/src/routes/_tests/route-config.test.ts web/app/src/features/home/pages/HomePage.tsx web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx web/app/src/features/tools/pages/ToolsPage.tsx web/app/src/features/settings/pages/SettingsPage.tsx web/app/src/features/me/pages/MePage.tsx web/app/src/features/auth/pages/SignInPage.tsx
git commit -m "feat(web): replace bootstrap shell with formal console routes"
```

### Task 3: Add Typed Api Client And Auth Session Foundation

**Files:**
- Create: `web/packages/api-client/src/errors.ts`
- Create: `web/packages/api-client/src/transport.ts`
- Create: `web/packages/api-client/src/public-auth.ts`
- Create: `web/packages/api-client/src/console-session.ts`
- Create: `web/packages/api-client/src/console-me.ts`
- Create: `web/packages/api-client/src/console-members.ts`
- Create: `web/packages/api-client/src/console-roles.ts`
- Create: `web/packages/api-client/src/console-permissions.ts`
- Create: `web/packages/api-client/src/_tests/transport.test.ts`
- Create: `web/app/src/features/auth/api/session.ts`
- Create: `web/app/src/features/auth/components/AuthBootstrap.tsx`
- Create: `web/app/src/features/auth/_tests/sign-in-page.test.tsx`
- Create: `web/app/src/features/auth/_tests/auth-bootstrap.test.tsx`
- Create: `web/app/src/state/auth-store.ts`
- Create: `web/app/src/shared/ui/PermissionDeniedState.tsx`
- Modify: `web/packages/api-client/src/index.ts`
- Modify: `web/app/src/app/App.tsx`
- Modify: `web/app/src/app/AppProviders.tsx`
- Modify: `web/app/src/routes/route-guards.tsx`
- Modify: `web/app/src/app-shell/AccountMenu.tsx`
- Modify: `web/app/src/features/auth/pages/SignInPage.tsx`
- Modify: `web/app/src/routes/_tests/route-guards.test.tsx`

- [ ] **Step 1: Write the auth/client failures first**

Create `web/packages/api-client/src/_tests/transport.test.ts`:

```ts
test('apiFetch sends credentials and propagates x-csrf-token', async () => {});
test('apiFetch throws ApiClientError for non-2xx responses', async () => {});
```

Create `web/app/src/features/auth/_tests/sign-in-page.test.tsx`:

```tsx
test('submits account/password and redirects to home on success', async () => {});
```

Update `web/app/src/routes/_tests/route-guards.test.tsx` with:

```tsx
test('redirects anonymous users from session routes to /sign-in', async () => {});
test('renders permission denied state for authenticated users missing the route permission', async () => {});
```

- [ ] **Step 2: Run the auth/client failures**

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-guards.test.tsx src/features/auth/_tests/sign-in-page.test.tsx`
Expected: FAIL because the auth state and sign-in flow do not exist.

Run: `pnpm --dir web/packages/api-client exec vitest --run src/_tests/transport.test.ts`
Expected: FAIL because the split transport modules do not exist.

- [ ] **Step 3: Implement the shared transport and session bootstrap**

Split `web/packages/api-client/src/index.ts` into focused modules and export a shared transport:

```ts
export async function apiFetch<T>({
  path,
  method = 'GET',
  body,
  csrfToken,
  baseUrl = getDefaultApiBaseUrl()
}: ApiRequestOptions): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'content-type': body ? 'application/json' : undefined,
      'x-csrf-token': csrfToken
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw await ApiClientError.fromResponse(response);
  }

  return unwrapApiSuccess<T>(await response.json());
}
```

Create `web/app/src/state/auth-store.ts`:

```ts
interface AuthState {
  sessionStatus: 'unknown' | 'authenticated' | 'anonymous';
  csrfToken: string | null;
  actor: ConsoleSessionActor | null;
  me: ConsoleMe | null;
  setAuthenticated: (payload: AuthSnapshot) => void;
  setAnonymous: () => void;
  setMe: (me: ConsoleMe) => void;
}
```

Create `web/app/src/features/auth/api/session.ts` with query/mutation helpers for:
- sign-in
- fetch current session
- fetch current me
- sign out

Create `web/app/src/features/auth/components/AuthBootstrap.tsx` that:
- runs once on app boot;
- calls `GET /api/console/session`;
- on `200`, stores `actor + csrfToken`, then hydrates `GET /api/console/me`;
- on `401`, clears auth and leaves the app in `anonymous`.

Update `web/app/src/routes/route-guards.tsx` so:
- `public-only` routes redirect authenticated users to `/`;
- `session-required` routes wait while `sessionStatus === 'unknown'`;
- `session-required` routes redirect anonymous users to `/sign-in`;
- authenticated users missing a defined `permissionKey` render `PermissionDeniedState`.

Update `SignInPage.tsx` to submit `identifier/password`, store the returned `csrf_token`, fetch `/api/console/me`, and navigate to `/`.

Update `AccountMenu.tsx` to:
- navigate to `/me` on `profile`;
- call `DELETE /api/console/session` with `x-csrf-token`;
- clear auth state and navigate to `/sign-in`.

- [ ] **Step 4: Re-run the auth and client tests**

Run: `pnpm --dir web/packages/api-client exec vitest --run src/_tests/transport.test.ts`
Expected: PASS

Run: `pnpm --dir web/app exec vitest --run src/routes/_tests/route-guards.test.tsx src/features/auth/_tests/auth-bootstrap.test.tsx src/features/auth/_tests/sign-in-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the auth foundation**

```bash
git add web/packages/api-client/src web/app/src/features/auth web/app/src/state/auth-store.ts web/app/src/shared/ui/PermissionDeniedState.tsx web/app/src/app/App.tsx web/app/src/app/AppProviders.tsx web/app/src/routes/route-guards.tsx web/app/src/app-shell/AccountMenu.tsx web/app/src/routes/_tests/route-guards.test.tsx
git commit -m "feat(web): add console auth session foundation"
```

### Task 4: Implement The Settings Workspace

**Files:**
- Create: `web/app/src/features/settings/api/members.ts`
- Create: `web/app/src/features/settings/api/roles.ts`
- Create: `web/app/src/features/settings/api/permissions.ts`
- Create: `web/app/src/features/settings/components/ApiDocsPanel.tsx`
- Create: `web/app/src/features/settings/components/MemberManagementPanel.tsx`
- Create: `web/app/src/features/settings/components/RolePermissionPanel.tsx`
- Create: `web/app/src/features/settings/components/SettingsSidebar.tsx`
- Create: `web/app/src/features/settings/_tests/settings-page.test.tsx`
- Modify: `web/app/src/features/settings/pages/SettingsPage.tsx`

- [ ] **Step 1: Add failing settings-page coverage**

Create `web/app/src/features/settings/_tests/settings-page.test.tsx`:

```tsx
test('shows api docs for any authenticated user and hides privileged sections without permission', async () => {});
test('renders the members panel when user.view.all is present', async () => {});
test('renders the role permission panel when role_permission.view.all is present', async () => {});
```

The test fixtures should exercise three permission sets:
- `['route_page.view.all']`
- `['route_page.view.all', 'user.view.all']`
- `['route_page.view.all', 'user.view.all', 'user.manage.all', 'role_permission.view.all', 'role_permission.manage.all']`

- [ ] **Step 2: Run the settings failure**

Run: `pnpm --dir web/app exec vitest --run src/features/settings/_tests/settings-page.test.tsx`
Expected: FAIL because `SettingsPage` is still a stub and no feature API wrappers exist.

- [ ] **Step 3: Build the settings feature on top of the real backend endpoints**

Create feature-level API modules that wrap the typed `api-client` functions:
- `members.ts` → list/create/disable/reset password/replace roles
- `roles.ts` → list/create/update/delete/get permissions/replace permissions
- `permissions.ts` → list permission catalog

Implement `SettingsPage.tsx` as:

```tsx
const sections = [
  { key: 'docs', label: 'API 文档', visible: true },
  { key: 'members', label: '用户管理', visible: canViewMembers },
  { key: 'roles', label: '权限管理', visible: canViewRoles }
];
```

`SettingsSidebar.tsx` owns the left nav and chooses the first visible section as the default.

`ApiDocsPanel.tsx` embeds:

```tsx
<iframe title="API 文档" src={`${apiBaseUrl}/docs`} className="settings-docs-frame" />
```

`MemberManagementPanel.tsx` must cover:
- table/list of members;
- create-member form;
- disable action when `user.manage.all`;
- reset-password action when `user.manage.all`;
- replace-role action when `role_permission.manage.all`.

`RolePermissionPanel.tsx` must cover:
- role list;
- create/update/delete role actions when `role_permission.manage.all`;
- permission binding editor using `GET /api/console/permissions` and `PUT /api/console/roles/:id/permissions`.

When a user can open `/settings` but lacks every privileged section, show only `API 文档` and never an empty sidebar slot.

- [ ] **Step 4: Re-run the settings tests**

Run: `pnpm --dir web/app exec vitest --run src/features/settings/_tests/settings-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the settings slice**

```bash
git add web/app/src/features/settings
git commit -m "feat(web): add settings workspace"
```

### Task 5: Implement Personal Profile And Home/Account Polish

**Files:**
- Create: `web/app/src/features/me/api/me.ts`
- Create: `web/app/src/features/me/components/ProfileForm.tsx`
- Create: `web/app/src/features/me/components/ChangePasswordForm.tsx`
- Create: `web/app/src/features/me/_tests/me-page.test.tsx`
- Modify: `web/app/src/features/me/pages/MePage.tsx`
- Modify: `web/app/src/features/home/pages/HomePage.tsx`
- Modify: `web/app/src/features/home/_tests/home-page.test.tsx`
- Modify: `web/app/src/app-shell/AccountMenu.tsx`

- [ ] **Step 1: Write the failing profile-page tests**

Create `web/app/src/features/me/_tests/me-page.test.tsx`:

```tsx
test('renders editable profile fields and a separate change-password section', async () => {});
test('submits PATCH /api/console/me and updates the visible account summary', async () => {});
```

Update `web/app/src/features/home/_tests/home-page.test.tsx` to assert:
- welcome copy uses current user information from auth state;
- role text uses `effective_display_role`;
- backend health is shown as secondary status, not a bootstrap card title.

- [ ] **Step 2: Run the profile failures**

Run: `pnpm --dir web/app exec vitest --run src/features/me/_tests/me-page.test.tsx src/features/home/_tests/home-page.test.tsx`
Expected: FAIL because `/me` is still a stub and `HomePage` still renders bootstrap copy.

- [ ] **Step 3: Implement the profile forms and home/account refresh**

Create `web/app/src/features/me/api/me.ts` with helpers for:
- `GET /api/console/me`
- `PATCH /api/console/me`
- `POST /api/console/me/actions/change-password`

Implement `MePage.tsx` with two blocks:
- `基本资料`
- `安全设置`

`ProfileForm.tsx` edits only:
- `name`
- `nickname`
- `email`
- `phone`
- `avatar_url`
- `introduction`

and displays `account`, role, permissions, and status as read-only metadata.

`ChangePasswordForm.tsx` calls the existing password-change route and, on success, clears auth and returns to `/sign-in`.

Update `HomePage.tsx` so it renders:
- formal heading/description;
- welcome line using `authStore.me.name || authStore.actor.account`;
- current role summary;
- compact health summary from the existing health query.

Update `AccountMenu.tsx` so the trigger label prefers:

```ts
auth.me?.nickname || auth.me?.name || auth.actor?.account || '用户'
```

- [ ] **Step 4: Re-run the profile and home tests**

Run: `pnpm --dir web/app exec vitest --run src/features/me/_tests/me-page.test.tsx src/features/home/_tests/home-page.test.tsx src/app/_tests/app-shell.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the profile slice**

```bash
git add web/app/src/features/me web/app/src/features/home/pages/HomePage.tsx web/app/src/features/home/_tests/home-page.test.tsx web/app/src/app-shell/AccountMenu.tsx
git commit -m "feat(web): add me profile page and home summary"
```

### Task 6: Refresh Style-Boundary And Run Full Verification

**Files:**
- Modify: `web/app/src/style-boundary/scenario-manifest.json`
- Modify: `web/app/src/style-boundary/registry.tsx`
- Modify: `web/app/src/style-boundary/_tests/registry.test.tsx`
- Delete: `web/app/src/features/agent-flow/pages/AgentFlowPage.tsx`
- Delete: `web/app/src/features/embedded-runtime/pages/EmbeddedMountPage.tsx`
- Delete: `web/app/src/features/embedded-apps/pages/EmbeddedAppDetailPage.tsx`
- Delete: `web/app/src/state/app-store.ts`

- [ ] **Step 1: Update style-boundary tests for the new chrome**

Change `web/app/src/style-boundary/_tests/registry.test.tsx` so it expects:
- `个人资料` instead of `Profile`;
- changed-file mapping for `page.home`, `page.embedded-apps`, `page.tools`, `page.settings`;
- the shared shell title `1Flowse`.

- [ ] **Step 2: Run the focused style-boundary failure**

Run: `pnpm --dir web/app exec vitest --run src/style-boundary/_tests/registry.test.tsx`
Expected: FAIL because the manifest and runtime scene registry still describe `page.agent-flow` and old account-menu copy.

- [ ] **Step 3: Refresh the manifest and scene registry**

Update `web/app/src/style-boundary/scenario-manifest.json` to replace `page.agent-flow` with:
- `page.tools`
- `page.settings`

Update `web/app/src/style-boundary/registry.tsx` so the page scenes render:
- `HomePage`
- `EmbeddedAppsPage`
- `ToolsPage`
- `SettingsPage`

and the account popup scene uses the new Chinese account items.

Remove dead bootstrap files listed above after the route tree and tests no longer reference them.

- [ ] **Step 4: Run the full verification suite**

Run frontend verification:

```bash
pnpm --dir web lint
pnpm --dir web test -- --testTimeout=15000
pnpm --dir web/app build
```

Run shell/style runtime verification:

```bash
node scripts/node/dev-up.js ensure --frontend-only --skip-docker
node scripts/node/check-style-boundary.js component component.account-popup
node scripts/node/check-style-boundary.js page page.home
node scripts/node/check-style-boundary.js page page.settings
```

Run backend verification serially:

```bash
cargo test -p control-plane _tests::profile_service_tests::update_me_updates_only_profile_fields -- --exact --nocapture
cargo test -p api-server _tests::session_routes::session_route_returns_wrapped_actor_payload_and_csrf_token -- --exact --nocapture
cargo test -p api-server _tests::me_routes::patch_me_route_updates_editable_fields -- --exact --nocapture
cargo test -p api-server _tests::member_routes::member_routes_create_disable_and_reset_password -- --exact --nocapture
cargo test -p api-server _tests::role_routes::role_routes_create_replace_permissions_and_protect_root -- --exact --nocapture
cargo test -p api-server _tests::openapi_alignment::openapi_contains_session_csrf_and_patch_me_routes -- --exact --nocapture
```

Perform one manual browser pass in both desktop and mobile widths for:
- `/sign-in`
- `/`
- `/settings`
- `/me`

- [ ] **Step 5: Commit the regression cleanup**

```bash
git add web/app/src/style-boundary/scenario-manifest.json web/app/src/style-boundary/registry.tsx web/app/src/style-boundary/_tests/registry.test.tsx
git add -u web/app/src/features/agent-flow/pages/AgentFlowPage.tsx web/app/src/features/embedded-runtime/pages/EmbeddedMountPage.tsx web/app/src/features/embedded-apps/pages/EmbeddedAppDetailPage.tsx web/app/src/state/app-store.ts
git commit -m "test(web): refresh console shell regression coverage"
```

## Self-Review

- Spec coverage: shell/navigation, sign-in/session restore, `/settings`, `/me`, `PATCH /api/console/me`, and `GET /api/console/session` with `csrf_token` each map to at least one task above.
- Placeholder scan: no `TODO/TBD` markers remain; every task points to concrete files and commands.
- Type consistency: route ids, permission keys, and API shapes use the same names across shell, auth store, and backend contract tasks.
