use crate::_tests::support::{
    create_member, create_role, login_and_capture_cookie, replace_member_roles,
    replace_role_permissions, test_app,
};
use axum::{
    body::{to_bytes, Body},
    http::{header, Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn public_auth_sign_in_sets_cookie_and_returns_wrapped_payload() {
    let app = test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/public/auth/providers/password-local/sign-in")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "identifier": "root@example.com",
                        "password": "change-me"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers().get("set-cookie").is_some());

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload["data"]["csrf_token"].is_string());
    assert!(payload["data"]["current_workspace_id"].is_string());
    assert!(payload["data"]["effective_display_role"].is_string());
    assert!(payload["meta"].is_null());
}

#[tokio::test]
async fn public_auth_sign_in_handles_cors_preflight() {
    let app = test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/api/public/auth/providers/password-local/sign-in")
                .header(header::ORIGIN, "http://127.0.0.1:3100")
                .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "content-type")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
        Some(&header::HeaderValue::from_static("http://127.0.0.1:3100"))
    );
    assert!(response
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_METHODS)
        .is_some());
}

#[tokio::test]
async fn console_api_key_create_returns_plaintext_token_once() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_id = create_minimal_model(&app, &cookie, &csrf, "auth_route_api_key_orders").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/api-keys")
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "name": "console route key",
                        "permissions": [
                            {
                                "data_model_id": model_id,
                                "list": true,
                                "get": true,
                                "create": false,
                                "update": false,
                                "delete": false
                            }
                        ]
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    let token = payload["data"]["token"].as_str().unwrap();
    assert!(token.starts_with("dmk_"));
    assert_eq!(payload["data"]["name"], json!("console route key"));
    assert_eq!(payload["data"]["permissions"][0]["list"], json!(true));
    assert!(payload["data"]["token_hash"].is_null());
}

#[tokio::test]
async fn console_api_key_create_requires_session() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/api-keys")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "name": "missing session",
                        "permissions": []
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(payload["code"], json!("not_authenticated"));
}

#[tokio::test]
async fn console_api_key_create_requires_state_model_manage_permission() {
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let member_id = create_member(
        &app,
        &root_cookie,
        &root_csrf,
        "api-key-no-manage",
        "temp-pass",
    )
    .await;
    create_role(&app, &root_cookie, &root_csrf, "api_key_no_manage").await;
    replace_role_permissions(&app, &root_cookie, &root_csrf, "api_key_no_manage", &[]).await;
    replace_member_roles(
        &app,
        &root_cookie,
        &root_csrf,
        &member_id,
        &["api_key_no_manage"],
    )
    .await;
    let (member_cookie, member_csrf) =
        login_and_capture_cookie(&app, "api-key-no-manage", "temp-pass").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/api-keys")
                .header("cookie", member_cookie)
                .header("x-csrf-token", member_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "name": "forbidden key",
                        "permissions": []
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(payload["code"], json!("permission_denied"));
}

async fn create_minimal_model(app: &axum::Router, cookie: &str, csrf: &str, code: &str) -> String {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": code,
                        "title": code
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    payload["data"]["id"].as_str().unwrap().to_string()
}
