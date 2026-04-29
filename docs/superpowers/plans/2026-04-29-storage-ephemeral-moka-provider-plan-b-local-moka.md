# Storage Ephemeral Moka Provider Plan B Local Moka Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the default local host infrastructure provider with `moka` for cache/session/rate-limit and memory implementations for lock/event/task contracts.

**Architecture:** Keep `storage-ephemeral` as the local implementation crate. Moka remains under `storage-ephemeral/src/local`, and api-server only registers control-plane trait objects through `HostInfrastructureRegistry`. Local `MemoryTaskQueue` implements the `TaskQueue` at-least-once shape for disposable or rebuildable work only; durable business jobs stay on PostgreSQL outbox / job tables.

**Tech Stack:** Rust, moka 0.12.15 `future`, async-trait, tokio, serde_json, time, uuid, storage-ephemeral tests, api-server registry tests.

---

## File Structure

**Create**
- `api/crates/storage-ephemeral/src/local/mod.rs`: local provider module exports.
- `api/crates/storage-ephemeral/src/local/moka_cache_store.rs`: `MokaCacheStore` implementing `CacheStore` and `EphemeralKvStore`.
- `api/crates/storage-ephemeral/src/local/moka_session_store.rs`: `MokaSessionStore` implementing `SessionStore`.
- `api/crates/storage-ephemeral/src/local/moka_rate_limit_store.rs`: `MokaRateLimitStore` implementing `RateLimitStore`.
- `api/crates/storage-ephemeral/src/local/memory_distributed_lock.rs`: `DistributedLock` adapter over `MemoryLeaseStore`.
- `api/crates/storage-ephemeral/src/local/memory_event_bus.rs`: topic-aware JSON event bus.
- `api/crates/storage-ephemeral/src/local/memory_task_queue.rs`: non-durable at-least-once local task queue for disposable work.
- `api/crates/storage-ephemeral/src/_tests/moka_cache_store_tests.rs`: Moka cache behavior tests.
- `api/crates/storage-ephemeral/src/_tests/moka_session_store_tests.rs`: session behavior tests.
- `api/crates/storage-ephemeral/src/_tests/moka_rate_limit_store_tests.rs`: rate-limit behavior tests.
- `api/crates/storage-ephemeral/src/_tests/local_infrastructure_tests.rs`: lock/event/task behavior tests.

**Modify**
- `api/Cargo.toml`: add workspace dependency `moka = { version = "0.12.15", features = ["future"] }`.
- `api/crates/storage-ephemeral/Cargo.toml`: depend on workspace `moka`.
- `api/crates/storage-ephemeral/src/lib.rs`: export local provider types.
- `api/crates/storage-ephemeral/src/_tests/mod.rs`: include new tests.
- `api/apps/api-server/src/host_infrastructure/local.rs`: register storage-ephemeral local provider implementations instead of temporary api-server structs.
- `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`: assert local providers perform real operations.

### Task 1: Add Moka Cache Tests

**Files:**
- Create: `api/crates/storage-ephemeral/src/_tests/moka_cache_store_tests.rs`
- Modify: `api/crates/storage-ephemeral/src/_tests/mod.rs`

 **Step 1: Write RED tests**

Add:

```rust
use control_plane::ports::CacheStore;
use serde_json::json;
use storage_ephemeral::{EphemeralKvStore, MokaCacheStore};
use time::Duration;

#[tokio::test]
async fn moka_cache_store_reads_writes_and_expires_json() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    CacheStore::set_json(
        &store,
        "catalog:1",
        json!({ "items": 1 }),
        Some(Duration::milliseconds(30)),
    )
    .await
    .unwrap();
    assert_eq!(
        CacheStore::get_json(&store, "catalog:1").await.unwrap(),
        Some(json!({ "items": 1 }))
    );

    tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    assert_eq!(CacheStore::get_json(&store, "catalog:1").await.unwrap(), None);
}

#[tokio::test]
async fn moka_cache_store_does_not_make_non_positive_ttl_immortal() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    CacheStore::set_json(
        &store,
        "expired",
        json!({ "value": true }),
        Some(Duration::seconds(-1)),
    )
    .await
    .unwrap();

    assert_eq!(CacheStore::get_json(&store, "expired").await.unwrap(), None);
}

#[tokio::test]
async fn moka_cache_store_extends_ttl_with_touch() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    CacheStore::set_json(
        &store,
        "manifest:1",
        json!({ "parsed": true }),
        Some(Duration::milliseconds(40)),
    )
    .await
    .unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;

    assert!(CacheStore::touch(&store, "manifest:1", Duration::milliseconds(120))
        .await
        .unwrap());
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    assert_eq!(
        CacheStore::get_json(&store, "manifest:1").await.unwrap(),
        Some(json!({ "parsed": true }))
    );
}

#[tokio::test]
async fn moka_cache_store_supports_ephemeral_set_if_absent() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    assert!(EphemeralKvStore::set_if_absent_json(&store, "lease", json!({ "owner": "a" }), None)
        .await
        .unwrap());
    assert!(!EphemeralKvStore::set_if_absent_json(&store, "lease", json!({ "owner": "b" }), None)
        .await
        .unwrap());
}
```

Add `mod moka_cache_store_tests;` to `_tests/mod.rs`.

 **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p storage-ephemeral moka_cache_store -- --nocapture
```

Expected: FAIL because `MokaCacheStore` and the `moka` dependency do not exist.

### Task 2: Implement MokaCacheStore

**Files:**
- Modify: `api/Cargo.toml`
- Modify: `api/crates/storage-ephemeral/Cargo.toml`
- Create: `api/crates/storage-ephemeral/src/local/mod.rs`
- Create: `api/crates/storage-ephemeral/src/local/moka_cache_store.rs`
- Modify: `api/crates/storage-ephemeral/src/lib.rs`

 **Step 1: Add dependency**

In `api/Cargo.toml` under `[workspace.dependencies]` add:

```toml
moka = { version = "0.12.15", features = ["future"] }
```

In `api/crates/storage-ephemeral/Cargo.toml` add:

```toml
moka.workspace = true
```

 **Step 2: Implement cache store**

Create `api/crates/storage-ephemeral/src/local/moka_cache_store.rs` with these required details:

```rust
use std::{
    sync::Arc,
    time::{Duration as StdDuration, Instant},
};

use async_trait::async_trait;
use control_plane::ports::CacheStore;
use moka::{future::Cache, Expiry};
use tokio::sync::Mutex;

use crate::EphemeralKvStore;

#[derive(Clone)]
struct CacheEntry {
    value: serde_json::Value,
    ttl: Option<StdDuration>,
}

struct CacheEntryExpiry;

impl Expiry<String, CacheEntry> for CacheEntryExpiry {
    fn expire_after_create(
        &self,
        _key: &String,
        value: &CacheEntry,
        _created_at: Instant,
    ) -> Option<StdDuration> {
        value.ttl
    }

    fn expire_after_update(
        &self,
        _key: &String,
        value: &CacheEntry,
        _updated_at: Instant,
        _duration_until_expiry: Option<StdDuration>,
    ) -> Option<StdDuration> {
        value.ttl
    }
}

#[derive(Clone)]
pub struct MokaCacheStore {
    namespace: String,
    cache: Cache<String, CacheEntry>,
    set_if_absent_guard: Arc<Mutex<()>>,
}

impl MokaCacheStore {
    pub fn new(namespace: impl Into<String>, max_capacity: u64) -> Self {
        Self {
            namespace: namespace.into(),
            cache: Cache::builder()
                .max_capacity(max_capacity)
                .expire_after(CacheEntryExpiry)
                .build(),
            set_if_absent_guard: Arc::new(Mutex::new(())),
        }
    }

    fn namespaced_key(&self, key: &str) -> String {
        format!("{}:{}", self.namespace, key)
    }

    fn ttl_to_std(ttl: Option<time::Duration>) -> Option<StdDuration> {
        ttl.map(|value| {
            if value <= time::Duration::ZERO {
                StdDuration::ZERO
            } else {
                value.try_into().unwrap_or(StdDuration::ZERO)
            }
        })
    }
}
```

Implement `CacheStore` and `EphemeralKvStore` with these rules:

```text
get_json returns cloned JSON or None.
set_json stores CacheEntry { value, ttl: ttl_to_std(ttl) }.
delete invalidates the namespaced key.
touch invalidates and returns false when ttl <= time::Duration::ZERO.
touch reads the current value and reinserts it with the new TTL when the key exists.
set_if_absent_json holds set_if_absent_guard across get + insert so local lease-style use is atomic inside this process.
```

Create `api/crates/storage-ephemeral/src/local/mod.rs`:

```rust
mod moka_cache_store;

pub use moka_cache_store::MokaCacheStore;
```

Export from `lib.rs`:

```rust
pub mod local;
pub use local::MokaCacheStore;
```

 **Step 3: Re-run cache tests**

Run:

```bash
cd api
cargo test -p storage-ephemeral moka_cache_store -- --nocapture
```

Expected: PASS.

### Task 3: Add Moka Session And Rate Limit Stores

**Files:**
- Create: `api/crates/storage-ephemeral/src/local/moka_session_store.rs`
- Create: `api/crates/storage-ephemeral/src/local/moka_rate_limit_store.rs`
- Modify: `api/crates/storage-ephemeral/src/local/mod.rs`
- Modify: `api/crates/storage-ephemeral/src/lib.rs`
- Create: `api/crates/storage-ephemeral/src/_tests/moka_session_store_tests.rs`
- Create: `api/crates/storage-ephemeral/src/_tests/moka_rate_limit_store_tests.rs`
- Modify: `api/crates/storage-ephemeral/src/_tests/mod.rs`

 **Step 1: Write RED tests**

Add session tests:

```rust
use control_plane::ports::SessionStore;
use domain::SessionRecord;
use storage_ephemeral::MokaSessionStore;

#[tokio::test]
async fn moka_session_store_put_get_touch_and_delete() {
    let store = MokaSessionStore::new("flowbase:session", 128);
    let mut session = SessionRecord {
        session_id: "session-1".to_string(),
        user_id: uuid::Uuid::now_v7(),
        tenant_id: uuid::Uuid::now_v7(),
        current_workspace_id: uuid::Uuid::now_v7(),
        expires_at_unix: time::OffsetDateTime::now_utc().unix_timestamp() + 60,
        created_at_unix: time::OffsetDateTime::now_utc().unix_timestamp(),
    };

    store.put(session.clone()).await.unwrap();
    assert_eq!(store.get("session-1").await.unwrap(), Some(session.clone()));

    session.expires_at_unix += 60;
    store.touch("session-1", session.expires_at_unix).await.unwrap();
    assert_eq!(
        store.get("session-1").await.unwrap().unwrap().expires_at_unix,
        session.expires_at_unix
    );

    store.delete("session-1").await.unwrap();
    assert_eq!(store.get("session-1").await.unwrap(), None);
}
```

Add rate-limit tests:

```rust
use control_plane::ports::RateLimitStore;
use storage_ephemeral::MokaRateLimitStore;
use time::Duration;

#[tokio::test]
async fn moka_rate_limit_store_counts_inside_window() {
    let store = MokaRateLimitStore::new("flowbase:rate", 128);

    let first = store.consume("actor:1", 2, Duration::seconds(60)).await.unwrap();
    let second = store.consume("actor:1", 2, Duration::seconds(60)).await.unwrap();
    let third = store.consume("actor:1", 2, Duration::seconds(60)).await.unwrap();

    assert!(first.allowed);
    assert_eq!(first.remaining, 1);
    assert!(second.allowed);
    assert_eq!(second.remaining, 0);
    assert!(!third.allowed);
    assert_eq!(third.remaining, 0);
}
```

 **Step 2: Implement stores**

Implement `MokaSessionStore` by composing `MokaCacheStore` and the existing `session_ttl` / `is_session_expired` helpers from `storage-ephemeral/src/session_store.rs`.

Implement `MokaRateLimitStore` with `Cache<String, RateLimitWindow>` and one update mutex:

```rust
#[derive(Debug, Clone)]
struct RateLimitWindow {
    count: u64,
    reset_at: time::OffsetDateTime,
}
```

On `consume`, reset the window when `reset_at <= now`, increment only when below `limit`, and return `RateLimitDecision { allowed, remaining, reset_after_ms }`.

 **Step 3: Run targeted tests**

Run:

```bash
cd api
cargo test -p storage-ephemeral moka_session_store -- --nocapture
cargo test -p storage-ephemeral moka_rate_limit_store -- --nocapture
```

Expected: PASS.

### Task 4: Add Local Lock/Event/Task Providers

**Files:**
- Create: `api/crates/storage-ephemeral/src/local/memory_distributed_lock.rs`
- Create: `api/crates/storage-ephemeral/src/local/memory_event_bus.rs`
- Create: `api/crates/storage-ephemeral/src/local/memory_task_queue.rs`
- Modify: `api/crates/storage-ephemeral/src/local/mod.rs`
- Modify: `api/crates/storage-ephemeral/src/lib.rs`
- Create: `api/crates/storage-ephemeral/src/_tests/local_infrastructure_tests.rs`
- Modify: `api/crates/storage-ephemeral/src/_tests/mod.rs`

 **Step 1: Write RED tests**

Add:

```rust
use control_plane::ports::{DistributedLock, EventBus, TaskQueue};
use serde_json::json;
use storage_ephemeral::{MemoryDistributedLock, MemoryEventBus, MemoryTaskQueue};
use time::Duration;

#[tokio::test]
async fn memory_distributed_lock_checks_owner() {
    let lock = MemoryDistributedLock::new("flowbase:lock");

    assert!(lock.acquire("install", "owner-a", Duration::seconds(30)).await.unwrap());
    assert!(!lock.release("install", "owner-b").await.unwrap());
    assert!(lock.release("install", "owner-a").await.unwrap());
}

#[tokio::test]
async fn memory_event_bus_delivers_by_topic() {
    let bus = MemoryEventBus::new();

    bus.publish("plugin.install", json!({ "id": 1 })).await.unwrap();

    assert_eq!(bus.poll("other").await.unwrap(), None);
    assert_eq!(bus.poll("plugin.install").await.unwrap(), Some(json!({ "id": 1 })));
}

#[tokio::test]
async fn memory_task_queue_idempotency_claim_ack_and_fail_are_worker_checked() {
    let queue = MemoryTaskQueue::new("flowbase:task");

    let task_id = queue
        .enqueue("preview", json!({ "file": "a" }), Some("preview:file:a"))
        .await
        .unwrap();
    let repeated_task_id = queue
        .enqueue("preview", json!({ "file": "a" }), Some("preview:file:a"))
        .await
        .unwrap();
    assert_eq!(repeated_task_id, task_id);

    let task = queue
        .claim("preview", "worker-a", Duration::seconds(30))
        .await
        .unwrap()
        .unwrap();

    assert_eq!(task.task_id, task_id);
    assert_eq!(task.idempotency_key.as_deref(), Some("preview:file:a"));
    assert!(task.claim_expires_at_unix > time::OffsetDateTime::now_utc().unix_timestamp());
    assert!(!queue.ack("preview", &task_id, "worker-b").await.unwrap());
    assert!(queue.fail("preview", &task_id, "worker-a", "retry").await.unwrap());
}
```

 **Step 2: Implement providers**

`MemoryDistributedLock` delegates to the existing `MemoryLeaseStore`.

`MemoryEventBus` stores `HashMap<String, VecDeque<serde_json::Value>>` behind `tokio::sync::Mutex`.

`MemoryTaskQueue` stores:

```rust
#[derive(Clone)]
struct TaskEntry {
    task_id: String,
    payload: serde_json::Value,
    idempotency_key: Option<String>,
    claimed_by: Option<String>,
    claim_expires_at: Option<time::OffsetDateTime>,
}
```

Use `uuid::Uuid::now_v7().to_string()` for `task_id`. Maintain a secondary `HashMap<(String, String), String>` mapping `(queue, idempotency_key)` to `task_id` for non-empty idempotency keys. `enqueue` with the same queue and idempotency key returns the existing task id while the task is pending or claimed. `claim` may reclaim entries whose `claim_expires_at <= now`, sets `claimed_by`, and sets `claim_expires_at = now + visibility_timeout`. `ack` removes only when `claimed_by == worker` and must remove the idempotency index entry. `fail` clears claim only when `claimed_by == worker`.

 **Step 3: Run targeted tests**

Run:

```bash
cd api
cargo test -p storage-ephemeral local_infrastructure -- --nocapture
```

Expected: PASS.

### Task 5: Wire Local Providers Into Api-Server Registry

**Files:**
- Modify: `api/apps/api-server/src/host_infrastructure/local.rs`
- Modify: `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`

 **Step 1: Replace temporary structs**

Replace api-server local placeholder structs with imports:

```rust
use storage_ephemeral::{
    MemoryDistributedLock, MemoryEventBus, MemoryTaskQueue, MokaCacheStore, MokaRateLimitStore,
    MokaSessionStore,
};
```

Register `MokaSessionStore`, `MokaCacheStore`, `MemoryDistributedLock`, `MemoryEventBus`, `MemoryTaskQueue`, and `MokaRateLimitStore` with the existing `HostInfrastructureRegistry` setters. Use namespaces:

```rust
const CACHE_STORE_NAMESPACE: &str = "flowbase:cache";
const RATE_LIMIT_STORE_NAMESPACE: &str = "flowbase:rate-limit";
const LOCK_NAMESPACE: &str = "flowbase:lock";
const TASK_QUEUE_NAMESPACE: &str = "flowbase:task";
const LOCAL_CACHE_MAX_CAPACITY: u64 = 10_000;
```

 **Step 2: Strengthen api-server tests**

Update `local_infra_host_exposes_operation_contracts` so cache set/get, event publish/poll, and task idempotency are real:

```rust
let cache = registry.cache_store();
cache
    .set_json("provider-catalog", serde_json::json!({ "cached": true }), None)
    .await
    .unwrap();
assert_eq!(
    cache.get_json("provider-catalog").await.unwrap(),
    Some(serde_json::json!({ "cached": true }))
);

let events = registry.event_bus();
events
    .publish("runtime.debug", serde_json::json!({ "run": "1" }))
    .await
    .unwrap();
assert_eq!(
    events.poll("runtime.debug").await.unwrap(),
    Some(serde_json::json!({ "run": "1" }))
);

let tasks = registry.task_queue();
let first = tasks
    .enqueue("preview", serde_json::json!({ "file": "a" }), Some("preview:file:a"))
    .await
    .unwrap();
let second = tasks
    .enqueue("preview", serde_json::json!({ "file": "a" }), Some("preview:file:a"))
    .await
    .unwrap();
assert_eq!(first, second);
```

 **Step 3: Run registry and storage tests**

Run:

```bash
cd api
cargo test -p storage-ephemeral -- --nocapture
cargo test -p api-server host_infrastructure -- --nocapture
```

Expected: PASS.

 **Step 4: Run formatting and commit Plan B**

Run:

```bash
cd api
cargo fmt
```

Commit:

```bash
git add api/Cargo.toml api/Cargo.lock api/crates/storage-ephemeral api/apps/api-server/src/host_infrastructure/local.rs api/apps/api-server/src/_tests/host_infrastructure_tests.rs
git commit -m "feat: add moka local host infrastructure provider"
```
