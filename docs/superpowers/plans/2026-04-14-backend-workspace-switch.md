# Backend Workspace Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On top of the completed phase-two backend governance foundation, add a backend-only workspace switch flow so authenticated users can list accessible workspaces and safely switch `current_workspace_id` inside the existing session.

**Architecture:** Keep the current `api-server + control-plane + storage-pg + storage-redis` shape and avoid reopening tenant product surface. First, add repository queries that can enumerate and validate accessible workspaces while hardening actor role resolution for cross-workspace loads. Then add a dedicated workspace-session service that rewrites the existing session with the target `tenant_id/current_workspace_id`, rotates `csrf_token`, and writes audit logs. Finally, expose the flow through `/api/console/workspaces` and `/api/console/session/actions/switch-workspace`, with OpenAPI and backend verification aligned.

**Tech Stack:** Rust stable, Axum, Tokio, SQLx/PostgreSQL, Redis session store, utoipa, Node.js backend verification scripts

**Source Specs:** `docs/superpowers/specs/1flowse/2026-04-13-backend-governance-phase-two-design.md`, `docs/superpowers/plans/history/2026-04-13-backend-governance-phase-two.md`

**Approval:** User requested turning the refreshed backend governance design into a new follow-up implementation plan on `2026-04-14 09`.

**Execution Mode:** Execute in the current repository. Do not create a git worktree for this plan.

---

## Scope Notes

- The historical phase-two governance plan is already complete; this plan only covers the next backend slice that was still out of scope in the refreshed spec.
- This plan is intentionally backend-only. It does not add a frontend workspace selector, tenant management UI, or multi-tenant product surface.
- `teams` / `TeamRecord` continue to serve as the persistence backing for `workspace` semantics in this plan. Naming cleanup stays separate.
- The switch flow must preserve the existing session id, update `tenant_id/current_workspace_id`, rotate `csrf_token`, and reload actor permissions for the target workspace.
- Non-root users may switch only to workspaces where they have membership. `root` may switch to any workspace.

## Scope

This plan covers:

- listing accessible workspaces for the current authenticated user
- validating target workspace accessibility for root and non-root users
- rewriting the current session when switching workspace
- rotating `csrf_token` after workspace switch
- audit logging for workspace switch actions
- backend routes, OpenAPI, route tests, and unified backend verification

This plan does not cover:

- tenant management routes or UI
- frontend workspace selector or navigation changes
- plugin-gated multi-tenant installation flow
- `TeamRecord` to `WorkspaceRecord` rename cleanup
- runtime metadata operator repair workflow

## File Structure

**Create**

- `api/crates/storage-pg/src/_tests/workspace_access_tests.rs`
- `api/crates/control-plane/src/workspace_session.rs`
- `api/crates/control-plane/src/_tests/workspace_session_service_tests.rs`
- `api/apps/api-server/src/routes/workspaces.rs`
- `api/apps/api-server/src/_tests/workspace_routes.rs`

**Modify**

- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/ports.rs`
- `api/crates/control-plane/src/team.rs`
- `api/crates/control-plane/src/_tests/mod.rs`
- `api/crates/control-plane/src/_tests/support.rs`
- `api/crates/storage-pg/src/team_repository.rs`
- `api/crates/storage-pg/src/auth_repository.rs`
- `api/crates/storage-pg/src/_tests/mod.rs`
- `api/crates/storage-redis/src/_tests/session_store_tests.rs`
- `api/apps/api-server/src/lib.rs`
- `api/apps/api-server/src/routes/mod.rs`
- `api/apps/api-server/src/routes/session.rs`
- `api/apps/api-server/src/openapi.rs`
- `api/apps/api-server/src/_tests/support.rs`
- `api/apps/api-server/src/_tests/session_routes.rs`
- `api/apps/api-server/src/_tests/openapi_alignment.rs`

## Task 1: Add Workspace Access Queries And Role Resolution Safety

**Goal:** give backend services one explicit way to enumerate accessible workspaces and verify target workspace access, while fixing stale `effective_display_role` selection when loading actor context in a different workspace.

**Files**

- `api/crates/control-plane/src/ports.rs`
- `api/crates/control-plane/src/team.rs`
- `api/crates/control-plane/src/_tests/support.rs`
- `api/crates/storage-pg/src/team_repository.rs`
- `api/crates/storage-pg/src/auth_repository.rs`
- `api/crates/storage-pg/src/_tests/mod.rs`
- `api/crates/storage-pg/src/_tests/workspace_access_tests.rs`

- [ ] **Step 1: add failing repository coverage for accessible workspace listing and root bypass**

Create `api/crates/storage-pg/src/_tests/workspace_access_tests.rs` with:

```rust
#[tokio::test]
async fn list_accessible_workspaces_returns_only_memberships_for_non_root() {}

#[tokio::test]
async fn list_accessible_workspaces_returns_all_workspaces_for_root() {}

#[tokio::test]
async fn load_actor_context_ignores_display_role_when_role_is_missing_in_target_workspace() {}
```

The first two tests should seed:

- one hidden `root tenant`
- three workspaces under that tenant
- one non-root user who only belongs to two workspaces
- one root user with no extra membership rows

Assertions:

- non-root listing only returns the two membership-bound workspaces
- root listing returns all three workspaces
- target workspace validation returns `Some(TeamRecord)` only when accessible

The third test should prove this regression:

- user default display role is `admin`
- target workspace only grants `manager`
- `load_actor_context(..., Some("admin"))` must return `effective_display_role = "manager"` instead of leaking a stale role label

- [ ] **Step 2: run focused failures**

Run:

```bash
cargo test -p storage-pg _tests::workspace_access_tests::list_accessible_workspaces_returns_only_memberships_for_non_root -- --exact
cargo test -p storage-pg _tests::workspace_access_tests::load_actor_context_ignores_display_role_when_role_is_missing_in_target_workspace -- --exact
```

Expected:

- the tests fail because `TeamRepository` has no accessible-workspace query API yet
- the display-role test fails because `load_actor_context` still trusts the requested display role even if it does not exist in the target workspace

- [ ] **Step 3: implement explicit workspace access queries**

Extend `api/crates/control-plane/src/ports.rs` `TeamRepository` with:

```rust
async fn list_accessible_workspaces(&self, user_id: Uuid) -> anyhow::Result<Vec<TeamRecord>>;

async fn get_accessible_workspace(
    &self,
    user_id: Uuid,
    workspace_id: Uuid,
) -> anyhow::Result<Option<TeamRecord>>;
```

Extend `api/crates/control-plane/src/team.rs` with read-only helpers that wrap those repository methods:

```rust
pub async fn list_accessible_workspaces(&self, user_id: Uuid) -> Result<Vec<TeamRecord>> {}

pub async fn get_accessible_workspace(
    &self,
    user_id: Uuid,
    workspace_id: Uuid,
) -> Result<TeamRecord> {}
```

Update `api/crates/storage-pg/src/team_repository.rs` to:

- use `is_root_user(self.pool(), user_id)` for root bypass
- for non-root users, join `team_memberships` to `teams`
- sort results by `lower(name), created_at, id`
- make `get_accessible_workspace(...)` reuse the same access rule instead of reintroducing “first team” fallback

Use SQL in the shape below:

```sql
select t.id, t.tenant_id, t.name, t.logo_url, t.introduction
from teams t
where exists (
  select 1
  from team_memberships tm
  where tm.team_id = t.id
    and tm.user_id = $1
)
order by lower(t.name), t.created_at asc, t.id asc
```

and branch to a plain `select ... from teams order by ...` when the caller is root.

Update `api/crates/storage-pg/src/auth_repository.rs` `load_actor_context(...)` so display-role selection becomes:

```rust
let effective_display_role = display_role
    .filter(|candidate| codes.iter().any(|code| code == *candidate))
    .map(str::to_string)
    .or_else(|| codes.first().cloned())
    .unwrap_or_else(|| "manager".to_string());
```

Update `api/crates/control-plane/src/_tests/support.rs` so the memory team/auth repository helpers can:

- store multiple accessible workspaces
- distinguish root and non-root callers
- expose the display-role fallback behavior in unit tests

- [ ] **Step 4: rerun focused tests and verify pass**

Run:

```bash
cargo test -p storage-pg _tests::workspace_access_tests::list_accessible_workspaces_returns_only_memberships_for_non_root -- --exact
cargo test -p storage-pg _tests::workspace_access_tests::list_accessible_workspaces_returns_all_workspaces_for_root -- --exact
cargo test -p storage-pg _tests::workspace_access_tests::load_actor_context_ignores_display_role_when_role_is_missing_in_target_workspace -- --exact
```

Expected: all three tests pass.

- [ ] **Step 5: commit the query foundation**

```bash
git add \
  api/crates/control-plane/src/ports.rs \
  api/crates/control-plane/src/team.rs \
  api/crates/control-plane/src/_tests/support.rs \
  api/crates/storage-pg/src/team_repository.rs \
  api/crates/storage-pg/src/auth_repository.rs \
  api/crates/storage-pg/src/_tests/mod.rs \
  api/crates/storage-pg/src/_tests/workspace_access_tests.rs
git commit -m "feat: add accessible workspace queries"
```

## Task 2: Add A Dedicated Workspace Session Switch Service

**Goal:** centralize the session rewrite logic so switching workspace is explicit, validated, auditable, and reusable from routes.

**Files**

- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/ports.rs`
- `api/crates/control-plane/src/workspace_session.rs`
- `api/crates/control-plane/src/_tests/mod.rs`
- `api/crates/control-plane/src/_tests/support.rs`
- `api/crates/control-plane/src/_tests/workspace_session_service_tests.rs`
- `api/crates/storage-redis/src/_tests/session_store_tests.rs`

- [ ] **Step 1: add failing unit tests for workspace switching**

Create `api/crates/control-plane/src/_tests/workspace_session_service_tests.rs` with:

```rust
#[tokio::test]
async fn switch_workspace_rewrites_session_scope_and_rotates_csrf() {}

#[tokio::test]
async fn switch_workspace_rejects_inaccessible_target_for_non_root() {}

#[tokio::test]
async fn switch_workspace_keeps_session_id_and_expiry() {}
```

Assertions:

- `session_id` stays the same after switching
- `tenant_id` and `current_workspace_id` change to the target workspace scope
- `csrf_token` is replaced with a fresh value
- `expires_at_unix` is preserved
- `session.switch_workspace` is written to audit logs
- inaccessible target workspace returns `PermissionDenied("workspace_access_denied")`

Also extend `api/crates/storage-redis/src/_tests/session_store_tests.rs` with:

```rust
#[tokio::test]
async fn put_overwrites_existing_session_payload() {}
```

so the session-store contract explicitly proves we can rewrite an existing session entry in place.

- [ ] **Step 2: run focused failures**

Run:

```bash
cargo test -p control-plane _tests::workspace_session_service_tests::switch_workspace_rewrites_session_scope_and_rotates_csrf -- --exact
cargo test -p storage-redis put_overwrites_existing_session_payload -- --exact
```

Expected:

- the service test fails because no workspace-switch service exists yet
- the storage test either fails or is absent, documenting the overwrite contract before relying on it

- [ ] **Step 3: implement the workspace session service**

Create `api/crates/control-plane/src/workspace_session.rs` with:

```rust
pub struct SwitchWorkspaceCommand {
    pub actor_user_id: Uuid,
    pub session_id: String,
    pub target_workspace_id: Uuid,
}

pub struct SwitchWorkspaceResult {
    pub actor: ActorContext,
    pub session: SessionRecord,
}

pub struct WorkspaceSessionService<R, T, S> {
    auth_repository: R,
    team_repository: T,
    session_store: S,
}
```

`switch_workspace(...)` should:

1. load the current session from `SessionStore`
2. load the current user from `AuthRepository`
3. validate target workspace access through `TeamRepository::get_accessible_workspace(...)`
4. reload actor context for `target_workspace.tenant_id + target_workspace.id`
5. overwrite the existing session with:
   - same `session_id`
   - same `user_id`
   - same `session_version`
   - same `expires_at_unix`
   - new `tenant_id`
   - new `current_workspace_id`
   - new `csrf_token = Uuid::now_v7().to_string()`
6. append audit log:

```rust
audit_log(
    Some(actor_user_id),
    "session",
    None,
    "session.switch_workspace",
    serde_json::json!({
        "from_workspace_id": previous.current_workspace_id,
        "to_workspace_id": next.current_workspace_id
    }),
)
```

Keep same-workspace switching idempotent:

- if `target_workspace_id == current_workspace_id`, return the current scope payload without deleting the session
- do not rotate `session_id`

Update `api/crates/control-plane/src/lib.rs` to export the new module.

Update `api/crates/control-plane/src/_tests/support.rs` with a memory `TeamRepository` implementation that can:

- list multiple accessible workspaces
- simulate root bypass
- return `None` for blocked workspace ids

Update `api/crates/storage-redis/src/_tests/session_store_tests.rs` so repeated `put()` on the same `session_id` proves overwrite semantics.

- [ ] **Step 4: rerun focused tests and verify pass**

Run:

```bash
cargo test -p control-plane _tests::workspace_session_service_tests::switch_workspace_rewrites_session_scope_and_rotates_csrf -- --exact
cargo test -p control-plane _tests::workspace_session_service_tests::switch_workspace_rejects_inaccessible_target_for_non_root -- --exact
cargo test -p control-plane _tests::workspace_session_service_tests::switch_workspace_keeps_session_id_and_expiry -- --exact
cargo test -p storage-redis put_overwrites_existing_session_payload -- --exact
```

Expected: all four tests pass.

- [ ] **Step 5: commit the session-switch service**

```bash
git add \
  api/crates/control-plane/src/lib.rs \
  api/crates/control-plane/src/workspace_session.rs \
  api/crates/control-plane/src/_tests/mod.rs \
  api/crates/control-plane/src/_tests/support.rs \
  api/crates/control-plane/src/_tests/workspace_session_service_tests.rs \
  api/crates/storage-redis/src/_tests/session_store_tests.rs
git commit -m "feat: support workspace session switching"
```

## Task 3: Expose Workspace Switch Routes And OpenAPI

**Goal:** make the workspace switch flow consumable from the console backend contract without changing frontend navigation in this plan.

**Files**

- `api/apps/api-server/src/lib.rs`
- `api/apps/api-server/src/routes/mod.rs`
- `api/apps/api-server/src/routes/session.rs`
- `api/apps/api-server/src/routes/workspaces.rs`
- `api/apps/api-server/src/openapi.rs`
- `api/apps/api-server/src/_tests/support.rs`
- `api/apps/api-server/src/_tests/session_routes.rs`
- `api/apps/api-server/src/_tests/workspace_routes.rs`
- `api/apps/api-server/src/_tests/openapi_alignment.rs`

- [ ] **Step 1: add failing route and OpenAPI tests**

Create `api/apps/api-server/src/_tests/workspace_routes.rs` with:

```rust
#[tokio::test]
async fn workspaces_route_lists_accessible_workspaces_with_current_marker() {}

#[tokio::test]
async fn switch_workspace_route_updates_current_workspace_and_returns_new_csrf() {}
```

Extend `api/apps/api-server/src/_tests/session_routes.rs` with:

```rust
#[tokio::test]
async fn switch_workspace_route_requires_csrf() {}
```

Extend `api/apps/api-server/src/_tests/openapi_alignment.rs` so it asserts:

- `/api/console/workspaces` exists
- `/api/console/session/actions/switch-workspace` exists
- schemas include `WorkspaceSummaryResponse` and `SwitchWorkspaceBody`

Use `test_app_with_database_url()` in route tests so you can seed:

- a second workspace row
- a membership row for the root test user when needed
- a member user with no access to the target workspace for the rejection case

- [ ] **Step 2: run focused failures**

Run:

```bash
cargo test -p api-server _tests::workspace_routes::workspaces_route_lists_accessible_workspaces_with_current_marker -- --exact
cargo test -p api-server _tests::workspace_routes::switch_workspace_route_updates_current_workspace_and_returns_new_csrf -- --exact
cargo test -p api-server openapi_contains_workspace_switch_routes -- --exact
```

Expected:

- list route test fails because `/api/console/workspaces` does not exist yet
- switch route test fails because `/api/console/session/actions/switch-workspace` does not exist yet
- OpenAPI test fails because the new paths and schemas are not registered

- [ ] **Step 3: implement backend routes**

Create `api/apps/api-server/src/routes/workspaces.rs` with:

```rust
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkspaceSummaryResponse {
    pub id: String,
    pub name: String,
    pub logo_url: Option<String>,
    pub introduction: String,
    pub is_current: bool,
}
```

Expose:

```rust
GET /api/console/workspaces
```

Behavior:

- require authenticated session
- call `TeamService::list_accessible_workspaces(context.user.id)`
- map the current workspace to `is_current = true`
- return current workspace first, then the remaining workspaces in stable name order

Update `api/apps/api-server/src/routes/session.rs` with:

```rust
#[derive(Debug, Deserialize, ToSchema)]
pub struct SwitchWorkspaceBody {
    pub workspace_id: String,
}
```

Expose:

```rust
POST /api/console/session/actions/switch-workspace
```

Behavior:

- require session and `x-csrf-token`
- call `WorkspaceSessionService::switch_workspace(...)`
- reuse the existing `SessionResponse` shape:

```rust
SessionResponse {
    actor: ...,
    session: ...,
    csrf_token: ...,
}
```

Update `api/apps/api-server/src/lib.rs` and `routes/mod.rs` to mount the new router.

Update `api/apps/api-server/src/openapi.rs` to register:

- `crate::routes::workspaces::list_workspaces`
- `crate::routes::session::switch_workspace`
- `crate::routes::workspaces::WorkspaceSummaryResponse`
- `crate::routes::session::SwitchWorkspaceBody`

Update `api/apps/api-server/src/_tests/support.rs` only if needed for reusable seeding helpers; keep helpers focused instead of stuffing raw SQL into many test files.

- [ ] **Step 4: rerun focused tests and verify pass**

Run:

```bash
cargo test -p api-server _tests::workspace_routes::workspaces_route_lists_accessible_workspaces_with_current_marker -- --exact
cargo test -p api-server _tests::workspace_routes::switch_workspace_route_updates_current_workspace_and_returns_new_csrf -- --exact
cargo test -p api-server _tests::session_routes::switch_workspace_route_requires_csrf -- --exact
cargo test -p api-server openapi_contains_workspace_switch_routes -- --exact
```

Expected:

- all route tests pass
- the switch response returns a different `csrf_token`
- the response actor/session both report the new `current_workspace_id`
- the forbidden-path test returns `403` for inaccessible targets

- [ ] **Step 5: commit the HTTP contract**

```bash
git add \
  api/apps/api-server/src/lib.rs \
  api/apps/api-server/src/routes/mod.rs \
  api/apps/api-server/src/routes/session.rs \
  api/apps/api-server/src/routes/workspaces.rs \
  api/apps/api-server/src/openapi.rs \
  api/apps/api-server/src/_tests/support.rs \
  api/apps/api-server/src/_tests/session_routes.rs \
  api/apps/api-server/src/_tests/workspace_routes.rs \
  api/apps/api-server/src/_tests/openapi_alignment.rs
git commit -m "feat: expose workspace switch backend routes"
```

## Task 4: Run Full Backend Verification And Sync Governance Docs

**Goal:** close the loop with the standard backend gate and update the governance spec once workspace switching is no longer “out of scope”.

**Files**

- `docs/superpowers/specs/1flowse/2026-04-13-backend-governance-phase-two-design.md`
- `docs/superpowers/plans/2026-04-14-backend-workspace-switch.md`

- [ ] **Step 1: update the governance spec after implementation lands**

After Task 1 to Task 3 are complete, update:

- `docs/superpowers/specs/1flowse/2026-04-13-backend-governance-phase-two-design.md`

so Section `9` no longer lists backend workspace switching as “still not in this round”. Replace it with a short landed-status note and point future work toward:

- tenant management routes/UI
- naming cleanup from `TeamRecord` to explicit workspace naming
- runtime metadata operator repair workflow

- [ ] **Step 2: run focused cargo verification serially**

Run in order:

```bash
cargo test -p storage-pg _tests::workspace_access_tests::list_accessible_workspaces_returns_only_memberships_for_non_root -- --exact
cargo test -p control-plane _tests::workspace_session_service_tests::switch_workspace_rewrites_session_scope_and_rotates_csrf -- --exact
cargo test -p api-server _tests::workspace_routes::switch_workspace_route_updates_current_workspace_and_returns_new_csrf -- --exact
```

Expected: all three commands pass.

- [ ] **Step 3: run the full backend gate**

Run:

```bash
node scripts/node/verify-backend.js
```

Expected:

- exit code `0`
- no `cargo` lock contention
- no `rustfmt` diff failure
- no route/OpenAPI regression

- [ ] **Step 4: commit final verification and doc sync**

```bash
git add \
  docs/superpowers/specs/1flowse/2026-04-13-backend-governance-phase-two-design.md \
  docs/superpowers/plans/2026-04-14-backend-workspace-switch.md
git commit -m "docs: close backend workspace switch follow-up"
```

## Self-Review

- Spec coverage:
  - session must hold explicit `current_workspace_id`: covered by Task 2 and Task 3
  - users can hold multiple workspaces but request chain stays in one explicit workspace: covered by accessible-workspace listing plus session rewrite
  - root/system stays separate from business workspace while still able to manage multi-workspace context: covered by root bypass in Task 1
  - frontend selector remains out of scope: explicitly excluded in scope notes
- Placeholder scan:
  - no placeholder markers remain in the plan body
  - every task names concrete files and commands
- Type consistency:
  - keep `TeamRecord` as compatibility naming in repository/service layers
  - external HTTP naming uses `workspace` consistently
