use crate::_tests::support::{login_and_capture_cookie, test_app};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn role_routes_create_replace_permissions_and_protect_root() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/roles")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "qa",
                        "name": "QA",
                        "introduction": "qa role"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::CREATED);

    let replace_permissions_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/console/roles/qa/permissions")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "permission_codes": [
                            "route_page.view.all",
                            "application.edit.own"
                        ]
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        replace_permissions_response.status(),
        StatusCode::NO_CONTENT
    );

    let role_permissions_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/roles/qa/permissions")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(role_permissions_response.status(), StatusCode::OK);
    let body = to_bytes(role_permissions_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["role_code"].as_str(), Some("qa"));

    let protect_root_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/console/roles/root/permissions")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "permission_codes": ["team.configure.all"]
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(protect_root_response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn root_can_login_create_member_create_role_and_bind_permissions() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root@example.com", "change-me").await;

    let member_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/members")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "account": "qa-1",
                        "email": "qa-1@example.com",
                        "phone": null,
                        "password": "temp-pass",
                        "name": "QA 1",
                        "nickname": "QA 1",
                        "introduction": "",
                        "email_login_enabled": true,
                        "phone_login_enabled": false
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(member_response.status(), StatusCode::CREATED);

    let role_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/roles")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "viewer",
                        "name": "Viewer",
                        "introduction": "viewer role"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(role_response.status(), StatusCode::CREATED);

    let bind_permissions_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/console/roles/viewer/permissions")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "permission_codes": ["route_page.view.all"]
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(bind_permissions_response.status(), StatusCode::NO_CONTENT);

    let permissions_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/permissions")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(permissions_response.status(), StatusCode::OK);
}
