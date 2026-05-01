use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use uuid::Uuid;

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
    async fn open_run(&self, run_id: Uuid, policy: RuntimeEventStreamPolicy) -> anyhow::Result<()>;

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

    async fn close_run(&self, run_id: Uuid, reason: RuntimeEventCloseReason) -> anyhow::Result<()>;

    async fn trim(&self, run_id: Uuid, policy: RuntimeEventTrimPolicy) -> anyhow::Result<()>;
}
