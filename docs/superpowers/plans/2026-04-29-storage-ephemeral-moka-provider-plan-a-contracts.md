# Storage Ephemeral Moka Provider Plan A Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace api-server-only placeholder host infrastructure traits with real async operation contracts owned by control-plane ports.

**Architecture:** Keep `SessionStore` in `control-plane::ports` and add sibling traits for cache, lock, event bus, task queue, and rate limit. `storage-ephemeral` implements these contracts in Plan B, while `api-server` only assembles a `HostInfrastructureRegistry` from trait objects. `TaskQueue` is explicitly at-least-once with idempotency key and visibility timeout; reliable business jobs still use PostgreSQL outbox / job tables.

**Tech Stack:** Rust, async-trait, serde_json, time, uuid, control-plane ports, api-server host infrastructure registry, targeted Cargo tests.

---

## File Structure

**Create**
- `api/crates/control-plane/src/ports/infrastructure.rs`: operation-level host infrastructure traits and shared DTOs.
- `api/crates/control-plane/src/_tests/host_infrastructure_contract_tests.rs`: contract shape and object-safety tests.

**Modify**
- `api/crates/control-plane/src/ports/mod.rs`: export infrastructure traits.
- `api/crates/control-plane/src/_tests/mod.rs`: include contract tests.
- `api/apps/api-server/src/host_infrastructure/contracts.rs`: reduce api-server-local trait definitions to re-exports.
- `api/apps/api-server/src/host_infrastructure/mod.rs`: continue exposing registry accessors, now backed by control-plane traits.
- `api/apps/api-server/src/host_infrastructure/local.rs`: make temporary local providers implement async operation traits until Plan B replaces them.
- `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`: assert registry providers expose operation contracts, not only provider identity.

### Task 1: Add Control-Plane Contract Tests

**Files:**
- Create: `api/crates/control-plane/src/_tests/host_infrastructure_contract_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

 **Step 1: Write RED tests**

Add:

```rust
use std::sync::Arc;

use async_trait::async_trait;
use control_plane::ports::{
    CacheStore, ClaimedTask, DistributedLock, EventBus, RateLimitDecision, RateLimitStore,
    TaskQueue,
};
use serde_json::json;
use time::{Duration, OffsetDateTime};

#[derive(Default)]
struct FakeInfrastructure;

#[async_trait]
impl CacheStore for FakeInfrastructure {
    async fn get_json(&self, _key: &str) -> anyhow::Result<Option<serde_json::Value>> {
        Ok(Some(json!({ "ok": true })))
    }

    async fn set_json(
        &self,
        _key: &str,
        _value: serde_json::Value,
        _ttl: Option<Duration>,
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn delete(&self, _key: &str) -> anyhow::Result<()> {
        Ok(())
    }

    async fn touch(&self, _key: &str, _ttl: Duration) -> anyhow::Result<bool> {
        Ok(true)
    }
}

#[async_trait]
impl DistributedLock for FakeInfrastructure {
    async fn acquire(&self, _key: &str, _owner: &str, _ttl: Duration) -> anyhow::Result<bool> {
        Ok(true)
    }

    async fn renew(&self, _key: &str, _owner: &str, _ttl: Duration) -> anyhow::Result<bool> {
        Ok(true)
    }

    async fn release(&self, _key: &str, _owner: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
}

#[async_trait]
impl EventBus for FakeInfrastructure {
    async fn publish(&self, _topic: &str, _payload: serde_json::Value) -> anyhow::Result<()> {
        Ok(())
    }

    async fn poll(&self, _topic: &str) -> anyhow::Result<Option<serde_json::Value>> {
        Ok(Some(json!({ "event": true })))
    }
}

#[async_trait]
impl TaskQueue for FakeInfrastructure {
    async fn enqueue(
        &self,
        _queue: &str,
        _payload: serde_json::Value,
        _idempotency_key: Option<&str>,
    ) -> anyhow::Result<String> {
        Ok("task-1".to_string())
    }

    async fn claim(
        &self,
        _queue: &str,
        _worker: &str,
        _visibility_timeout: Duration,
    ) -> anyhow::Result<Option<ClaimedTask>> {
        Ok(Some(ClaimedTask {
            task_id: "task-1".to_string(),
            payload: json!({ "job": true }),
            claimed_by: "worker-1".to_string(),
            idempotency_key: Some("task-key-1".to_string()),
            claim_expires_at_unix: OffsetDateTime::now_utc().unix_timestamp() + 60,
        }))
    }

    async fn ack(&self, _queue: &str, _task_id: &str, _worker: &str) -> anyhow::Result<bool> {
        Ok(true)
    }

    async fn fail(
        &self,
        _queue: &str,
        _task_id: &str,
        _worker: &str,
        _reason: &str,
    ) -> anyhow::Result<bool> {
        Ok(true)
    }
}

#[async_trait]
impl RateLimitStore for FakeInfrastructure {
    async fn consume(
        &self,
        _key: &str,
        _limit: u64,
        _window: Duration,
    ) -> anyhow::Result<RateLimitDecision> {
        Ok(RateLimitDecision {
            allowed: true,
            remaining: 9,
            reset_after_ms: 1_000,
        })
    }

    async fn reset(&self, _key: &str) -> anyhow::Result<()> {
        Ok(())
    }
}

#[tokio::test]
async fn infrastructure_contracts_are_object_safe_and_async() {
    let cache: Arc<dyn CacheStore> = Arc::new(FakeInfrastructure);
    let lock: Arc<dyn DistributedLock> = Arc::new(FakeInfrastructure);
    let events: Arc<dyn EventBus> = Arc::new(FakeInfrastructure);
    let queue: Arc<dyn TaskQueue> = Arc::new(FakeInfrastructure);
    let rate_limit: Arc<dyn RateLimitStore> = Arc::new(FakeInfrastructure);

    assert_eq!(cache.get_json("key").await.unwrap(), Some(json!({ "ok": true })));
    assert!(lock.acquire("lock", "owner", Duration::seconds(1)).await.unwrap());
    assert_eq!(events.poll("topic").await.unwrap(), Some(json!({ "event": true })));
    assert_eq!(
        queue
            .claim("queue", "worker-1", Duration::seconds(1))
            .await
            .unwrap()
            .unwrap()
            .idempotency_key,
        Some("task-key-1".to_string())
    );
    assert!(rate_limit.consume("key", 10, Duration::seconds(60)).await.unwrap().allowed);
}
```

Add `mod host_infrastructure_contract_tests;` to `api/crates/control-plane/src/_tests/mod.rs`.

 **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p control-plane host_infrastructure_contract_tests -- --nocapture
```

Expected: FAIL because the new traits and DTOs are not exported by `control_plane::ports`.

### Task 2: Implement Control-Plane Infrastructure Ports

**Files:**
- Create: `api/crates/control-plane/src/ports/infrastructure.rs`
- Modify: `api/crates/control-plane/src/ports/mod.rs`

 **Step 1: Add operation contracts**

Create `api/crates/control-plane/src/ports/infrastructure.rs`:

```rust
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[async_trait]
pub trait CacheStore: Send + Sync {
    async fn get_json(&self, key: &str) -> anyhow::Result<Option<serde_json::Value>>;
    async fn set_json(
        &self,
        key: &str,
        value: serde_json::Value,
        ttl: Option<time::Duration>,
    ) -> anyhow::Result<()>;
    async fn delete(&self, key: &str) -> anyhow::Result<()>;
    async fn touch(&self, key: &str, ttl: time::Duration) -> anyhow::Result<bool>;
}

#[async_trait]
pub trait DistributedLock: Send + Sync {
    async fn acquire(&self, key: &str, owner: &str, ttl: time::Duration) -> anyhow::Result<bool>;
    async fn renew(&self, key: &str, owner: &str, ttl: time::Duration) -> anyhow::Result<bool>;
    async fn release(&self, key: &str, owner: &str) -> anyhow::Result<bool>;
}

#[async_trait]
pub trait EventBus: Send + Sync {
    async fn publish(&self, topic: &str, payload: serde_json::Value) -> anyhow::Result<()>;
    async fn poll(&self, topic: &str) -> anyhow::Result<Option<serde_json::Value>>;
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClaimedTask {
    pub task_id: String,
    pub payload: serde_json::Value,
    pub claimed_by: String,
    pub idempotency_key: Option<String>,
    pub claim_expires_at_unix: i64,
}

#[async_trait]
pub trait TaskQueue: Send + Sync {
    async fn enqueue(
        &self,
        queue: &str,
        payload: serde_json::Value,
        idempotency_key: Option<&str>,
    ) -> anyhow::Result<String>;
    async fn claim(
        &self,
        queue: &str,
        worker: &str,
        visibility_timeout: time::Duration,
    ) -> anyhow::Result<Option<ClaimedTask>>;
    async fn ack(&self, queue: &str, task_id: &str, worker: &str) -> anyhow::Result<bool>;
    async fn fail(
        &self,
        queue: &str,
        task_id: &str,
        worker: &str,
        reason: &str,
    ) -> anyhow::Result<bool>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RateLimitDecision {
    pub allowed: bool,
    pub remaining: u64,
    pub reset_after_ms: u64,
}

#[async_trait]
pub trait RateLimitStore: Send + Sync {
    async fn consume(
        &self,
        key: &str,
        limit: u64,
        window: time::Duration,
    ) -> anyhow::Result<RateLimitDecision>;
    async fn reset(&self, key: &str) -> anyhow::Result<()>;
}
```

Task queue semantics:

```text
TaskQueue is at-least-once by contract.
enqueue with the same queue + idempotency_key returns the existing task_id while that task is pending or claimed.
claim sets claimed_by and claim_expires_at_unix; unacked tasks become claimable again after visibility_timeout.
ack removes only when claimed_by == worker and the claim has not expired.
fail clears the claim only when claimed_by == worker.
Reliable business jobs still use PostgreSQL outbox / job tables; memory TaskQueue is only for disposable or rebuildable work.
```

Export it from `api/crates/control-plane/src/ports/mod.rs`:

```rust
mod infrastructure;

pub use infrastructure::{
    CacheStore, ClaimedTask, DistributedLock, EventBus, RateLimitDecision, RateLimitStore,
    TaskQueue,
};
```

 **Step 2: Re-run contract tests**

Run:

```bash
cd api
cargo test -p control-plane host_infrastructure_contract_tests -- --nocapture
```

Expected: PASS.

### Task 3: Rewire Api-Server Registry To Control-Plane Ports

**Files:**
- Modify: `api/apps/api-server/src/host_infrastructure/contracts.rs`
- Modify: `api/apps/api-server/src/host_infrastructure/mod.rs`
- Modify: `api/apps/api-server/src/host_infrastructure/local.rs`

 **Step 1: Replace local traits with re-exports**

Change `api/apps/api-server/src/host_infrastructure/contracts.rs` to:

```rust
pub use control_plane::ports::{
    CacheStore, ClaimedTask, DistributedLock, EventBus, RateLimitDecision, RateLimitStore,
    TaskQueue,
};
```

Keep the existing `HostInfrastructureRegistry` accessors in `mod.rs`, but make every trait object resolve to the re-exported control-plane trait.

 **Step 2: Add temporary local provider async implementations**

Until Plan B replaces these with storage-ephemeral providers, make current api-server local structs compile with deterministic non-error behavior:

```rust
#[async_trait::async_trait]
impl CacheStore for LocalCacheStore {
    async fn get_json(&self, _key: &str) -> anyhow::Result<Option<serde_json::Value>> {
        Ok(None)
    }

    async fn set_json(
        &self,
        _key: &str,
        _value: serde_json::Value,
        _ttl: Option<time::Duration>,
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn delete(&self, _key: &str) -> anyhow::Result<()> {
        Ok(())
    }

    async fn touch(&self, _key: &str, _ttl: time::Duration) -> anyhow::Result<bool> {
        Ok(false)
    }
}

#[async_trait::async_trait]
impl DistributedLock for LocalDistributedLock {
    async fn acquire(&self, _key: &str, _owner: &str, _ttl: time::Duration) -> anyhow::Result<bool> {
        Ok(false)
    }

    async fn renew(&self, _key: &str, _owner: &str, _ttl: time::Duration) -> anyhow::Result<bool> {
        Ok(false)
    }

    async fn release(&self, _key: &str, _owner: &str) -> anyhow::Result<bool> {
        Ok(false)
    }
}

#[async_trait::async_trait]
impl EventBus for LocalEventBus {
    async fn publish(&self, _topic: &str, _payload: serde_json::Value) -> anyhow::Result<()> {
        Ok(())
    }

    async fn poll(&self, _topic: &str) -> anyhow::Result<Option<serde_json::Value>> {
        Ok(None)
    }
}

#[async_trait::async_trait]
impl TaskQueue for LocalTaskQueue {
    async fn enqueue(
        &self,
        _queue: &str,
        _payload: serde_json::Value,
        _idempotency_key: Option<&str>,
    ) -> anyhow::Result<String> {
        Ok(uuid::Uuid::now_v7().to_string())
    }

    async fn claim(
        &self,
        _queue: &str,
        _worker: &str,
        _visibility_timeout: time::Duration,
    ) -> anyhow::Result<Option<ClaimedTask>> {
        Ok(None)
    }

    async fn ack(&self, _queue: &str, _task_id: &str, _worker: &str) -> anyhow::Result<bool> {
        Ok(false)
    }

    async fn fail(
        &self,
        _queue: &str,
        _task_id: &str,
        _worker: &str,
        _reason: &str,
    ) -> anyhow::Result<bool> {
        Ok(false)
    }
}

#[async_trait::async_trait]
impl RateLimitStore for LocalRateLimitStore {
    async fn consume(
        &self,
        _key: &str,
        limit: u64,
        window: time::Duration,
    ) -> anyhow::Result<RateLimitDecision> {
        Ok(RateLimitDecision {
            allowed: true,
            remaining: limit.saturating_sub(1),
            reset_after_ms: window.whole_milliseconds().max(0) as u64,
        })
    }

    async fn reset(&self, _key: &str) -> anyhow::Result<()> {
        Ok(())
    }
}
```

 **Step 3: Run api-server host infrastructure tests**

Run:

```bash
cd api
cargo test -p api-server host_infrastructure -- --nocapture
```

Expected: PASS.

### Task 4: Extend Registry Tests With Operation Calls

**Files:**
- Modify: `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`

 **Step 1: Add operation assertions**

Append:

```rust
#[tokio::test]
async fn local_infra_host_exposes_operation_contracts() {
    let registry = crate::host_infrastructure::build_local_host_infrastructure();

    assert_eq!(registry.cache_store().get_json("missing").await.unwrap(), None);
    assert!(!registry
        .distributed_lock()
        .release("missing", "owner")
        .await
        .unwrap());
    assert_eq!(registry.event_bus().poll("topic").await.unwrap(), None);
    assert!(registry
        .rate_limit_store()
        .consume("actor:1", 5, time::Duration::seconds(60))
        .await
        .unwrap()
        .allowed);
    assert!(registry
        .task_queue()
        .enqueue(
            "disposable-preview",
            serde_json::json!({ "preview": true }),
            Some("preview:1"),
        )
        .await
        .unwrap()
        .len()
        > 0);
}
```

 **Step 2: Run targeted tests**

Run:

```bash
cd api
cargo test -p api-server host_infrastructure -- --nocapture
```

Expected: PASS.

 **Step 3: Commit Plan A**

```bash
git add api/crates/control-plane/src/ports api/crates/control-plane/src/_tests api/apps/api-server/src/host_infrastructure api/apps/api-server/src/_tests/host_infrastructure_tests.rs
git commit -m "feat: define host infrastructure operation contracts"
```
