use std::sync::Arc;

use control_plane::ports::SessionStore;
use storage_ephemeral::MemorySessionStore;

use super::{
    CacheStore, DistributedLock, EventBus, HostInfrastructureRegistry, RateLimitStore, TaskQueue,
    SESSION_STORE_NAMESPACE,
};

const LOCAL_PROVIDER_CODE: &str = "local";
const LOCAL_PROVIDER_SOURCE: &str = "local-infra-host";

#[derive(Debug, Default)]
pub struct LocalCacheStore;

impl CacheStore for LocalCacheStore {
    fn provider_code(&self) -> &'static str {
        LOCAL_PROVIDER_CODE
    }
}

#[derive(Debug, Default)]
pub struct LocalDistributedLock;

impl DistributedLock for LocalDistributedLock {
    fn provider_code(&self) -> &'static str {
        LOCAL_PROVIDER_CODE
    }
}

#[derive(Debug, Default)]
pub struct LocalEventBus;

impl EventBus for LocalEventBus {
    fn provider_code(&self) -> &'static str {
        LOCAL_PROVIDER_CODE
    }
}

#[derive(Debug, Default)]
pub struct LocalTaskQueue;

impl TaskQueue for LocalTaskQueue {
    fn provider_code(&self) -> &'static str {
        LOCAL_PROVIDER_CODE
    }
}

#[derive(Debug, Default)]
pub struct LocalRateLimitStore;

impl RateLimitStore for LocalRateLimitStore {
    fn provider_code(&self) -> &'static str {
        LOCAL_PROVIDER_CODE
    }
}

pub fn build_local_host_infrastructure() -> HostInfrastructureRegistry {
    let mut registry = HostInfrastructureRegistry::default();
    registry
        .register_default_provider(
            "storage-ephemeral",
            LOCAL_PROVIDER_CODE,
            LOCAL_PROVIDER_SOURCE,
        )
        .expect("local storage-ephemeral provider registration should be unique");
    registry
        .register_default_provider("cache-store", LOCAL_PROVIDER_CODE, LOCAL_PROVIDER_SOURCE)
        .expect("local cache-store provider registration should be unique");
    registry
        .register_default_provider(
            "distributed-lock",
            LOCAL_PROVIDER_CODE,
            LOCAL_PROVIDER_SOURCE,
        )
        .expect("local distributed-lock provider registration should be unique");
    registry
        .register_default_provider("event-bus", LOCAL_PROVIDER_CODE, LOCAL_PROVIDER_SOURCE)
        .expect("local event-bus provider registration should be unique");
    registry
        .register_default_provider("task-queue", LOCAL_PROVIDER_CODE, LOCAL_PROVIDER_SOURCE)
        .expect("local task-queue provider registration should be unique");
    registry
        .register_default_provider(
            "rate-limit-store",
            LOCAL_PROVIDER_CODE,
            LOCAL_PROVIDER_SOURCE,
        )
        .expect("local rate-limit-store provider registration should be unique");

    registry.set_session_store(
        Arc::new(MemorySessionStore::new(SESSION_STORE_NAMESPACE)) as Arc<dyn SessionStore>
    );
    registry.set_cache_store(Arc::new(LocalCacheStore));
    registry.set_distributed_lock(Arc::new(LocalDistributedLock));
    registry.set_event_bus(Arc::new(LocalEventBus));
    registry.set_task_queue(Arc::new(LocalTaskQueue));
    registry.set_rate_limit_store(Arc::new(LocalRateLimitStore));

    registry
}
