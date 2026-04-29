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
                value.try_into().unwrap_or(StdDuration::MAX)
            }
        })
    }

    fn ttl_is_non_positive(ttl: Option<time::Duration>) -> bool {
        ttl.is_some_and(|value| value <= time::Duration::ZERO)
    }

    async fn get_entry(&self, key: &str) -> Option<CacheEntry> {
        self.cache.get(&self.namespaced_key(key)).await
    }

    async fn set_entry(&self, key: &str, value: serde_json::Value, ttl: Option<time::Duration>) {
        let namespaced_key = self.namespaced_key(key);
        if Self::ttl_is_non_positive(ttl) {
            self.cache.invalidate(&namespaced_key).await;
            return;
        }

        self.cache
            .insert(
                namespaced_key,
                CacheEntry {
                    value,
                    ttl: Self::ttl_to_std(ttl),
                },
            )
            .await;
    }
}

#[async_trait]
impl CacheStore for MokaCacheStore {
    async fn get_json(&self, key: &str) -> anyhow::Result<Option<serde_json::Value>> {
        Ok(self.get_entry(key).await.map(|entry| entry.value))
    }

    async fn set_json(
        &self,
        key: &str,
        value: serde_json::Value,
        ttl: Option<time::Duration>,
    ) -> anyhow::Result<()> {
        self.set_entry(key, value, ttl).await;
        Ok(())
    }

    async fn delete(&self, key: &str) -> anyhow::Result<()> {
        self.cache.invalidate(&self.namespaced_key(key)).await;
        Ok(())
    }

    async fn touch(&self, key: &str, ttl: time::Duration) -> anyhow::Result<bool> {
        let namespaced_key = self.namespaced_key(key);
        if ttl <= time::Duration::ZERO {
            self.cache.invalidate(&namespaced_key).await;
            return Ok(false);
        }

        let Some(entry) = self.cache.get(&namespaced_key).await else {
            return Ok(false);
        };

        self.cache
            .insert(
                namespaced_key,
                CacheEntry {
                    value: entry.value,
                    ttl: Self::ttl_to_std(Some(ttl)),
                },
            )
            .await;
        Ok(true)
    }
}

#[async_trait]
impl EphemeralKvStore for MokaCacheStore {
    async fn set_json(
        &self,
        key: &str,
        value: serde_json::Value,
        ttl: Option<time::Duration>,
    ) -> anyhow::Result<()> {
        self.set_entry(key, value, ttl).await;
        Ok(())
    }

    async fn get_json(&self, key: &str) -> anyhow::Result<Option<serde_json::Value>> {
        Ok(self.get_entry(key).await.map(|entry| entry.value))
    }

    async fn delete(&self, key: &str) -> anyhow::Result<()> {
        self.cache.invalidate(&self.namespaced_key(key)).await;
        Ok(())
    }

    async fn touch(&self, key: &str, ttl: time::Duration) -> anyhow::Result<bool> {
        CacheStore::touch(self, key, ttl).await
    }

    async fn set_if_absent_json(
        &self,
        key: &str,
        value: serde_json::Value,
        ttl: Option<time::Duration>,
    ) -> anyhow::Result<bool> {
        let _guard = self.set_if_absent_guard.lock().await;
        let namespaced_key = self.namespaced_key(key);
        if self.cache.get(&namespaced_key).await.is_some() {
            return Ok(false);
        }

        if Self::ttl_is_non_positive(ttl) {
            self.cache.invalidate(&namespaced_key).await;
            return Ok(true);
        }

        self.cache
            .insert(
                namespaced_key,
                CacheEntry {
                    value,
                    ttl: Self::ttl_to_std(ttl),
                },
            )
            .await;
        Ok(true)
    }
}
