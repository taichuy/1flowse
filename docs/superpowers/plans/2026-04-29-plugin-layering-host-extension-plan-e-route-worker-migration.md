# Plugin Layering Host Extension Plan E Route Worker Migration Namespace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled HostExtension route registration, worker registration, and extension-owned PostgreSQL migration namespace.

**Architecture:** Extend HostExtension contributions with structured route, worker, and migration declarations. API-server owns host route mounting and worker lifecycle; storage-durable/postgres owns extension migration tracking with namespace checks. HostExtension code cannot mutate routers, spawn unmanaged workers, or write Core migration chains directly.

**Tech Stack:** Rust, Axum route registry, control-plane/plugin-framework manifest validation, storage-durable PostgreSQL migration runner, targeted tests.

---

## File Structure

**Create**
- `api/apps/api-server/src/host_route_registry.rs`
- `api/apps/api-server/src/host_worker_registry.rs`
- `api/apps/api-server/src/_tests/host_route_registry_tests.rs`
- `api/apps/api-server/src/_tests/host_worker_registry_tests.rs`
- `api/crates/storage-durable/postgres/src/host_extension_migration_repository.rs`
- `api/crates/storage-durable/postgres/src/_tests/host_extension_migration_tests.rs`

**Modify**
- `api/crates/plugin-framework/src/host_extension_contribution.rs`
- `api/crates/plugin-framework/src/_tests/host_extension_contribution_tests.rs`
- `api/apps/api-server/src/lib.rs`
- `api/apps/api-server/src/_tests/mod.rs`
- `api/crates/storage-durable/postgres/src/lib.rs`
- `api/crates/storage-durable/postgres/src/migrations/*`: add a new migration for `host_extension_migrations`.

### Task 1: Structure Route And Worker Contribution Declarations

**Files:**
- Modify: `api/crates/plugin-framework/src/host_extension_contribution.rs`
- Modify: `api/crates/plugin-framework/src/_tests/host_extension_contribution_tests.rs`

- [ ] **Step 1: Write RED manifest tests**

Add tests parsing:

```yaml
routes:
  - route_id: file-security.scan-report
    method: GET
    path: /api/system/file-security/files/{file_id}/scan-report
    action:
      resource: file_scan_reports
      action: get
workers:
  - worker_id: file-security.scan-worker
    queue: file-security.scan
    handler: scan_file
migrations:
  - id: 0001_create_file_security_tables
    path: migrations/postgres/0001_create_file_security_tables.sql
```

Add rejection tests:

```text
route path not starting with /api/system/ or /api/callbacks/ is rejected
worker_id without extension-owned prefix is rejected
migration path outside migrations/postgres/ is rejected
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_contribution -- --nocapture
```

Expected: FAIL until structured declarations exist.

- [ ] **Step 3: Implement declarations**

Add structs:

```rust
pub struct HostExtensionRouteManifest {
    pub route_id: String,
    pub method: String,
    pub path: String,
    pub action: HostExtensionRouteActionManifest,
}

pub struct HostExtensionWorkerManifest {
    pub worker_id: String,
    pub queue: String,
    pub handler: String,
}

pub struct HostExtensionMigrationManifest {
    pub id: String,
    pub path: String,
}
```

Validation:

```text
route path starts with /api/system/ or /api/callbacks/
method is GET, POST, PUT, PATCH, or DELETE
route action resource/action are non-empty
worker_id and queue are non-empty
migration id is non-empty
migration path starts with migrations/postgres/ and ends with .sql
```

- [ ] **Step 4: Re-run manifest tests**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_contribution -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Commit contribution declarations**

```bash
git add api/crates/plugin-framework/src/host_extension_contribution.rs api/crates/plugin-framework/src/_tests/host_extension_contribution_tests.rs
git commit -m "feat: declare host extension routes workers and migrations"
```

### Task 2: Add Host Route Registry

**Files:**
- Create: `api/apps/api-server/src/host_route_registry.rs`
- Create: `api/apps/api-server/src/_tests/host_route_registry_tests.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`

- [ ] **Step 1: Write RED route registry tests**

Add tests:

```rust
#[test]
fn registry_rejects_duplicate_route_id() {
    let mut registry = HostRouteRegistry::default();
    registry.register(test_route("file-security.scan-report")).unwrap();
    let err = registry.register(test_route("file-security.scan-report")).unwrap_err();
    assert!(err.to_string().contains("duplicate route"));
}

#[test]
fn registry_rejects_uncontrolled_path() {
    let mut registry = HostRouteRegistry::default();
    let err = registry.register(test_route_with_path("/raw")).unwrap_err();
    assert!(err.to_string().contains("controlled route"));
}
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p api-server host_route_registry -- --nocapture
```

Expected: FAIL because route registry does not exist.

- [ ] **Step 3: Implement registry**

Create:

```rust
pub struct HostRouteDefinition {
    pub extension_id: String,
    pub route_id: String,
    pub method: String,
    pub path: String,
    pub resource_code: String,
    pub action_code: String,
}
```

Registry must validate:

```text
unique route_id
unique method + path
path starts with /api/system/ or /api/callbacks/
resource/action target is non-empty
```

Do not mount actual Axum handlers that bypass Resource Action Kernel.

- [ ] **Step 4: Re-run route registry tests**

Run:

```bash
cd api
cargo test -p api-server host_route_registry -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Commit route registry**

```bash
git add api/apps/api-server/src/host_route_registry.rs api/apps/api-server/src/_tests/host_route_registry_tests.rs api/apps/api-server/src/lib.rs api/apps/api-server/src/_tests/mod.rs
git commit -m "feat: add controlled host route registry"
```

### Task 3: Add Host Worker Registry

**Files:**
- Create: `api/apps/api-server/src/host_worker_registry.rs`
- Create: `api/apps/api-server/src/_tests/host_worker_registry_tests.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`

- [ ] **Step 1: Write RED worker registry tests**

Add tests proving:

```text
duplicate worker_id rejected
worker queue required
worker definitions are frozen before startup completes
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p api-server host_worker_registry -- --nocapture
```

Expected: FAIL because worker registry does not exist.

- [ ] **Step 3: Implement registry**

Create:

```rust
pub struct HostWorkerDefinition {
    pub extension_id: String,
    pub worker_id: String,
    pub queue: String,
    pub handler: String,
}
```

Implement:

```text
register()
freeze()
workers()
```

After `freeze()`, `register()` must return an error.

- [ ] **Step 4: Re-run tests**

Run:

```bash
cd api
cargo test -p api-server host_worker_registry -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Commit worker registry**

```bash
git add api/apps/api-server/src/host_worker_registry.rs api/apps/api-server/src/_tests/host_worker_registry_tests.rs api/apps/api-server/src/lib.rs api/apps/api-server/src/_tests/mod.rs
git commit -m "feat: add host worker registry"
```

### Task 4: Add Extension Migration Tracking

**Files:**
- Create: `api/crates/storage-durable/postgres/src/host_extension_migration_repository.rs`
- Create: `api/crates/storage-durable/postgres/src/_tests/host_extension_migration_tests.rs`
- Modify: `api/crates/storage-durable/postgres/src/lib.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/mod.rs`
- Create: new SQL migration under `api/crates/storage-durable/postgres/migrations/`

- [ ] **Step 1: Write RED repository tests**

Test:

```text
records applied extension migration with checksum
rejects table names not starting ext_<normalized_extension_id>__
does not apply the same migration twice
checksum mismatch returns error
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p storage-postgres host_extension_migration -- --nocapture
```

Expected: FAIL because table and repository do not exist.

- [ ] **Step 3: Add migration table**

Create SQL migration:

```sql
CREATE TABLE IF NOT EXISTS host_extension_migrations (
    id UUID PRIMARY KEY,
    extension_id TEXT NOT NULL,
    plugin_version TEXT NOT NULL,
    migration_id TEXT NOT NULL,
    checksum TEXT NOT NULL,
    package_fingerprint TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (extension_id, migration_id)
);
```

- [ ] **Step 4: Implement repository**

Implement functions:

```rust
record_applied_extension_migration(input)
get_applied_extension_migration(extension_id, migration_id)
ensure_extension_table_name(extension_id, table_name)
```

Normalize extension id by replacing non `[a-z0-9_]` with `_`.

- [ ] **Step 5: Re-run migration tests**

Run with an isolated database schema as required by `api/AGENTS.md`:

```bash
cd api
cargo test -p storage-postgres host_extension_migration -- --nocapture
```

Expected: PASS.

- [ ] **Step 6: Commit migration namespace**

```bash
git add api/crates/storage-durable/postgres/src api/crates/storage-durable/postgres/migrations
git commit -m "feat: track host extension migrations"
```

### Task 5: Plan E Verification

**Files:**
- Verify only.

- [ ] **Step 1: Format**

Run:

```bash
cd api
cargo fmt
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_contribution -- --nocapture
cargo test -p api-server host_route_registry -- --nocapture
cargo test -p api-server host_worker_registry -- --nocapture
cargo test -p storage-postgres host_extension_migration -- --nocapture
```

Expected: PASS.

- [ ] **Step 3: Commit formatting if needed**

```bash
git add api
git commit -m "style: format host extension route worker migration"
```

Run this commit only if formatting changed files.
