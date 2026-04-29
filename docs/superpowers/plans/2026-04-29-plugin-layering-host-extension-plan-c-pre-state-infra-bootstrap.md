# Plugin Layering Host Extension Plan C Pre State Infra Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Core Redis env selection with a pre-state `HostInfrastructureRegistry` and default `local-infra-host` provider.

**Architecture:** Add infrastructure contract traits and a registry before `ApiState` construction. Wire session store and local ephemeral services through the registry, remove `EphemeralBackendKind` from API config, and keep Redis as a future HostExtension provider rather than a Core branch.

**Tech Stack:** Rust, api-server startup config, storage-ephemeral memory implementations, control-plane ports, targeted Cargo tests.

---

## File Structure

**Create**
- `api/apps/api-server/src/host_infrastructure/mod.rs`: registry composition for api-server startup.
- `api/apps/api-server/src/host_infrastructure/local.rs`: `local-infra-host` provider factory.
- `api/apps/api-server/src/host_infrastructure/contracts.rs`: facade traits used by `ApiState`.
- `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`: registry tests.

**Modify**
- `api/apps/api-server/src/app_state.rs`: replace `SessionStoreHandle` enum with registry-provided handles.
- `api/apps/api-server/src/config.rs`: remove `ephemeral_backend` and `ephemeral_redis_url`.
- `api/apps/api-server/src/lib.rs`: bootstrap infrastructure before `ApiState`.
- `api/apps/api-server/src/_tests/config_tests.rs`: remove Redis env expectations.
- `api/apps/api-server/src/_tests/mod.rs`: include host infrastructure tests.
- `api/crates/storage-ephemeral/src/lib.rs`: keep memory exports; stop exporting Redis as Core startup target.
- `api/crates/storage-ephemeral/src/backend.rs`: remove Redis backend kind if no non-config tests still require it.
- `api/crates/storage-ephemeral/src/_tests/kv_store_contract_tests.rs`: update backend kind expectations.

### Task 1: Add Infrastructure Registry Tests

**Files:**
- Create: `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`

- [ ] **Step 1: Write RED tests**

Add tests proving:

```rust
#[test]
fn local_infra_host_provides_required_defaults() {
    let registry = crate::host_infrastructure::build_local_host_infrastructure();

    assert_eq!(registry.default_provider("storage-ephemeral").unwrap(), "local");
    assert_eq!(registry.default_provider("cache-store").unwrap(), "local");
    assert_eq!(registry.default_provider("event-bus").unwrap(), "local");
    assert!(registry.session_store().is_some());
}

#[test]
fn duplicate_default_provider_is_rejected() {
    let mut registry = crate::host_infrastructure::HostInfrastructureRegistry::default();
    registry.register_default_provider("storage-ephemeral", "local", "local-infra-host").unwrap();
    let err = registry
        .register_default_provider("storage-ephemeral", "redis", "redis-infra-host")
        .unwrap_err();

    assert!(err.to_string().contains("default provider"));
}
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p api-server host_infrastructure -- --nocapture
```

Expected: FAIL because `host_infrastructure` does not exist.

### Task 2: Implement Local Infrastructure Registry

**Files:**
- Create: `api/apps/api-server/src/host_infrastructure/mod.rs`
- Create: `api/apps/api-server/src/host_infrastructure/local.rs`
- Create: `api/apps/api-server/src/host_infrastructure/contracts.rs`
- Modify: `api/apps/api-server/src/lib.rs`

- [ ] **Step 1: Add contract facades**

Define narrow facades:

```rust
pub trait CacheStore: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait DistributedLock: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait EventBus: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait TaskQueue: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait RateLimitStore: Send + Sync {
    fn provider_code(&self) -> &'static str;
}
```

Use no-op or in-memory local structs for contracts not yet consumed by code.

- [ ] **Step 2: Add registry**

Implement:

```rust
pub struct HostInfrastructureRegistry {
    providers: BTreeMap<String, RegisteredInfrastructureProvider>,
    session_store: Arc<dyn SessionStore>,
    cache_store: Arc<dyn CacheStore>,
    distributed_lock: Arc<dyn DistributedLock>,
    event_bus: Arc<dyn EventBus>,
    task_queue: Arc<dyn TaskQueue>,
    rate_limit_store: Arc<dyn RateLimitStore>,
}
```

Expose:

```rust
default_provider(contract: &str) -> Option<&str>
session_store() -> Arc<dyn SessionStore>
cache_store() -> Arc<dyn CacheStore>
distributed_lock() -> Arc<dyn DistributedLock>
event_bus() -> Arc<dyn EventBus>
task_queue() -> Arc<dyn TaskQueue>
rate_limit_store() -> Arc<dyn RateLimitStore>
```

- [ ] **Step 3: Add local-infra-host factory**

Create `build_local_host_infrastructure()` returning defaults:

```text
storage-ephemeral = local
cache-store = local
distributed-lock = local
event-bus = local
task-queue = local
rate-limit-store = local
```

Use `MemorySessionStore::new(SESSION_STORE_NAMESPACE)` for session storage.

- [ ] **Step 4: Re-run registry tests**

Run:

```bash
cd api
cargo test -p api-server host_infrastructure -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Commit registry**

```bash
git add api/apps/api-server/src/host_infrastructure api/apps/api-server/src/_tests/host_infrastructure_tests.rs api/apps/api-server/src/_tests/mod.rs api/apps/api-server/src/lib.rs
git commit -m "feat: add local host infrastructure registry"
```

### Task 3: Rewire ApiState And Startup Config

**Files:**
- Modify: `api/apps/api-server/src/app_state.rs`
- Modify: `api/apps/api-server/src/config.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/_tests/config_tests.rs`

- [ ] **Step 1: Write RED config tests**

Update config tests so:

```text
API_EPHEMERAL_BACKEND is ignored or rejected as unknown according to current config parser behavior
API_EPHEMERAL_REDIS_URL is not required
ApiConfig contains no ephemeral_backend field
```

If the config parser does not reject unknown env keys, verify that `ApiConfig::from_env_map` never reads those keys.

- [ ] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p api-server config_tests -- --nocapture
```

Expected: FAIL while code still requires or reads ephemeral backend fields.

- [ ] **Step 3: Rewire state construction**

Change startup from:

```text
match config.ephemeral_backend { Memory => ..., Redis => ... }
```

to:

```text
let infrastructure = build_local_host_infrastructure();
let session_store = infrastructure.session_store();
```

Store infrastructure on `ApiState` as:

```rust
pub infrastructure: Arc<HostInfrastructureRegistry>
```

Keep `session_store` as a direct field only if existing middleware needs it; source it from the registry.

- [ ] **Step 4: Re-run api-server config and health tests**

Run:

```bash
cd api
cargo test -p api-server config_tests -- --nocapture
cargo test -p api-server health_routes -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Commit startup rewire**

```bash
git add api/apps/api-server/src/app_state.rs api/apps/api-server/src/config.rs api/apps/api-server/src/lib.rs api/apps/api-server/src/_tests/config_tests.rs
git commit -m "feat: bootstrap api state from host infrastructure"
```

### Task 4: Remove Core Redis Startup Target

**Files:**
- Modify: `api/crates/storage-ephemeral/src/lib.rs`
- Modify: `api/crates/storage-ephemeral/src/backend.rs`
- Modify: `api/crates/storage-ephemeral/src/_tests/kv_store_contract_tests.rs`
- Modify: `api/apps/api-server/Cargo.toml`
- Modify: `api/Cargo.toml` if Redis workspace dependency is now unused.

- [ ] **Step 1: Update storage-ephemeral tests**

Change backend-kind tests to expect only `memory` or remove backend-kind tests if the enum no longer exists.

Add a test asserting memory remains exported:

```rust
#[test]
fn memory_store_type_remains_public() {
    let _ = storage_ephemeral::MemorySessionStore::new("test");
}
```

- [ ] **Step 2: Remove Redis startup exports**

Stop exporting `RedisBackedSessionStore` from `storage-ephemeral` public API used by api-server startup. Keep Redis module only if another test or package still owns it as implementation detail; otherwise delete the module and dependency in this plan.

- [ ] **Step 3: Run targeted tests**

Run:

```bash
cd api
cargo test -p storage-ephemeral -- --nocapture
cargo test -p api-server config_tests -- --nocapture
```

Expected: PASS.

- [ ] **Step 4: Commit Redis startup removal**

```bash
git add api/crates/storage-ephemeral api/apps/api-server/Cargo.toml api/Cargo.toml
git commit -m "refactor: remove core redis ephemeral startup path"
```

### Task 5: Plan C Verification

**Files:**
- Verify only.

- [ ] **Step 1: Format**

Run:

```bash
cd api
cargo fmt
```

Expected: no formatting diff remains.

- [ ] **Step 2: Run focused tests**

Run:

```bash
cd api
cargo test -p storage-ephemeral -- --nocapture
cargo test -p api-server host_infrastructure -- --nocapture
cargo test -p api-server config_tests -- --nocapture
cargo test -p api-server health_routes -- --nocapture
```

Expected: PASS.

- [ ] **Step 3: Commit formatting if needed**

```bash
git add api
git commit -m "style: format host infrastructure bootstrap"
```

Run this commit only if `git status --short` reports formatting changes.
