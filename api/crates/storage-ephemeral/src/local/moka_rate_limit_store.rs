use std::{
    sync::Arc,
    time::{Duration as StdDuration, Instant},
};

use async_trait::async_trait;
use control_plane::ports::{RateLimitDecision, RateLimitStore};
use moka::{future::Cache, Expiry};
use time::OffsetDateTime;
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
struct RateLimitWindow {
    count: u64,
    reset_at: OffsetDateTime,
}

struct RateLimitWindowExpiry;

impl Expiry<String, RateLimitWindow> for RateLimitWindowExpiry {
    fn expire_after_create(
        &self,
        _key: &String,
        value: &RateLimitWindow,
        _created_at: Instant,
    ) -> Option<StdDuration> {
        std_duration_until(value.reset_at)
    }

    fn expire_after_update(
        &self,
        _key: &String,
        value: &RateLimitWindow,
        _updated_at: Instant,
        _duration_until_expiry: Option<StdDuration>,
    ) -> Option<StdDuration> {
        std_duration_until(value.reset_at)
    }
}

#[derive(Clone)]
pub struct MokaRateLimitStore {
    namespace: String,
    cache: Cache<String, RateLimitWindow>,
    update_guard: Arc<Mutex<()>>,
}

impl MokaRateLimitStore {
    pub fn new(namespace: impl Into<String>, max_capacity: u64) -> Self {
        Self {
            namespace: namespace.into(),
            cache: Cache::builder()
                .max_capacity(max_capacity)
                .expire_after(RateLimitWindowExpiry)
                .build(),
            update_guard: Arc::new(Mutex::new(())),
        }
    }

    fn namespaced_key(&self, key: &str) -> String {
        format!("{}:{}", self.namespace, key)
    }
}

#[async_trait]
impl RateLimitStore for MokaRateLimitStore {
    async fn consume(
        &self,
        key: &str,
        limit: u64,
        window: time::Duration,
    ) -> anyhow::Result<RateLimitDecision> {
        let _guard = self.update_guard.lock().await;
        let namespaced_key = self.namespaced_key(key);
        let now = OffsetDateTime::now_utc();
        let reset_at = if window <= time::Duration::ZERO {
            now
        } else {
            now + window
        };
        let mut current = self
            .cache
            .get(&namespaced_key)
            .await
            .filter(|entry| entry.reset_at > now)
            .unwrap_or(RateLimitWindow { count: 0, reset_at });

        let allowed = limit > 0 && current.count < limit;
        if allowed {
            current.count += 1;
        }

        let remaining = limit.saturating_sub(current.count).min(limit);
        let reset_after_ms = (current.reset_at - now).whole_milliseconds().max(0) as u64;
        self.cache.insert(namespaced_key, current).await;

        Ok(RateLimitDecision {
            allowed,
            remaining,
            reset_after_ms,
        })
    }

    async fn reset(&self, key: &str) -> anyhow::Result<()> {
        self.cache.invalidate(&self.namespaced_key(key)).await;
        Ok(())
    }
}

fn std_duration_until(deadline: OffsetDateTime) -> Option<StdDuration> {
    let ttl = deadline - OffsetDateTime::now_utc();
    if ttl <= time::Duration::ZERO {
        Some(StdDuration::ZERO)
    } else {
        ttl.try_into().ok()
    }
}
