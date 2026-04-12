use std::net::SocketAddr;

use api_server::{app_from_env, init_tracing, parse_bind_addr, DEFAULT_API_SERVER_ADDR};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    init_tracing();

    let addr: SocketAddr = parse_bind_addr(
        std::env::var("API_SERVER_ADDR").ok().as_deref(),
        DEFAULT_API_SERVER_ADDR,
    );

    let listener = TcpListener::bind(addr).await.unwrap();
    let app = app_from_env().await.expect("failed to build api app");
    axum::serve(listener, app).await.unwrap();
}
