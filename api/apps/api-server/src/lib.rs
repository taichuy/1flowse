use std::net::SocketAddr;

use axum::{routing::get, Json, Router};
use serde::Serialize;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

pub const DEFAULT_API_SERVER_ADDR: &str = "0.0.0.0:7800";

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HealthResponse {
    pub service: &'static str,
    pub status: &'static str,
    pub version: &'static str,
}

#[utoipa::path(get, path = "/health", responses((status = 200, body = HealthResponse)))]
async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "api-server",
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

#[utoipa::path(
    get,
    path = "/api/console/health",
    responses((status = 200, body = HealthResponse))
)]
async fn console_health() -> Json<HealthResponse> {
    health().await
}

#[derive(OpenApi)]
#[openapi(
    paths(health, console_health),
    components(schemas(HealthResponse)),
    info(title = "1Flowse API", version = "0.1.0")
)]
pub struct ApiDoc;

pub fn parse_bind_addr(candidate: Option<&str>, default_addr: &str) -> SocketAddr {
    candidate
        .and_then(|value| value.parse().ok())
        .unwrap_or_else(|| default_addr.parse().unwrap())
}

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/console/health", get(console_health))
        .merge(SwaggerUi::new("/docs").url("/openapi.json", ApiDoc::openapi()))
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
    use super::{parse_bind_addr, DEFAULT_API_SERVER_ADDR};

    #[test]
    fn parse_bind_addr_uses_new_default_api_port() {
        let addr = parse_bind_addr(None, DEFAULT_API_SERVER_ADDR);

        assert_eq!(addr.to_string(), "0.0.0.0:7800");
    }

    #[test]
    fn parse_bind_addr_falls_back_when_value_is_invalid() {
        let addr = parse_bind_addr(Some("not-an-addr"), DEFAULT_API_SERVER_ADDR);

        assert_eq!(addr.to_string(), "0.0.0.0:7800");
    }
}
