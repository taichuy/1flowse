pub mod account_pool;
pub mod billing_session;
pub mod fail_safe;
pub mod idempotency;
pub mod route_trace;

pub use account_pool::{select_provider_account, ProviderAccountCandidate};
pub use billing_session::{BillingSessionState, BillingSessionTransition};
pub use fail_safe::{decide_fail_safe, FailSafeDecision};
pub use idempotency::IdempotencyStatus;
pub use route_trace::GatewayRouteTrace;

pub fn crate_name() -> &'static str {
    "publish-gateway"
}

#[cfg(test)]
mod _tests;
