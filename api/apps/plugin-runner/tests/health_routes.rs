use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use plugin_runner::app;
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn runner_health_route_returns_ok_payload() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(payload["service"], "plugin-runner");
    assert_eq!(payload["status"], "ok");
}
