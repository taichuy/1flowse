extern crate self as storage_redis;

mod in_memory_session_store;
mod session_store;

pub use in_memory_session_store::InMemorySessionStore;
pub use session_store::RedisSessionStore;

pub fn crate_name() -> &'static str {
    "storage-redis"
}

#[cfg(test)]
mod _tests;
