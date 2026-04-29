use std::sync::Arc;

use control_plane::ports::SessionStore;
use storage_ephemeral::{
    MemoryDistributedLock, MemoryEventBus, MemoryTaskQueue, MokaCacheStore, MokaRateLimitStore,
    MokaSessionStore,
};

use super::{
    CacheStore, DistributedLock, EventBus, HostInfrastructureRegistry, RateLimitStore, TaskQueue,
    SESSION_STORE_NAMESPACE,
};

const LOCAL_PROVIDER_CODE: &str = "local";
const LOCAL_PROVIDER_SOURCE: &str = "local-infra-host";
const CACHE_STORE_NAMESPACE: &str = "flowbase:cache";
const RATE_LIMIT_STORE_NAMESPACE: &str = "flowbase:rate-limit";
const LOCK_NAMESPACE: &str = "flowbase:lock";
const TASK_QUEUE_NAMESPACE: &str = "flowbase:task";
const LOCAL_CACHE_MAX_CAPACITY: u64 = 10_000;

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

    registry.set_session_store(Arc::new(MokaSessionStore::new(
        SESSION_STORE_NAMESPACE,
        LOCAL_CACHE_MAX_CAPACITY,
    )) as Arc<dyn SessionStore>);
    registry.set_cache_store(Arc::new(MokaCacheStore::new(
        CACHE_STORE_NAMESPACE,
        LOCAL_CACHE_MAX_CAPACITY,
    )) as Arc<dyn CacheStore>);
    registry.set_distributed_lock(
        Arc::new(MemoryDistributedLock::new(LOCK_NAMESPACE)) as Arc<dyn DistributedLock>
    );
    registry.set_event_bus(Arc::new(MemoryEventBus::new()) as Arc<dyn EventBus>);
    registry
        .set_task_queue(Arc::new(MemoryTaskQueue::new(TASK_QUEUE_NAMESPACE)) as Arc<dyn TaskQueue>);
    registry.set_rate_limit_store(Arc::new(MokaRateLimitStore::new(
        RATE_LIMIT_STORE_NAMESPACE,
        LOCAL_CACHE_MAX_CAPACITY,
    )) as Arc<dyn RateLimitStore>);

    registry
}
