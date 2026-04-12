use std::net::SocketAddr;

use axum::{routing::get, Json, Router};
use serde::Serialize;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub const DEFAULT_PLUGIN_RUNNER_ADDR: &str = "127.0.0.1:7801";

#[derive(Debug, Clone, Serialize)]
pub struct HealthResponse {
    pub service: &'static str,
    pub status: &'static str,
    pub version: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "plugin-runner",
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

pub fn parse_bind_addr(candidate: Option<&str>, default_addr: &str) -> SocketAddr {
    candidate
        .and_then(|value| value.parse().ok())
        .unwrap_or_else(|| default_addr.parse().unwrap())
}

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

pub fn init_tracing() {
    let _ = tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .try_init();
}

#[cfg(test)]
mod tests {
    use super::{parse_bind_addr, DEFAULT_PLUGIN_RUNNER_ADDR};

    #[test]
    fn parse_bind_addr_uses_runner_default_port() {
        let addr = parse_bind_addr(None, DEFAULT_PLUGIN_RUNNER_ADDR);

        assert_eq!(addr.to_string(), "127.0.0.1:7801");
    }

    #[test]
    fn parse_bind_addr_keeps_valid_override() {
        let addr = parse_bind_addr(Some("127.0.0.1:8899"), DEFAULT_PLUGIN_RUNNER_ADDR);

        assert_eq!(addr.to_string(), "127.0.0.1:8899");
    }
}
