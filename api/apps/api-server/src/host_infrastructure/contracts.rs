pub trait CacheStore: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait DistributedLock: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait EventBus: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait TaskQueue: Send + Sync {
    fn provider_code(&self) -> &'static str;
}

pub trait RateLimitStore: Send + Sync {
    fn provider_code(&self) -> &'static str;
}
