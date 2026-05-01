# Runtime Event Stream Fast Debug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make flow debug streaming open immediately, route live runtime events through a host-owned `RuntimeEventStream`, and remove DB polling from the first-token live path.

**Architecture:** Add a `RuntimeEventStream` host contract in `control-plane`, provide a local in-process broadcast + ring implementation in `api-server`, and wire debug SSE to subscribe to that stream. Split debug run startup into a lightweight durable shell plus background compile/execute, then emit node/provider events directly to the stream while durable writes continue through repository boundaries and an async debug event persister.

**Tech Stack:** Rust 2021, Axum SSE, Tokio mpsc/broadcast, SQLx/PostgreSQL migrations, Serde JSON, React, TanStack Query, Vitest

---

## Scope Check

This plan implements the local single-server phase of [Runtime Event Stream 与调试流首 token 加速设计](../specs/2026-05-02-runtime-event-stream-fast-debug-design.md).

Included:
- `RuntimeEventStream` contract and local provider.
- Durable debug run shell.
- Fast-start SSE route.
- Runtime event emission for flow/node/provider live events.
- Async debug event persister for stream event durability and text delta coalescing.
- Provider hot-path timing and low-risk provider load cache.
- Frontend stream event handling and text delta batching.
- Task-scoped QA evidence.

Not included in this plan:
- Redis Streams HostExtension provider.
- Multi-server replay guarantees.
- Long-running provider worker pool.
- Published-run strong consistency changes.

## File Structure

- Modify: `api/crates/control-plane/src/ports/infrastructure.rs`
- Modify: `api/crates/control-plane/src/_tests/host_infrastructure_contract_tests.rs`
- Create: `api/apps/api-server/src/host_infrastructure/local_runtime_event_stream.rs`
- Modify: `api/apps/api-server/src/host_infrastructure/contracts.rs`
- Modify: `api/apps/api-server/src/host_infrastructure/local.rs`
- Modify: `api/apps/api-server/src/host_infrastructure/mod.rs`
- Modify: `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`
- Create: `api/apps/api-server/src/_tests/runtime_event_stream_tests.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260502090000_allow_flow_run_shell_compiled_plan.sql`
- Modify: `api/crates/domain/src/orchestration.rs`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Modify: `api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/support/repository.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`
- Create: `api/crates/control-plane/src/orchestration_runtime/debug_stream_events.rs`
- Create: `api/crates/control-plane/src/orchestration_runtime/debug_event_persister.rs`
- Modify: `api/apps/api-server/src/app_state.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/_tests/support/auth.rs`
- Create: `api/apps/api-server/src/routes/applications/debug_run_stream.rs`
- Modify: `api/apps/api-server/src/routes/applications/mod.rs`
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`
- Modify: `api/apps/api-server/src/provider_runtime.rs`
- Modify: `web/packages/api-client/src/console-application-runtime.ts`
- Modify: `web/app/src/features/agent-flow/api/runtime.ts`
- Modify: `web/app/src/features/agent-flow/lib/debug-console/stream-events.ts`
- Modify: `web/app/src/features/agent-flow/hooks/runtime/useAgentFlowDebugSession.ts`
- Modify: `web/app/src/features/agent-flow/_tests/debug-console/use-agent-flow-debug-session-stream.test.tsx`

## Task 1: Add RuntimeEventStream Contract

**Files:**
- Modify: `api/crates/control-plane/src/ports/infrastructure.rs`
- Modify: `api/crates/control-plane/src/_tests/host_infrastructure_contract_tests.rs`

- [x] **Step 1: Extend the object-safety contract test**

In `api/crates/control-plane/src/_tests/host_infrastructure_contract_tests.rs`, extend the imports:

```rust
use control_plane::ports::{
    CacheStore, ClaimedTask, DistributedLock, EventBus, RateLimitDecision, RateLimitStore,
    RuntimeEventCloseReason, RuntimeEventEnvelope, RuntimeEventPayload, RuntimeEventSource,
    RuntimeEventStream, RuntimeEventStreamPolicy, RuntimeEventSubscription, RuntimeEventTrimPolicy,
    TaskQueue,
};
use tokio::sync::mpsc;
use uuid::Uuid;
```

Add this fake implementation after `impl RateLimitStore for FakeInfrastructure`:

```rust
#[async_trait]
impl RuntimeEventStream for FakeInfrastructure {
    async fn open_run(
        &self,
        _run_id: Uuid,
        _policy: RuntimeEventStreamPolicy,
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn append(
        &self,
        run_id: Uuid,
        event: RuntimeEventPayload,
    ) -> anyhow::Result<RuntimeEventEnvelope> {
        Ok(RuntimeEventEnvelope::new(run_id, 1, event))
    }

    async fn subscribe(
        &self,
        _run_id: Uuid,
        _from_sequence: Option<i64>,
    ) -> anyhow::Result<RuntimeEventSubscription> {
        let (_sender, receiver) = mpsc::unbounded_channel();

        Ok(RuntimeEventSubscription {
            replay: vec![],
            live_events: receiver,
        })
    }

    async fn replay(
        &self,
        _run_id: Uuid,
        _from_sequence: Option<i64>,
        _limit: usize,
    ) -> anyhow::Result<Vec<RuntimeEventEnvelope>> {
        Ok(vec![])
    }

    async fn close_run(
        &self,
        _run_id: Uuid,
        _reason: RuntimeEventCloseReason,
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn trim(
        &self,
        _run_id: Uuid,
        _policy: RuntimeEventTrimPolicy,
    ) -> anyhow::Result<()> {
        Ok(())
    }
}
```

Inside `infrastructure_contracts_are_object_safe_and_async`, add:

```rust
let runtime_events: Arc<dyn RuntimeEventStream> = Arc::new(FakeInfrastructure);
let run_id = Uuid::now_v7();
runtime_events
    .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
    .await
    .unwrap();
let envelope = runtime_events
    .append(
        run_id,
        RuntimeEventPayload {
            event_type: "heartbeat".to_string(),
            source: RuntimeEventSource::System,
            durability: control_plane::ports::RuntimeEventDurability::Ephemeral,
            persist_required: false,
            trace_visible: false,
            payload: json!({ "type": "heartbeat" }),
        },
    )
    .await
    .unwrap();
assert_eq!(envelope.sequence, 1);
```

- [x] **Step 2: Run the failing contract test**

Run:

```bash
cargo test -p control-plane infrastructure_contracts_are_object_safe_and_async
```

Expected: FAIL because `RuntimeEventStream` and related types do not exist.

- [x] **Step 3: Add the contract types**

Append this section to `api/crates/control-plane/src/ports/infrastructure.rs`:

```rust
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeEventSource {
    Runtime,
    Provider,
    Persister,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeEventDurability {
    Ephemeral,
    DurableRequired,
    AuditRequired,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuntimeEventPayload {
    pub event_type: String,
    pub source: RuntimeEventSource,
    pub durability: RuntimeEventDurability,
    pub persist_required: bool,
    pub trace_visible: bool,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuntimeEventEnvelope {
    pub run_id: Uuid,
    pub sequence: i64,
    pub event_id: String,
    pub event_type: String,
    pub occurred_at: time::OffsetDateTime,
    pub source: RuntimeEventSource,
    pub durability: RuntimeEventDurability,
    pub persist_required: bool,
    pub trace_visible: bool,
    pub payload: serde_json::Value,
}

impl RuntimeEventEnvelope {
    pub fn new(run_id: Uuid, sequence: i64, event: RuntimeEventPayload) -> Self {
        Self {
            run_id,
            sequence,
            event_id: format!("{run_id}:{sequence}"),
            event_type: event.event_type,
            occurred_at: time::OffsetDateTime::now_utc(),
            source: event.source,
            durability: event.durability,
            persist_required: event.persist_required,
            trace_visible: event.trace_visible,
            payload: event.payload,
        }
    }
}

pub struct RuntimeEventSubscription {
    pub replay: Vec<RuntimeEventEnvelope>,
    pub live_events: mpsc::UnboundedReceiver<RuntimeEventEnvelope>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeEventOverflowBehavior {
    DropOldEphemeralKeepRequired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RuntimeEventStreamPolicy {
    pub ttl: time::Duration,
    pub max_events: usize,
    pub max_bytes: usize,
    pub overflow_behavior: RuntimeEventOverflowBehavior,
}

impl RuntimeEventStreamPolicy {
    pub fn debug_default() -> Self {
        Self {
            ttl: time::Duration::minutes(30),
            max_events: 20_000,
            max_bytes: 16 * 1024 * 1024,
            overflow_behavior: RuntimeEventOverflowBehavior::DropOldEphemeralKeepRequired,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeEventCloseReason {
    Finished,
    Failed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RuntimeEventTrimPolicy {
    pub before_sequence: Option<i64>,
    pub keep_required: bool,
}

#[async_trait]
pub trait RuntimeEventStream: Send + Sync {
    async fn open_run(
        &self,
        run_id: Uuid,
        policy: RuntimeEventStreamPolicy,
    ) -> anyhow::Result<()>;

    async fn append(
        &self,
        run_id: Uuid,
        event: RuntimeEventPayload,
    ) -> anyhow::Result<RuntimeEventEnvelope>;

    async fn subscribe(
        &self,
        run_id: Uuid,
        from_sequence: Option<i64>,
    ) -> anyhow::Result<RuntimeEventSubscription>;

    async fn replay(
        &self,
        run_id: Uuid,
        from_sequence: Option<i64>,
        limit: usize,
    ) -> anyhow::Result<Vec<RuntimeEventEnvelope>>;

    async fn close_run(
        &self,
        run_id: Uuid,
        reason: RuntimeEventCloseReason,
    ) -> anyhow::Result<()>;

    async fn trim(&self, run_id: Uuid, policy: RuntimeEventTrimPolicy) -> anyhow::Result<()>;
}
```

- [x] **Step 4: Run the contract test**

Run:

```bash
cargo test -p control-plane infrastructure_contracts_are_object_safe_and_async
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/control-plane/src/ports/infrastructure.rs \
  api/crates/control-plane/src/_tests/host_infrastructure_contract_tests.rs
git commit -m "feat: add runtime event stream host contract"
```

## Task 2: Implement LocalRuntimeEventStream

**Files:**
- Create: `api/apps/api-server/src/host_infrastructure/local_runtime_event_stream.rs`
- Create: `api/apps/api-server/src/_tests/runtime_event_stream_tests.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`

- [x] **Step 1: Register the test module**

Add this line to `api/apps/api-server/src/_tests/mod.rs`:

```rust
mod runtime_event_stream_tests;
```

- [x] **Step 2: Write local stream tests**

Create `api/apps/api-server/src/_tests/runtime_event_stream_tests.rs`:

```rust
use control_plane::ports::{
    RuntimeEventCloseReason, RuntimeEventDurability, RuntimeEventPayload, RuntimeEventSource,
    RuntimeEventStream, RuntimeEventStreamPolicy, RuntimeEventTrimPolicy,
};
use serde_json::json;
use uuid::Uuid;

use crate::host_infrastructure::LocalRuntimeEventStream;

fn heartbeat() -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "heartbeat".to_string(),
        source: RuntimeEventSource::System,
        durability: RuntimeEventDurability::Ephemeral,
        persist_required: false,
        trace_visible: false,
        payload: json!({ "type": "heartbeat" }),
    }
}

#[tokio::test]
async fn local_runtime_event_stream_assigns_monotonic_sequence() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    let first = stream.append(run_id, heartbeat()).await.unwrap();
    let second = stream.append(run_id, heartbeat()).await.unwrap();

    assert_eq!(first.sequence, 1);
    assert_eq!(second.sequence, 2);
    assert_ne!(first.event_id, second.event_id);
}

#[tokio::test]
async fn local_runtime_event_stream_replays_then_subscribes_live() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();
    let mut subscription = stream.subscribe(run_id, Some(0)).await.unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();

    assert_eq!(subscription.replay.len(), 1);
    assert_eq!(subscription.replay[0].sequence, 1);
    let live = subscription.live_events.recv().await.unwrap();
    assert_eq!(live.sequence, 2);
}

#[tokio::test]
async fn local_runtime_event_stream_reports_replay_expired_after_trim() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();
    stream
        .trim(
            run_id,
            RuntimeEventTrimPolicy {
                before_sequence: Some(2),
                keep_required: false,
            },
        )
        .await
        .unwrap();

    let err = stream.subscribe(run_id, Some(0)).await.unwrap_err();
    assert!(err.to_string().contains("runtime event replay expired"));
}

#[tokio::test]
async fn local_runtime_event_stream_rejects_append_after_close() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    stream
        .close_run(run_id, RuntimeEventCloseReason::Finished)
        .await
        .unwrap();

    let err = stream.append(run_id, heartbeat()).await.unwrap_err();
    assert!(err.to_string().contains("runtime event stream is closed"));
}
```

- [x] **Step 3: Run the failing local stream tests**

Run:

```bash
cargo test -p api-server runtime_event_stream_tests
```

Expected: FAIL because `LocalRuntimeEventStream` does not exist.

- [x] **Step 4: Implement the local stream**

Create `api/apps/api-server/src/host_infrastructure/local_runtime_event_stream.rs`:

```rust
use std::{
    collections::{HashMap, VecDeque},
    sync::{
        atomic::{AtomicBool, AtomicI64, Ordering},
        Arc, Mutex,
    },
};

use anyhow::{anyhow, Result};
use control_plane::ports::{
    RuntimeEventCloseReason, RuntimeEventEnvelope, RuntimeEventPayload, RuntimeEventStream,
    RuntimeEventStreamPolicy, RuntimeEventSubscription, RuntimeEventTrimPolicy,
};
use tokio::sync::{broadcast, mpsc};
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct LocalRuntimeEventStream {
    runs: Arc<Mutex<HashMap<Uuid, Arc<LocalRunEventStream>>>>,
}

struct LocalRunEventStream {
    next_sequence: AtomicI64,
    ring: Mutex<VecDeque<RuntimeEventEnvelope>>,
    broadcaster: broadcast::Sender<RuntimeEventEnvelope>,
    policy: RuntimeEventStreamPolicy,
    closed: AtomicBool,
}

impl LocalRuntimeEventStream {
    pub fn new() -> Self {
        Self::default()
    }
}

impl LocalRunEventStream {
    fn new(policy: RuntimeEventStreamPolicy) -> Self {
        let (broadcaster, _) = broadcast::channel(1024);

        Self {
            next_sequence: AtomicI64::new(1),
            ring: Mutex::new(VecDeque::new()),
            broadcaster,
            policy,
            closed: AtomicBool::new(false),
        }
    }
}

#[async_trait::async_trait]
impl RuntimeEventStream for LocalRuntimeEventStream {
    async fn open_run(&self, run_id: Uuid, policy: RuntimeEventStreamPolicy) -> Result<()> {
        let mut runs = self.runs.lock().expect("runtime event runs mutex poisoned");
        runs.entry(run_id)
            .or_insert_with(|| Arc::new(LocalRunEventStream::new(policy)));
        Ok(())
    }

    async fn append(
        &self,
        run_id: Uuid,
        event: RuntimeEventPayload,
    ) -> Result<RuntimeEventEnvelope> {
        let run = {
            let runs = self.runs.lock().expect("runtime event runs mutex poisoned");
            runs.get(&run_id)
                .ok_or_else(|| anyhow!("runtime event stream run is not open: {run_id}"))?
                .clone()
        };
        if run.closed.load(Ordering::SeqCst) {
            return Err(anyhow!("runtime event stream is closed: {run_id}"));
        }

        let sequence = run.next_sequence.fetch_add(1, Ordering::SeqCst);
        let envelope = RuntimeEventEnvelope::new(run_id, sequence, event);
        {
            let mut ring = run.ring.lock().expect("runtime event ring mutex poisoned");
            ring.push_back(envelope.clone());
            while ring.len() > run.policy.max_events {
                ring.pop_front();
            }
        }
        let _ = run.broadcaster.send(envelope.clone());

        Ok(envelope)
    }

    async fn subscribe(
        &self,
        run_id: Uuid,
        from_sequence: Option<i64>,
    ) -> Result<RuntimeEventSubscription> {
        let run = {
            let runs = self.runs.lock().expect("runtime event runs mutex poisoned");
            runs.get(&run_id)
                .ok_or_else(|| anyhow!("runtime event stream run is not open: {run_id}"))?
                .clone()
        };
        let mut live_receiver = run.broadcaster.subscribe();
        let replay = replay_from_ring(&run, from_sequence, usize::MAX)?;
        let last_replay_sequence = replay.last().map(|event| event.sequence).unwrap_or(0);
        let (sender, receiver) = mpsc::unbounded_channel();

        tokio::spawn(async move {
            loop {
                match live_receiver.recv().await {
                    Ok(event) if event.sequence > last_replay_sequence => {
                        if sender.send(event).is_err() {
                            break;
                        }
                    }
                    Ok(_) => {}
                    Err(broadcast::error::RecvError::Lagged(_)) => {}
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        });

        Ok(RuntimeEventSubscription {
            replay,
            live_events: receiver,
        })
    }

    async fn replay(
        &self,
        run_id: Uuid,
        from_sequence: Option<i64>,
        limit: usize,
    ) -> Result<Vec<RuntimeEventEnvelope>> {
        let run = {
            let runs = self.runs.lock().expect("runtime event runs mutex poisoned");
            runs.get(&run_id)
                .ok_or_else(|| anyhow!("runtime event stream run is not open: {run_id}"))?
                .clone()
        };
        replay_from_ring(&run, from_sequence, limit)
    }

    async fn close_run(&self, run_id: Uuid, _reason: RuntimeEventCloseReason) -> Result<()> {
        let run = {
            let runs = self.runs.lock().expect("runtime event runs mutex poisoned");
            runs.get(&run_id)
                .ok_or_else(|| anyhow!("runtime event stream run is not open: {run_id}"))?
                .clone()
        };
        run.closed.store(true, Ordering::SeqCst);
        Ok(())
    }

    async fn trim(&self, run_id: Uuid, policy: RuntimeEventTrimPolicy) -> Result<()> {
        let run = {
            let runs = self.runs.lock().expect("runtime event runs mutex poisoned");
            runs.get(&run_id)
                .ok_or_else(|| anyhow!("runtime event stream run is not open: {run_id}"))?
                .clone()
        };
        let Some(before_sequence) = policy.before_sequence else {
            return Ok(());
        };
        let mut ring = run.ring.lock().expect("runtime event ring mutex poisoned");
        while ring
            .front()
            .map(|event| event.sequence < before_sequence)
            .unwrap_or(false)
        {
            ring.pop_front();
        }
        Ok(())
    }
}

fn replay_from_ring(
    run: &LocalRunEventStream,
    from_sequence: Option<i64>,
    limit: usize,
) -> Result<Vec<RuntimeEventEnvelope>> {
    let from_sequence = from_sequence.unwrap_or(0);
    let ring = run.ring.lock().expect("runtime event ring mutex poisoned");
    if let Some(first) = ring.front() {
        if from_sequence < first.sequence - 1 {
            return Err(anyhow!("runtime event replay expired"));
        }
    }

    Ok(ring
        .iter()
        .filter(|event| event.sequence > from_sequence)
        .take(limit)
        .cloned()
        .collect())
}
```

This implementation uses `Mutex<HashMap<Uuid, Arc<LocalRunEventStream>>>`; do not add a new concurrent map dependency for this task.

- [x] **Step 5: Run the local stream tests**

Run:

```bash
cargo test -p api-server runtime_event_stream_tests
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/apps/api-server/src/host_infrastructure/local_runtime_event_stream.rs \
  api/apps/api-server/src/_tests/runtime_event_stream_tests.rs \
  api/apps/api-server/src/_tests/mod.rs
git commit -m "feat: add local runtime event stream"
```

## Task 3: Register runtime-event-stream in HostInfrastructureRegistry

**Files:**
- Modify: `api/apps/api-server/src/host_infrastructure/contracts.rs`
- Modify: `api/apps/api-server/src/host_infrastructure/local.rs`
- Modify: `api/apps/api-server/src/host_infrastructure/mod.rs`
- Modify: `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`

- [ ] **Step 1: Extend host infrastructure tests**

In `api/apps/api-server/src/_tests/host_infrastructure_tests.rs`, update `local_infra_host_provides_required_defaults`:

```rust
assert_eq!(
    registry.default_provider("runtime-event-stream").unwrap(),
    "local"
);
assert!(registry.runtime_event_stream().is_some());
```

In `local_infra_host_exposes_operation_contracts`, add:

```rust
let runtime_events = registry.runtime_event_stream().unwrap();
let run_id = uuid::Uuid::now_v7();
runtime_events
    .open_run(
        run_id,
        control_plane::ports::RuntimeEventStreamPolicy::debug_default(),
    )
    .await
    .unwrap();
let envelope = runtime_events
    .append(
        run_id,
        control_plane::ports::RuntimeEventPayload {
            event_type: "heartbeat".to_string(),
            source: control_plane::ports::RuntimeEventSource::System,
            durability: control_plane::ports::RuntimeEventDurability::Ephemeral,
            persist_required: false,
            trace_visible: false,
            payload: serde_json::json!({ "type": "heartbeat" }),
        },
    )
    .await
    .unwrap();
assert_eq!(envelope.sequence, 1);
```

- [ ] **Step 2: Run the failing registry test**

Run:

```bash
cargo test -p api-server host_infrastructure_tests
```

Expected: FAIL because the registry does not expose `runtime_event_stream`.

- [ ] **Step 3: Export the contract**

Update `api/apps/api-server/src/host_infrastructure/contracts.rs`:

```rust
pub use control_plane::ports::{
    CacheStore, ClaimedTask, DistributedLock, EventBus, RateLimitDecision, RateLimitStore,
    RuntimeEventStream, TaskQueue,
};
```

- [ ] **Step 4: Register the local provider**

Update `api/apps/api-server/src/host_infrastructure/mod.rs`:

```rust
mod local_runtime_event_stream;

pub use local_runtime_event_stream::LocalRuntimeEventStream;
```

Add a field to `HostInfrastructureRegistry`:

```rust
runtime_event_stream: Option<Arc<dyn RuntimeEventStream>>,
```

Add methods:

```rust
pub fn set_runtime_event_stream(&mut self, stream: Arc<dyn RuntimeEventStream>) {
    self.runtime_event_stream = Some(stream);
}

pub fn runtime_event_stream(&self) -> Option<Arc<dyn RuntimeEventStream>> {
    self.runtime_event_stream.clone()
}
```

Update `api/apps/api-server/src/host_infrastructure/local.rs`:

```rust
use super::{
    CacheStore, DistributedLock, EventBus, HostInfrastructureRegistry, LocalRuntimeEventStream,
    RateLimitStore, RuntimeEventStream, TaskQueue, SESSION_STORE_NAMESPACE,
};
```

Register and set the provider:

```rust
registry
    .register_default_provider(
        "runtime-event-stream",
        LOCAL_PROVIDER_CODE,
        LOCAL_PROVIDER_SOURCE,
    )
    .expect("local runtime-event-stream provider registration should be unique");

registry.set_runtime_event_stream(
    Arc::new(LocalRuntimeEventStream::new()) as Arc<dyn RuntimeEventStream>
);
```

- [ ] **Step 5: Run the registry tests**

Run:

```bash
cargo test -p api-server host_infrastructure_tests
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/apps/api-server/src/host_infrastructure/contracts.rs \
  api/apps/api-server/src/host_infrastructure/local.rs \
  api/apps/api-server/src/host_infrastructure/mod.rs \
  api/apps/api-server/src/_tests/host_infrastructure_tests.rs
git commit -m "feat: register runtime event stream infrastructure"
```

## Task 4: Add Durable Flow Run Shell Support

**Files:**
- Create: `api/crates/storage-durable/postgres/migrations/20260502090000_allow_flow_run_shell_compiled_plan.sql`
- Modify: `api/crates/domain/src/orchestration.rs`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Modify: `api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/support/repository.rs`
- Modify: `web/packages/api-client/src/console-application-runtime.ts`

- [ ] **Step 1: Add repository tests for shell and plan attachment**

In `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`, add a test beside the existing flow run tests:

```rust
#[tokio::test]
async fn creates_flow_run_shell_and_attaches_compiled_plan() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;

    let shell = <PgControlPlaneStore as OrchestrationRuntimeRepository>::create_flow_run_shell(
        &store,
        &CreateFlowRunShellInput {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            flow_id: seeded.flow_id,
            flow_draft_id: seeded.draft_id,
            run_mode: FlowRunMode::DebugFlowRun,
            target_node_id: None,
            status: FlowRunStatus::Queued,
            input_payload: json!({ "node-start": { "query": "hello" } }),
            started_at: OffsetDateTime::now_utc(),
        },
    )
    .await
    .unwrap();

    assert_eq!(shell.compiled_plan_id, None);
    assert_eq!(shell.status, domain::FlowRunStatus::Queued);

    let compiled = <PgControlPlaneStore as OrchestrationRuntimeRepository>::upsert_compiled_plan(
        &store,
        &UpsertCompiledPlanInput {
            actor_user_id: seeded.actor_user_id,
            flow_id: seeded.flow_id,
            flow_draft_id: seeded.draft_id,
            schema_version: "1flowbase.flow/v1".to_string(),
            document_updated_at: seeded.draft_updated_at,
            plan: json!({ "nodes": {}, "topological_order": [] }),
        },
    )
    .await
    .unwrap();

    let attached =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::attach_compiled_plan_to_flow_run(
            &store,
            &AttachCompiledPlanToFlowRunInput {
                flow_run_id: shell.id,
                compiled_plan_id: compiled.id,
                status: FlowRunStatus::Running,
            },
        )
        .await
        .unwrap();

    assert_eq!(attached.compiled_plan_id, Some(compiled.id));
    assert_eq!(attached.status, FlowRunStatus::Running);
}
```

Extend the existing import list in the same file with `AttachCompiledPlanToFlowRunInput` and `CreateFlowRunShellInput`.

- [ ] **Step 2: Run the failing repository test**

Run:

```bash
cargo test -p storage-postgres creates_flow_run_shell_and_attaches_compiled_plan
```

Expected: FAIL because shell inputs and repository methods do not exist.

- [ ] **Step 3: Add the migration**

Create `api/crates/storage-durable/postgres/migrations/20260502090000_allow_flow_run_shell_compiled_plan.sql`:

```sql
alter table flow_runs
    alter column compiled_plan_id drop not null;
```

- [ ] **Step 4: Update domain and port types**

In `api/crates/domain/src/orchestration.rs`, change:

```rust
pub compiled_plan_id: Uuid,
```

to:

```rust
pub compiled_plan_id: Option<Uuid>,
```

In `api/crates/control-plane/src/ports/runtime.rs`, add:

```rust
#[derive(Debug, Clone)]
pub struct CreateFlowRunShellInput {
    pub actor_user_id: Uuid,
    pub application_id: Uuid,
    pub flow_id: Uuid,
    pub flow_draft_id: Uuid,
    pub run_mode: domain::FlowRunMode,
    pub target_node_id: Option<String>,
    pub status: domain::FlowRunStatus,
    pub input_payload: serde_json::Value,
    pub started_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct AttachCompiledPlanToFlowRunInput {
    pub flow_run_id: Uuid,
    pub compiled_plan_id: Uuid,
    pub status: domain::FlowRunStatus,
}
```

Add trait methods:

```rust
async fn create_flow_run_shell(
    &self,
    input: &CreateFlowRunShellInput,
) -> anyhow::Result<domain::FlowRunRecord>;

async fn attach_compiled_plan_to_flow_run(
    &self,
    input: &AttachCompiledPlanToFlowRunInput,
) -> anyhow::Result<domain::FlowRunRecord>;
```

- [ ] **Step 5: Update storage mapper and repository**

In `api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs`, change stored row and mapper fields:

```rust
pub compiled_plan_id: Option<Uuid>,
```

In `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`, change `map_flow_run_record`:

```rust
compiled_plan_id: row.get::<Option<Uuid>, _>("compiled_plan_id"),
```

Add `create_flow_run_shell` SQL using `null` for `compiled_plan_id`.

Add `attach_compiled_plan_to_flow_run` SQL:

```sql
update flow_runs
set compiled_plan_id = $2,
    status = $3
where id = $1
returning
    id,
    application_id,
    flow_id,
    flow_draft_id,
    compiled_plan_id,
    run_mode,
    target_node_id,
    status,
    input_payload,
    output_payload,
    error_payload,
    created_by,
    started_at,
    finished_at,
    created_at
```

- [ ] **Step 6: Update in-memory test repository**

In `api/crates/control-plane/src/_tests/orchestration_runtime/support/repository.rs`:

1. Store `compiled_plan_id: Option<Uuid>` in flow run records.
2. Implement `create_flow_run_shell`.
3. Implement `attach_compiled_plan_to_flow_run`.
4. Keep existing `create_flow_run` behavior by wrapping `input.compiled_plan_id` with `Some(...)`.

- [ ] **Step 7: Update DTOs for nullable compiled plan**

In `api/apps/api-server/src/routes/applications/application_runtime.rs`, change response DTO:

```rust
pub compiled_plan_id: Option<String>,
```

Change mapper:

```rust
compiled_plan_id: run.compiled_plan_id.map(|value| value.to_string()),
```

In `web/packages/api-client/src/console-application-runtime.ts`, change:

```ts
compiled_plan_id: string | null;
```

Existing frontend tests can keep using string values.

- [ ] **Step 8: Update runtime compiled-plan reads**

For every runtime path that reads a compiled plan from a flow run, unwrap with a domain error:

```rust
let compiled_plan_id = flow_run
    .compiled_plan_id
    .ok_or_else(|| anyhow!("flow run compiled plan is not attached"))?;
let compiled_record = service
    .repository
    .get_compiled_plan(compiled_plan_id)
    .await?
    .ok_or_else(|| anyhow!("compiled plan not found"))?;
```

Apply this in:
- `api/crates/control-plane/src/orchestration_runtime.rs`
- `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`

- [ ] **Step 9: Run targeted tests**

Run:

```bash
cargo test -p storage-postgres creates_flow_run_shell_and_attaches_compiled_plan
cargo test -p control-plane orchestration_runtime
cargo test -p api-server application_runtime
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add api/crates/storage-durable/postgres/migrations/20260502090000_allow_flow_run_shell_compiled_plan.sql \
  api/crates/domain/src/orchestration.rs \
  api/crates/control-plane/src/ports/runtime.rs \
  api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs \
  api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs \
  api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs \
  api/crates/control-plane/src/_tests/orchestration_runtime/support/repository.rs \
  api/crates/control-plane/src/orchestration_runtime.rs \
  api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs \
  api/apps/api-server/src/routes/applications/application_runtime.rs \
  web/packages/api-client/src/console-application-runtime.ts
git commit -m "feat: support queued debug run shells"
```

## Task 5: Split Debug Startup Into Shell and Background Preparation

**Files:**
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`
- Create: `api/crates/control-plane/src/orchestration_runtime/debug_stream_events.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/service.rs`

- [ ] **Step 1: Add service tests for shell start**

In `api/crates/control-plane/src/_tests/orchestration_runtime/service.rs`, add:

```rust
#[tokio::test]
async fn opens_flow_debug_run_shell_without_compiling_plan() {
    let fixture = OrchestrationRuntimeFixture::new().await;
    let service = fixture.service();

    let shell = service
        .open_flow_debug_run_shell(StartFlowDebugRunCommand {
            actor_user_id: fixture.actor_user_id,
            application_id: fixture.application_id,
            input_payload: serde_json::json!({ "node-start": { "query": "hello" } }),
            document_snapshot: None,
        })
        .await
        .unwrap();

    assert_eq!(shell.status, domain::FlowRunStatus::Queued);
    assert_eq!(shell.compiled_plan_id, None);
}
```

- [ ] **Step 2: Run the failing service test**

Run:

```bash
cargo test -p control-plane opens_flow_debug_run_shell_without_compiling_plan
```

Expected: FAIL because `open_flow_debug_run_shell` does not exist.

- [ ] **Step 3: Add stream event helpers**

Create `api/crates/control-plane/src/orchestration_runtime/debug_stream_events.rs`:

```rust
use crate::ports::{RuntimeEventDurability, RuntimeEventPayload, RuntimeEventSource};
use serde_json::json;
use uuid::Uuid;

pub fn flow_accepted(run_id: Uuid) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "flow_accepted".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::Ephemeral,
        persist_required: false,
        trace_visible: false,
        payload: json!({
            "type": "flow_accepted",
            "run_id": run_id,
            "status": "queued"
        }),
    }
}

pub fn flow_started(run_id: Uuid) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "flow_started".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "flow_started",
            "run_id": run_id,
            "status": "running"
        }),
    }
}

pub fn heartbeat() -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "heartbeat".to_string(),
        source: RuntimeEventSource::System,
        durability: RuntimeEventDurability::Ephemeral,
        persist_required: false,
        trace_visible: false,
        payload: json!({ "type": "heartbeat" }),
    }
}
```

Expose `debug_stream_events` from `orchestration_runtime.rs` by adding:

```rust
pub mod debug_stream_events;
```

- [ ] **Step 4: Implement shell opening**

In `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`, add:

```rust
pub(super) async fn open_flow_debug_run_shell<R, H>(
    service: &OrchestrationRuntimeService<R, H>,
    command: StartFlowDebugRunCommand,
) -> Result<domain::FlowRunRecord>
where
    R: crate::ports::ApplicationRepository
        + crate::ports::FlowRepository
        + OrchestrationRuntimeRepository
        + Clone
        + Send
        + Sync
        + 'static,
    H: crate::ports::ProviderRuntimePort
        + crate::capability_plugin_runtime::CapabilityPluginRuntimePort
        + Clone,
{
    let actor = crate::ports::ApplicationRepository::load_actor_context_for_user(
        &service.repository,
        command.actor_user_id,
    )
    .await?;
    let editor_state = FlowService::new(service.repository.clone())
        .get_or_create_editor_state(command.actor_user_id, command.application_id)
        .await?;
    service
        .repository
        .get_application(actor.current_workspace_id, command.application_id)
        .await?
        .ok_or(ControlPlaneError::NotFound("application"))?;

    service
        .repository
        .create_flow_run_shell(&CreateFlowRunShellInput {
            actor_user_id: command.actor_user_id,
            application_id: command.application_id,
            flow_id: editor_state.flow.id,
            flow_draft_id: editor_state.draft.id,
            run_mode: domain::FlowRunMode::DebugFlowRun,
            target_node_id: None,
            status: domain::FlowRunStatus::Queued,
            input_payload: command.input_payload,
            started_at: OffsetDateTime::now_utc(),
        })
        .await
}
```

Expose it through `OrchestrationRuntimeService` in `api/crates/control-plane/src/orchestration_runtime.rs`:

```rust
pub async fn open_flow_debug_run_shell(
    &self,
    command: StartFlowDebugRunCommand,
) -> Result<domain::FlowRunRecord> {
    live_debug_run::open_flow_debug_run_shell(self, command).await
}
```

- [ ] **Step 5: Add background preparation method**

Add a command:

```rust
pub struct PrepareFlowDebugRunCommand {
    pub actor_user_id: Uuid,
    pub application_id: Uuid,
    pub flow_run_id: Uuid,
    pub input_payload: serde_json::Value,
    pub document_snapshot: Option<serde_json::Value>,
}
```

Implement `prepare_flow_debug_run_from_shell` by moving the compile/upsert/audit setup out of `start_flow_debug_run` and changing the final run creation step into:

```rust
let flow_run = service
    .repository
    .attach_compiled_plan_to_flow_run(&AttachCompiledPlanToFlowRunInput {
        flow_run_id: command.flow_run_id,
        compiled_plan_id: compiled_record.id,
        status: domain::FlowRunStatus::Running,
    })
    .await?;
```

Keep `record_gateway_billing_audit` in this background preparation path, after `attach_compiled_plan_to_flow_run`.

Keep `start_flow_debug_run` for the non-stream endpoint by making it call:

```rust
let shell = open_flow_debug_run_shell(service, StartFlowDebugRunCommand { ... }).await?;
prepare_flow_debug_run_from_shell(service, PrepareFlowDebugRunCommand { flow_run_id: shell.id, ... }).await
```

- [ ] **Step 6: Run service tests**

Run:

```bash
cargo test -p control-plane opens_flow_debug_run_shell_without_compiling_plan
cargo test -p control-plane orchestration_runtime
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/crates/control-plane/src/orchestration_runtime.rs \
  api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs \
  api/crates/control-plane/src/orchestration_runtime/debug_stream_events.rs \
  api/crates/control-plane/src/_tests/orchestration_runtime/service.rs
git commit -m "feat: split flow debug run shell startup"
```

## Task 6: Wire Fast-Start SSE to RuntimeEventStream

**Files:**
- Modify: `api/apps/api-server/src/app_state.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/_tests/support/auth.rs`
- Create: `api/apps/api-server/src/routes/applications/debug_run_stream.rs`
- Modify: `api/apps/api-server/src/routes/applications/mod.rs`
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`

- [ ] **Step 1: Add API route test for fast-start**

Create or extend an API server route test under `api/apps/api-server/src/_tests/application/`:

```rust
#[tokio::test]
async fn stream_debug_run_returns_flow_accepted_before_background_compile_finishes() {
    let (state, _database_url) = crate::_tests::support::auth::test_api_state_with_database_url().await;
    let app = crate::app_with_state(state.clone());
    let session = crate::_tests::support::auth::login_root(&app).await;
    let application_id = crate::_tests::support::auth::create_application(&app, &session).await;

    let response = crate::_tests::support::auth::post_json_with_session(
        &app,
        &session,
        &format!("/api/console/applications/{application_id}/orchestration/debug-runs/stream"),
        serde_json::json!({
            "input_payload": { "node-start": { "query": "hello" } }
        }),
    )
    .await;

    assert_eq!(response.status(), axum::http::StatusCode::OK);
    let body = crate::_tests::support::auth::read_first_sse_frame(response).await;
    assert!(body.contains("\"type\":\"flow_accepted\""));
}
```

Use the existing auth route helpers in `api/apps/api-server/src/_tests/support/auth.rs` and add only `read_first_sse_frame` as a small response body reader in the same support module.

- [ ] **Step 2: Run the failing route test**

Run:

```bash
cargo test -p api-server stream_debug_run_returns_flow_accepted_before_background_compile_finishes
```

Expected: FAIL because the stream route still waits for `start_flow_debug_run`.

- [ ] **Step 3: Add runtime event stream to ApiState**

In `api/apps/api-server/src/app_state.rs`, import:

```rust
use control_plane::ports::{OfficialPluginSourcePort, RuntimeEventStream, SessionStore};
```

Add:

```rust
pub runtime_event_stream: Arc<dyn RuntimeEventStream>,
```

In `api/apps/api-server/src/lib.rs` and test state builders, set:

```rust
let runtime_event_stream = infrastructure
    .runtime_event_stream()
    .expect("runtime-event-stream default provider must be registered");
```

and include `runtime_event_stream` in `ApiState`.

- [ ] **Step 4: Create SSE helper module**

Create `api/apps/api-server/src/routes/applications/debug_run_stream.rs`:

```rust
use std::{convert::Infallible, sync::Arc};

use axum::response::sse::Event;
use control_plane::ports::{RuntimeEventEnvelope, RuntimeEventStream};
use tokio::sync::mpsc;
use uuid::Uuid;

pub type DebugRunSseStream =
    tokio_stream::wrappers::ReceiverStream<Result<Event, Infallible>>;

pub fn runtime_event_to_sse(envelope: RuntimeEventEnvelope) -> Result<Event, Infallible> {
    Ok(Event::default()
        .id(envelope.sequence.to_string())
        .event(envelope.event_type)
        .json_data(envelope.payload)
        .expect("runtime event payload should serialize"))
}

pub async fn send_runtime_event_stream(
    stream: Arc<dyn RuntimeEventStream>,
    run_id: Uuid,
    from_sequence: Option<i64>,
    sender: mpsc::Sender<Result<Event, Infallible>>,
) {
    let Ok(mut subscription) = stream.subscribe(run_id, from_sequence).await else {
        let _ = sender
            .send(Ok(Event::default()
                .event("replay_expired")
                .json_data(serde_json::json!({ "type": "replay_expired" }))
                .expect("replay_expired payload should serialize")))
            .await;
        return;
    };

    for event in subscription.replay {
        if sender.send(runtime_event_to_sse(event)).await.is_err() {
            return;
        }
    }

    while let Some(event) = subscription.live_events.recv().await {
        if sender.send(runtime_event_to_sse(event)).await.is_err() {
            return;
        }
    }
}
```

Update `api/apps/api-server/src/routes/applications/mod.rs`:

```rust
pub mod debug_run_stream;
```

- [ ] **Step 5: Rewrite stream route to open SSE immediately**

In `api/apps/api-server/src/routes/applications/application_runtime.rs`, replace the blocking stream route path with:

```rust
use control_plane::ports::RuntimeEventStreamPolicy;

let shell = runtime_service
    .open_flow_debug_run_shell(StartFlowDebugRunCommand {
        actor_user_id: context.user.id,
        application_id: id,
        input_payload: body.input_payload.clone(),
        document_snapshot: body.document.clone(),
    })
    .await?;
let run_id = shell.id;
let workspace_id = context.actor.current_workspace_id;
let actor_user_id = context.user.id;

state
    .runtime_event_stream
    .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
    .await?;
state
    .runtime_event_stream
    .append(run_id, control_plane::orchestration_runtime::debug_stream_events::flow_accepted(run_id))
    .await?;
state
    .runtime_event_stream
    .append(run_id, control_plane::orchestration_runtime::debug_stream_events::heartbeat())
    .await?;

let (sender, receiver) = mpsc::channel(32);
tokio::spawn(debug_run_stream::send_runtime_event_stream(
    state.runtime_event_stream.clone(),
    run_id,
    None,
    sender,
));

let background_state = state.clone();
tokio::spawn(async move {
    let background_service = OrchestrationRuntimeService::new(
        background_state.store.clone(),
        ApiProviderRuntime::new(background_state.provider_runtime.clone()),
        background_state.runtime_engine.clone(),
        background_state.provider_secret_master_key.clone(),
    )
    .with_runtime_event_stream(background_state.runtime_event_stream.clone());

    if let Err(error) = background_service
        .prepare_and_continue_flow_debug_run(
            PrepareFlowDebugRunCommand {
                actor_user_id,
                application_id: id,
                flow_run_id: run_id,
                input_payload: body.input_payload,
                document_snapshot: body.document,
            },
            ContinueFlowDebugRunCommand {
                application_id: id,
                flow_run_id: run_id,
                workspace_id,
            },
        )
        .await
    {
        tracing::error!(application_id = %id, flow_run_id = %run_id, error = %error);
    }
});

Ok(Sse::new(ReceiverStream::new(receiver)).keep_alive(KeepAlive::default()))
```

Add the missing service builder method in `OrchestrationRuntimeService`:

```rust
pub fn with_runtime_event_stream(mut self, stream: Arc<dyn RuntimeEventStream>) -> Self {
    self.runtime_event_stream = Some(stream);
    self
}
```

- [ ] **Step 6: Run the route test**

Run:

```bash
cargo test -p api-server stream_debug_run_returns_flow_accepted_before_background_compile_finishes
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/apps/api-server/src/app_state.rs \
  api/apps/api-server/src/lib.rs \
  api/apps/api-server/src/_tests/support/auth.rs \
  api/apps/api-server/src/routes/applications/debug_run_stream.rs \
  api/apps/api-server/src/routes/applications/mod.rs \
  api/apps/api-server/src/routes/applications/application_runtime.rs
git commit -m "feat: fast start flow debug stream"
```

## Task 7: Emit Runtime Node and Provider Events Directly

**Files:**
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/debug_stream_events.rs`
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`

- [ ] **Step 1: Add control-plane test for direct text_delta emission**

In `api/crates/control-plane/src/_tests/orchestration_runtime/service.rs`, add a test using the in-memory repository and fake runtime:

```rust
#[tokio::test]
async fn live_provider_delta_is_appended_to_runtime_event_stream() {
    let fixture = OrchestrationRuntimeFixture::new().await;
    let stream = std::sync::Arc::new(crate::_tests::support::RecordingRuntimeEventStream::default());
    let service = fixture.service().with_runtime_event_stream(stream.clone());

    let detail = service
        .start_flow_debug_run(StartFlowDebugRunCommand {
            actor_user_id: fixture.actor_user_id,
            application_id: fixture.application_id,
            input_payload: serde_json::json!({ "node-start": { "query": "hello" } }),
            document_snapshot: None,
        })
        .await
        .unwrap();

    service
        .continue_flow_debug_run(ContinueFlowDebugRunCommand {
            application_id: fixture.application_id,
            flow_run_id: detail.flow_run.id,
            workspace_id: fixture.workspace_id,
        })
        .await
        .unwrap();

    assert!(stream
        .events()
        .iter()
        .any(|event| event.event_type == "text_delta"));
}
```

Add `RecordingRuntimeEventStream` to `api/crates/control-plane/src/_tests/support.rs` for this test.

- [ ] **Step 2: Run the failing emission test**

Run:

```bash
cargo test -p control-plane live_provider_delta_is_appended_to_runtime_event_stream
```

Expected: FAIL because runtime execution only sends provider deltas to the old live provider channel.

- [ ] **Step 3: Extend event helper module**

Add to `debug_stream_events.rs`:

```rust
pub fn node_started(node_run: &domain::NodeRunRecord) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "node_started".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "node_started",
            "node_run_id": node_run.id,
            "node_id": node_run.node_id,
            "node_type": node_run.node_type,
            "title": node_run.node_alias,
            "input_payload": node_run.input_payload,
            "started_at": node_run.started_at,
        }),
    }
}

pub fn node_finished(node_run: &domain::NodeRunRecord) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "node_finished".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "node_finished",
            "node_run_id": node_run.id,
            "node_id": node_run.node_id,
            "status": node_run.status.as_str(),
            "output_payload": node_run.output_payload,
            "error_payload": node_run.error_payload,
            "metrics_payload": node_run.metrics_payload,
            "started_at": node_run.started_at,
            "finished_at": node_run.finished_at,
        }),
    }
}

pub fn text_delta(node_id: &str, node_run_id: Uuid, text: String) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "text_delta".to_string(),
        source: RuntimeEventSource::Provider,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: false,
        payload: json!({
            "type": "text_delta",
            "node_run_id": node_run_id,
            "node_id": node_id,
            "text": text,
        }),
    }
}
```

- [ ] **Step 4: Append node lifecycle events from runtime**

In `continue_flow_debug_run_inner`, after `create_node_run`, append:

```rust
if let Some(stream) = &service.runtime_event_stream {
    let _ = stream
        .append(flow_run.id, debug_stream_events::node_started(&node_run))
        .await;
}
```

After each successful `update_node_run`, append `node_finished` with the returned record:

```rust
let finished_node_run = service
    .repository
    .update_node_run(&UpdateNodeRunInput { ... })
    .await?;
if let Some(stream) = &service.runtime_event_stream {
    let _ = stream
        .append(flow_run.id, debug_stream_events::node_finished(&finished_node_run))
        .await;
}
```

- [ ] **Step 5: Append provider deltas to the event stream**

Update `RuntimeProviderInvoker` to carry:

```rust
runtime_event_stream: Option<Arc<dyn RuntimeEventStream>>,
flow_run_id: Option<Uuid>,
```

When forwarding `ProviderStreamEvent::TextDelta { delta }`, append:

```rust
if let Some(stream) = &runtime_event_stream {
    let _ = stream
        .append(
            flow_run_id,
            debug_stream_events::text_delta(&node_id, node_run_id, delta.clone()),
        )
        .await;
}
```

Keep the existing `persist_events` channel during this task; the async persister in Task 8 will take over durable stream-event writes.

- [ ] **Step 6: Remove DB polling from SSE stream path**

In `api/apps/api-server/src/routes/applications/application_runtime.rs`, stop using `send_debug_run_stream_events` for the stream route. Keep non-stream run detail polling behavior unchanged.

Delete or leave unused only after `cargo check` confirms no references:
- `send_debug_run_stream_events`
- `stream_node_started_payload`
- `stream_node_finished_payload`
- `stream_flow_terminal_payload`

Keep `stream_live_provider_event_payload` only if the non-event-stream route still needs it; otherwise remove it in the same commit.

- [ ] **Step 7: Run targeted tests**

Run:

```bash
cargo test -p control-plane live_provider_delta_is_appended_to_runtime_event_stream
cargo test -p api-server stream_debug_run_returns_flow_accepted_before_background_compile_finishes
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/crates/control-plane/src/orchestration_runtime.rs \
  api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs \
  api/crates/control-plane/src/orchestration_runtime/debug_stream_events.rs \
  api/apps/api-server/src/routes/applications/application_runtime.rs
git commit -m "feat: emit debug runtime events directly"
```

## Task 8: Add Async Debug Event Persister

**Files:**
- Create: `api/crates/control-plane/src/orchestration_runtime/debug_event_persister.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`

- [ ] **Step 1: Add persister tests**

In `api/crates/control-plane/src/_tests/orchestration_runtime/service.rs`, add:

```rust
#[tokio::test]
async fn debug_event_persister_coalesces_text_delta_run_events() {
    let repository = crate::_tests::orchestration_runtime::support::repository::InMemoryRuntimeRepository::default();
    let run_id = uuid::Uuid::now_v7();
    let node_run_id = uuid::Uuid::now_v7();
    let events = vec![
        runtime_text_delta(run_id, node_run_id, "退"),
        runtime_text_delta(run_id, node_run_id, "款"),
        runtime_text_delta(run_id, node_run_id, "摘要"),
    ];

    control_plane::orchestration_runtime::persist_debug_stream_events(&repository, events)
        .await
        .unwrap();

    let run_events = repository.run_events_for(run_id);
    assert_eq!(run_events.len(), 1);
    assert_eq!(run_events[0].event_type, "text_delta");
    assert_eq!(run_events[0].payload["text"], "退款摘要");
}
```

Add small test helper `runtime_text_delta` in the same test module.

```rust
fn runtime_text_delta(
    run_id: uuid::Uuid,
    node_run_id: uuid::Uuid,
    text: &str,
) -> control_plane::ports::RuntimeEventEnvelope {
    control_plane::ports::RuntimeEventEnvelope::new(
        run_id,
        1,
        control_plane::ports::RuntimeEventPayload {
            event_type: "text_delta".to_string(),
            source: control_plane::ports::RuntimeEventSource::Provider,
            durability: control_plane::ports::RuntimeEventDurability::DurableRequired,
            persist_required: true,
            trace_visible: false,
            payload: serde_json::json!({
                "type": "text_delta",
                "node_run_id": node_run_id,
                "node_id": "node-llm",
                "text": text,
            }),
        },
    )
}
```

- [ ] **Step 2: Run the failing persister test**

Run:

```bash
cargo test -p control-plane debug_event_persister_coalesces_text_delta_run_events
```

Expected: FAIL because `debug_event_persister` does not exist.

- [ ] **Step 3: Implement persister module**

Create `api/crates/control-plane/src/orchestration_runtime/debug_event_persister.rs`:

```rust
use anyhow::Result;
use crate::ports::{AppendRunEventInput, OrchestrationRuntimeRepository, RuntimeEventEnvelope};
use serde_json::json;

pub async fn persist_debug_stream_events<R>(
    repository: &R,
    events: Vec<RuntimeEventEnvelope>,
) -> Result<()>
where
    R: OrchestrationRuntimeRepository,
{
    let mut run_events = Vec::new();
    let mut pending_text: Option<(uuid::Uuid, Option<uuid::Uuid>, String)> = None;

    for event in events {
        if !event.persist_required {
            continue;
        }

        if event.event_type == "text_delta" {
            let node_run_id = event
                .payload
                .get("node_run_id")
                .and_then(serde_json::Value::as_str)
                .and_then(|value| uuid::Uuid::parse_str(value).ok());
            let text = event
                .payload
                .get("text")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            match &mut pending_text {
                Some((run_id, pending_node_run_id, buffer))
                    if *run_id == event.run_id && *pending_node_run_id == node_run_id =>
                {
                    buffer.push_str(text);
                }
                _ => {
                    flush_pending_text(&mut run_events, pending_text.take());
                    pending_text = Some((event.run_id, node_run_id, text.to_string()));
                }
            }
            continue;
        }

        flush_pending_text(&mut run_events, pending_text.take());
        run_events.push(AppendRunEventInput {
            flow_run_id: event.run_id,
            node_run_id: None,
            event_type: event.event_type,
            payload: event.payload,
        });
    }

    flush_pending_text(&mut run_events, pending_text.take());
    if !run_events.is_empty() {
        repository.append_run_events(&run_events).await?;
    }
    Ok(())
}

fn flush_pending_text(
    run_events: &mut Vec<AppendRunEventInput>,
    pending_text: Option<(uuid::Uuid, Option<uuid::Uuid>, String)>,
) {
    let Some((run_id, node_run_id, text)) = pending_text else {
        return;
    };
    run_events.push(AppendRunEventInput {
        flow_run_id: run_id,
        node_run_id,
        event_type: "text_delta".to_string(),
        payload: json!({ "text": text }),
    });
}
```

Register the module in `orchestration_runtime.rs`:

```rust
mod debug_event_persister;
```

- [ ] **Step 4: Wire persister subscription in background task**

After `open_run`, spawn a persister consumer in the stream route background setup:

```rust
let persister_stream = background_state.runtime_event_stream.clone();
let persister_store = background_state.store.clone();
tokio::spawn(async move {
    let Ok(mut subscription) = persister_stream.subscribe(run_id, Some(0)).await else {
        return;
    };
    let mut batch = subscription.replay;
    while let Some(event) = subscription.live_events.recv().await {
        batch.push(event);
        if batch.len() >= 64 {
            let events = std::mem::take(&mut batch);
            let _ = control_plane::orchestration_runtime::persist_debug_stream_events(
                &persister_store,
                events,
            )
            .await;
        }
    }
    if !batch.is_empty() {
        let _ = control_plane::orchestration_runtime::persist_debug_stream_events(
            &persister_store,
            batch,
        )
        .await;
    }
});
```

Expose a public wrapper in `orchestration_runtime.rs`:

```rust
pub async fn persist_debug_stream_events<R>(
    repository: &R,
    events: Vec<RuntimeEventEnvelope>,
) -> Result<()>
where
    R: OrchestrationRuntimeRepository,
{
    debug_event_persister::persist_debug_stream_events(repository, events).await
}
```

- [ ] **Step 5: Run persister tests**

Run:

```bash
cargo test -p control-plane debug_event_persister_coalesces_text_delta_run_events
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/crates/control-plane/src/orchestration_runtime/debug_event_persister.rs \
  api/crates/control-plane/src/orchestration_runtime.rs \
  api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs \
  api/crates/control-plane/src/_tests/orchestration_runtime/service.rs
git commit -m "feat: persist debug stream events asynchronously"
```

## Task 9: Add First-Token Timing and Provider Hot-Path Metrics

**Files:**
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`
- Modify: `api/apps/api-server/src/provider_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`

- [ ] **Step 1: Add timing assertions to route test logs**

Extend `stream_debug_run_returns_flow_accepted_before_background_compile_finishes` to assert that the first frame is `flow_accepted` and not `flow_started`.

```rust
assert!(body.contains("\"type\":\"flow_accepted\""));
assert!(!body.contains("\"type\":\"flow_started\""));
```

- [ ] **Step 2: Add route timing spans**

In `start_flow_debug_run_stream`, record:

```rust
let request_received_at = std::time::Instant::now();
```

Before returning SSE, log:

```rust
tracing::info!(
    application_id = %id,
    flow_run_id = %run_id,
    http_to_sse_open_ms = request_received_at.elapsed().as_millis() as u64,
    "flow debug stream opened"
);
```

- [ ] **Step 3: Add provider timing spans**

In `RuntimeProviderInvoker::invoke_llm`, wrap provider phases:

```rust
let provider_resolve_started = std::time::Instant::now();
let instance = self.resolve_llm_instance(runtime).await?;
tracing::debug!(
    provider_resolve_ms = provider_resolve_started.elapsed().as_millis() as u64,
    "provider resolve finished"
);
```

Repeat the same pattern for:
- `installation_reconcile_ms`
- `package_load_ms`
- `runtime_config_ms`
- `provider_invoke_ms`

In `api/apps/api-server/src/provider_runtime.rs`, wrap `ensure_loaded`:

```rust
let ensure_loaded_started = std::time::Instant::now();
...
tracing::debug!(
    plugin_id = %installation.plugin_id,
    provider_ensure_loaded_ms = ensure_loaded_started.elapsed().as_millis() as u64,
    "provider ensure_loaded finished"
);
```

- [ ] **Step 4: Avoid provider reload when already loaded**

Change `ProviderRuntimePort for ApiProviderRuntime::ensure_loaded` to call a new host helper that checks whether a plugin is loaded before `reload`. Add the helper in `plugin-runner` if missing:

```rust
if host.is_loaded(&installation.plugin_id) {
    return Ok(());
}
host.load(&installation.installed_path)
    .map(|_| ())
    .map_err(|error| map_framework_error(error, "provider_runtime"))
```

Add a test in `api/apps/api-server/src/_tests/host_infrastructure_tests.rs` or a provider runtime test that invokes `ensure_loaded` twice and asserts the second call does not reload. If `ProviderHost` does not expose counters, add a small unit test around `ProviderHost::is_loaded`.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cargo test -p api-server stream_debug_run_returns_flow_accepted_before_background_compile_finishes
cargo test -p plugin-runner provider_host
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/apps/api-server/src/routes/applications/application_runtime.rs \
  api/apps/api-server/src/provider_runtime.rs \
  api/apps/plugin-runner/src/provider_host.rs \
  api/crates/control-plane/src/orchestration_runtime.rs
git commit -m "perf: add debug stream and provider timing"
```

## Task 10: Update Frontend Stream Protocol and Text Delta Batching

**Files:**
- Modify: `web/packages/api-client/src/console-application-runtime.ts`
- Modify: `web/app/src/features/agent-flow/api/runtime.ts`
- Modify: `web/app/src/features/agent-flow/lib/debug-console/stream-events.ts`
- Modify: `web/app/src/features/agent-flow/hooks/runtime/useAgentFlowDebugSession.ts`
- Modify: `web/app/src/features/agent-flow/_tests/debug-console/use-agent-flow-debug-session-stream.test.tsx`

- [ ] **Step 1: Extend frontend stream tests**

In `web/app/src/features/agent-flow/_tests/debug-console/use-agent-flow-debug-session-stream.test.tsx`, add a test:

```tsx
test('handles flow accepted and batches text deltas without rebuilding variable cache per token', async () => {
  vi.useFakeTimers();
  const queryClient = createQueryClient();
  const startFlowDebugRunStreamSpy = vi
    .spyOn(runtimeApi, 'startFlowDebugRunStream')
    .mockImplementation(async (_applicationId, _input, _csrfToken, handlers) => {
      handlers.onEvent({ type: 'flow_accepted', run_id: 'run-1', status: 'queued' });
      handlers.onEvent({ type: 'flow_started', run_id: 'run-1', status: 'running' });
      handlers.onEvent({ type: 'text_delta', node_id: 'node-llm', text: '退' });
      handlers.onEvent({ type: 'text_delta', node_id: 'node-llm', text: '款' });
      handlers.onEvent({ type: 'flow_finished', run_id: 'run-1', status: 'succeeded', output: { answer: '退款' } });
    });
  const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
  const { result } = renderHook(
    () =>
      useAgentFlowDebugSession({
        applicationId: 'app-1',
        draftId: 'draft-1',
        document
      }),
    { wrapper: createWrapper(queryClient) }
  );

  await act(async () => {
    const promise = result.current.submitPrompt('退款');
    await vi.runOnlyPendingTimersAsync();
    await promise;
  });

  expect(startFlowDebugRunStreamSpy).toHaveBeenCalled();
  expect(result.current.messages.at(-1)).toEqual(
    expect.objectContaining({
      runId: 'run-1',
      status: 'completed',
      content: '退款'
    })
  );
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run the failing frontend test**

Run:

```bash
pnpm --dir web/app test -- --run src/features/agent-flow/_tests/debug-console/use-agent-flow-debug-session-stream.test.tsx
```

Expected: FAIL because `flow_accepted` is not part of the type union and text batching is not implemented.

- [ ] **Step 3: Extend API client event types**

In `web/packages/api-client/src/console-application-runtime.ts`, add:

```ts
| {
    type: 'flow_accepted';
    run_id: string;
    status: 'queued' | 'starting' | string;
  }
| {
    type: 'replay_expired';
  }
```

Keep `heartbeat` as an ignored event.

- [ ] **Step 4: Update stream event reducers**

In `web/app/src/features/agent-flow/lib/debug-console/stream-events.ts`, handle `flow_accepted`:

```ts
case 'flow_accepted':
  return {
    ...message,
    runId: event.run_id,
    status: 'running',
    traceSummary: traceItems
  };
```

For `text_delta`, stop replacing `traceSummary`:

```ts
case 'text_delta':
  return {
    ...message,
    content: `${message.content}${event.text}`
  };
```

For `replay_expired`, return a failed message with a user-facing message:

```ts
case 'replay_expired':
  return {
    ...message,
    status: 'failed',
    content: '调试流已过期，请重新运行。'
  };
```

- [ ] **Step 5: Batch message updates in the hook**

In `web/app/src/features/agent-flow/hooks/runtime/useAgentFlowDebugSession.ts`, add refs:

```ts
const pendingAssistantMessageRef = useRef<AgentFlowDebugMessage | null>(null);
const flushStreamMessageFrameRef = useRef<number | null>(null);
```

Add helper:

```ts
function scheduleAssistantMessageFlush(
  runningMessageId: string,
  nextMessage: AgentFlowDebugMessage
) {
  pendingAssistantMessageRef.current = nextMessage;
  if (flushStreamMessageFrameRef.current !== null) {
    return;
  }
  flushStreamMessageFrameRef.current = window.requestAnimationFrame(() => {
    flushStreamMessageFrameRef.current = null;
    const pending = pendingAssistantMessageRef.current;
    if (!pending) {
      return;
    }
    setStatus(pending.status);
    setMessages((currentMessages) =>
      replaceAssistantMessage(currentMessages, pending, runningMessageId)
    );
  });
}
```

In the stream `onEvent` handler:

1. Only call `setStreamTraceItems` and variable cache merge for node lifecycle events.
2. Call `scheduleAssistantMessageFlush` for `text_delta`.
3. Flush immediately for `flow_finished`, `flow_failed`, and `replay_expired`.

Use:

```ts
const isTraceEvent =
  event.type === 'node_started' || event.type === 'node_finished';
const isTerminalEvent =
  event.type === 'flow_finished' ||
  event.type === 'flow_failed' ||
  event.type === 'replay_expired';
```

- [ ] **Step 6: Clear animation frame on unmount**

In the cleanup effect:

```ts
if (flushStreamMessageFrameRef.current !== null) {
  window.cancelAnimationFrame(flushStreamMessageFrameRef.current);
  flushStreamMessageFrameRef.current = null;
}
pendingAssistantMessageRef.current = null;
```

- [ ] **Step 7: Run frontend tests**

Run:

```bash
pnpm --dir web/app test -- --run src/features/agent-flow/_tests/debug-console/use-agent-flow-debug-session-stream.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/packages/api-client/src/console-application-runtime.ts \
  web/app/src/features/agent-flow/api/runtime.ts \
  web/app/src/features/agent-flow/lib/debug-console/stream-events.ts \
  web/app/src/features/agent-flow/hooks/runtime/useAgentFlowDebugSession.ts \
  web/app/src/features/agent-flow/_tests/debug-console/use-agent-flow-debug-session-stream.test.tsx
git commit -m "feat: batch debug stream frontend updates"
```

## Task 11: Integration Verification and QA Evidence

**Files:**
- Modify only if verification exposes a defect in files changed by Tasks 1-10.

- [ ] **Step 1: Run backend focused checks**

Run:

```bash
cargo test -p control-plane orchestration_runtime
cargo test -p api-server runtime_event_stream_tests
cargo test -p api-server host_infrastructure_tests
cargo test -p api-server stream_debug_run_returns_flow_accepted_before_background_compile_finishes
cargo test -p storage-postgres creates_flow_run_shell_and_attaches_compiled_plan
```

Expected: all PASS.

- [ ] **Step 2: Run frontend focused checks**

Run:

```bash
pnpm --dir web/app test -- --run src/features/agent-flow/_tests/debug-console/use-agent-flow-debug-session-stream.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run compile checks**

Run:

```bash
cargo check -p control-plane
cargo check -p api-server
```

Expected: both PASS.

- [ ] **Step 4: Collect first-token timing evidence**

Start the API server and run one streamed debug run from the Debug Console. Capture logs containing:

```text
http_to_sse_open_ms
provider_resolve_ms
installation_reconcile_ms
package_load_ms
runtime_config_ms
provider_ensure_loaded_ms
provider_invoke_ms
```

Save any warning or coverage output under:

```text
tmp/test-governance/
```

- [ ] **Step 5: QA self-review using qa-evaluation**

Use `qa-evaluation` in task mode and verify:

1. SSE returns `flow_accepted` before background compile finishes.
2. `text_delta` events arrive from `RuntimeEventStream`, not DB polling.
3. `node_started/node_finished` display without 100ms run detail polling.
4. Persister failure produces a diagnosable warning and does not block SSE.
5. Durable run detail converges after `flow_finished`.
6. Frontend text delta does not rebuild variable cache per token.

- [ ] **Step 6: Commit verification fixes only if needed**

If verification required fixes, commit them:

```bash
git add api/crates/control-plane api/crates/storage-durable api/apps/api-server web/packages/api-client web/app
git commit -m "fix: stabilize runtime event stream debug flow"
```

If no fixes were needed, do not create an empty commit.

## Plan Self-Review

Coverage mapping:
- Spec fast-start route: Tasks 4-6.
- `RuntimeEventStream` host contract and local implementation: Tasks 1-3.
- SSE subscriber from event stream: Task 6.
- Runtime node/provider direct events: Task 7.
- Async event persister and text delta coalescing: Task 8.
- Provider hot-path timing/cache: Task 9.
- Frontend event separation and batching: Task 10.
- QA evidence: Task 11.

Boundary checks:
- Core depends on `RuntimeEventStream`, not Redis or concrete cache backends.
- Local implementation lives in `api-server` host infrastructure, not in business services.
- PostgreSQL remains durable truth.
- Redis Streams provider is not part of this plan.
- Existing non-stream debug endpoint remains supported.
