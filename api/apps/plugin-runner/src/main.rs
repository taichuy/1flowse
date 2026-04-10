use std::net::SocketAddr;

use plugin_runner::{app, init_tracing};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    init_tracing();

    let addr: SocketAddr = std::env::var("PLUGIN_RUNNER_ADDR")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or_else(|| "127.0.0.1:3001".parse().unwrap());

    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app()).await.unwrap();
}
