# Data Source Data Model Plan C Permission API Exposure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add API Key access, scope grants, action permissions, exposure readiness, and audit gates for Data Model runtime CRUD.

**Architecture:** API exposure is a computed safety state layered above Data Model status. Runtime calls from sessions and API Keys both enter the same runtime CRUD engine after actor, grant, permission, scope filter, and audit checks.

**Tech Stack:** Rust, Axum middleware/extractors, access-control, control-plane auth, audit logs, runtime-core ACL.

---

## File Structure

**Modify**
- `api/crates/domain/src/auth.rs`: API Key actor representation if missing.
- `api/crates/domain/src/modeling.rs`: exposure readiness proof types.
- `api/crates/control-plane/src/auth.rs`: API Key lifecycle service if not already present.
- `api/crates/control-plane/src/model_definition.rs`: scope grants and exposure readiness.
- `api/crates/runtime-core/src/runtime_acl.rs`: owner/scope/system permission levels.
- `api/apps/api-server/src/middleware/*`: API Key actor extraction.
- `api/apps/api-server/src/routes/plugins_and_models/runtime_models.rs`: unified actor checks.
- `api/apps/api-server/src/routes/plugins_and_models/model_definitions.rs`: grant and exposure routes.
- `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`: API Key runtime tests.

### Task 1: Scope Grant And Permission Profiles

**Files:**
- Modify: `api/crates/control-plane/src/model_definition.rs`
- Modify: `api/crates/runtime-core/src/runtime_acl.rs`
- Test: `api/crates/control-plane/src/_tests/model_definition_acl_tests.rs`
- Test: `api/crates/runtime-core/src/_tests/runtime_acl_tests.rs`

- [x] **Step 1: Write failing tests**

Cover:

```text
system creates grant for DEFAULT_SCOPE_ID
scope without grant cannot call runtime CRUD
owner permission only returns actor-owned records
scope_all returns all records inside scope_id
system_all returns all granted data for system actor only
```

- [x] **Step 2: Implement permission profile parsing**

Use explicit profile values:

```text
owner
scope_all
system_all
```

Reject unknown values at service boundary.

- [x] **Step 3: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_acl_tests
cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_acl_tests
```

Task 1 validation record, 2026-04-30:

- RED confirmed:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_acl_tests` failed because `CreateScopeDataModelGrantCommand` and `create_scope_grant` were missing.
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_acl_tests` failed because `RuntimeScopeGrant`, `scope_grant` input fields, and `RuntimeEngine::for_tests_with_models` were missing.
- GREEN confirmed:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_acl_tests`
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_acl_tests`
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_engine_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres runtime_record_repository_tests --no-run`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
- Scope constant note: current domain exposes `SYSTEM_SCOPE_ID` and no separate `DEFAULT_SCOPE_ID`; Task 1 used `SYSTEM_SCOPE_ID` as the single-machine default scope constant and did not introduce workspace/team/app aliases.

Task 1 quality fix validation record, 2026-04-30:

- RED confirmed:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests::create_workspace_model_creates_system_model_and_workspace_grant` failed because console-style workspace creation still persisted a workspace-scoped Data Model instead of a system Data Model plus workspace grant.
  - `cargo test --manifest-path api/Cargo.toml -p control-plane file_management_bootstrap_tests` failed because file table provisioning still created a workspace-scoped Data Model for workspace file tables and builtin attachments provisioning had no persisted grant.
- GREEN confirmed:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_acl_tests`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane file_management_bootstrap_tests`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane file_management_upload_tests`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes`
  - `cargo test --manifest-path api/Cargo.toml -p api-server file_management_routes`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Quality fix note: console model creation and file table provisioning now create system Data Models and persisted `scope_all` grants for the requested system/workspace scope. Route happy paths no longer use direct SQL grant inserts; direct SQL is only used to revoke grants for missing-grant assertions.

### Task 2: API Key Actor And Runtime Access

**Files:**
- Modify: `api/crates/domain/src/auth.rs`
- Modify: `api/crates/control-plane/src/auth.rs`
- Modify: `api/apps/api-server/src/routes/plugins_and_models/runtime_models.rs`
- Test: `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`

- [x] **Step 1: Write failing route tests**

Cover:

```text
API Key can list granted Data Model records
API Key cannot call ungranted Data Model
API Key cannot call disabled action
API Key cannot bypass owner scope
session actor behavior remains unchanged
```

- [x] **Step 2: Implement API Key extraction**

Support:

```http
Authorization: Bearer <api_key>
```

Convert it into the same actor context shape runtime CRUD already consumes.

- [x] **Step 3: Run api-server tests**

```bash
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes auth_routes
```

Task 2 validation record, 2026-04-30:

- RED confirmed:
  - `cargo test --manifest-path api/Cargo.toml -p api-server auth_routes` failed because `/api/console/api-keys` did not exist; new console API Key tests received `404` instead of `201/401/403`.
  - `cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes_api_key` failed because API Key creation route was missing; runtime API Key tests received `404` at key creation.
  - `cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes_api_key_uses_system_scope_grant` failed with `403` before adding scope-kind aware grant loading for system-scoped API Keys.
- GREEN confirmed:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p api-server auth_routes`
  - `cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane auth`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: Task 2 implements API Key lifecycle storage, hashed token persistence, console creation route, Bearer runtime auth, action permissions, persisted scope grant enforcement, owner filtering, and system/workspace scope grant lookup. Exposure readiness proof and full audit calculation remain for Task 3.

Task 2 spec review concern fix, 2026-04-30:

- OpenAPI concern fixed: `/api/console/api-keys` create route is now registered in `api-server` OpenAPI paths, with API Key create request/response and permission DTO schemas registered in components.
- Regression coverage: `openapi_alignment` now asserts the API Key path and DTO schemas are present.

### Task 3: Exposure Readiness Calculation

**Files:**
- Modify: `api/crates/control-plane/src/model_definition.rs`
- Modify: `api/apps/api-server/src/routes/plugins_and_models/model_definitions.rs`
- Test: `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`
- Test: `api/apps/api-server/src/_tests/application/model_definition_routes.rs`

- [ ] **Step 1: Write failing tests**

Cover:

```text
published without API Key or external grant => published_not_exposed
API entry opened but no action permission => api_exposed_no_permission
API Key + action permission + scope grant + scope filter + audit => api_exposed_ready
draft model exposure stays draft
disabled/broken model effective exposure is unavailable
```

- [ ] **Step 2: Implement readiness proof**

Compute readiness from persisted facts. Do not accept `api_exposed_ready` from raw user input.

- [ ] **Step 3: Add audit events**

Emit audit for:

```text
scope grant create/update/delete
API exposure state transition
API Key runtime access denied
API Key runtime write success/failure
```

- [ ] **Step 4: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes runtime_model_routes
```

### Task 4: Plan C Verification And Commit

- [ ] **Step 1: Format**

```bash
cargo fmt --manifest-path api/Cargo.toml
```

- [ ] **Step 2: Targeted regression**

```bash
cargo test --manifest-path api/Cargo.toml -p access-control
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_acl_tests model_definition_service_tests
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes model_definition_routes auth_routes
```

- [ ] **Step 3: Commit**

```bash
git add api/crates/domain api/crates/access-control api/crates/control-plane api/crates/runtime-core api/apps/api-server
git commit -m "feat: enforce data model api exposure permissions"
```
