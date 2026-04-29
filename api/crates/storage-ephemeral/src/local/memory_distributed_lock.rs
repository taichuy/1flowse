use async_trait::async_trait;
use control_plane::ports::DistributedLock;

use crate::{LeaseStore, MemoryLeaseStore};

#[derive(Clone)]
pub struct MemoryDistributedLock {
    leases: MemoryLeaseStore,
}

impl MemoryDistributedLock {
    pub fn new(namespace: impl Into<String>) -> Self {
        Self {
            leases: MemoryLeaseStore::new(namespace),
        }
    }
}

#[async_trait]
impl DistributedLock for MemoryDistributedLock {
    async fn acquire(&self, key: &str, owner: &str, ttl: time::Duration) -> anyhow::Result<bool> {
        if ttl <= time::Duration::ZERO {
            return Ok(false);
        }

        self.leases.acquire(key, owner, ttl).await
    }

    async fn renew(&self, key: &str, owner: &str, ttl: time::Duration) -> anyhow::Result<bool> {
        if ttl <= time::Duration::ZERO {
            return Ok(false);
        }

        self.leases.renew(key, owner, ttl).await
    }

    async fn release(&self, key: &str, owner: &str) -> anyhow::Result<bool> {
        self.leases.release(key, owner).await
    }
}
