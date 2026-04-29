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

    assert_eq!(
        cache.get_json("key").await.unwrap(),
        Some(json!({ "ok": true }))
    );
    assert!(lock
        .acquire("lock", "owner", Duration::seconds(1))
        .await
        .unwrap());
    assert_eq!(
        events.poll("topic").await.unwrap(),
        Some(json!({ "event": true }))
    );
    assert_eq!(
        queue
            .claim("queue", "worker-1", Duration::seconds(1))
            .await
            .unwrap()
            .unwrap()
            .idempotency_key,
        Some("task-key-1".to_string())
    );
    assert!(
        rate_limit
            .consume("key", 10, Duration::seconds(60))
            .await
            .unwrap()
            .allowed
    );
}
