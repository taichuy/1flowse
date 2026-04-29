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
