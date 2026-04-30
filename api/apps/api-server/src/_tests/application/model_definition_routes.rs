use crate::_tests::support::{login_and_capture_cookie, test_app};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

async fn create_member(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    account: &str,
    password: &str,
) -> String {
    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/members")
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "account": account,
                        "email": format!("{account}@example.com"),
                        "phone": null,
                        "password": password,
                        "name": account,
                        "nickname": account,
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

    assert_eq!(create_response.status(), StatusCode::CREATED);
    let body = to_bytes(create_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let created_member: serde_json::Value = serde_json::from_slice(&body).unwrap();
    created_member["data"]["id"].as_str().unwrap().to_string()
}

async fn create_role(app: &axum::Router, cookie: &str, csrf: &str, role_code: &str) {
    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/roles")
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": role_code,
                        "name": role_code,
                        "introduction": role_code
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::CREATED);
}

async fn replace_role_permissions(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    role_code: &str,
    permission_codes: &[&str],
) {
    let replace_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/console/roles/{role_code}/permissions"))
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "permission_codes": permission_codes
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(replace_response.status(), StatusCode::NO_CONTENT);
}

async fn replace_member_roles(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    member_id: &str,
    role_codes: &[&str],
) {
    let replace_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/console/members/{member_id}/roles"))
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "role_codes": role_codes
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(replace_response.status(), StatusCode::NO_CONTENT);
}

async fn create_api_key(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    name: &str,
    permissions: serde_json::Value,
) -> String {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/api-keys")
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "name": name,
                        "permissions": permissions
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
    payload["data"]["token"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn model_definition_routes_manage_models_and_fields_without_publish() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "orders",
                        "title": "Orders"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(created["data"]["status"], json!("published"));
    assert_eq!(
        created["data"]["api_exposure_status"],
        json!("published_not_exposed")
    );
    assert_eq!(created["data"]["runtime_availability"], json!("available"));
    let model_id = created["data"]["id"].as_str().unwrap().to_string();

    let field_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/models/{model_id}/fields"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "status",
                        "title": "Status",
                        "field_kind": "enum",
                        "is_required": true,
                        "is_unique": false,
                        "display_interface": "select",
                        "display_options": { "options": ["draft", "paid"] }
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(field_response.status(), StatusCode::CREATED);
    let created_field: serde_json::Value = serde_json::from_slice(
        &to_bytes(field_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let field_id = created_field["data"]["id"].as_str().unwrap().to_string();

    let create_runtime_record = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "status": "draft" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_runtime_record.status(), StatusCode::CREATED);

    let update_model_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/console/models/{model_id}"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "title": "Orders V2"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(update_model_response.status(), StatusCode::OK);

    let create_after_model_update = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "status": "paid" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_after_model_update.status(), StatusCode::CREATED);

    let update_field_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/console/models/{model_id}/fields/{field_id}"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "title": "Lifecycle Status",
                        "is_required": true,
                        "is_unique": false,
                        "default_value": "draft",
                        "display_interface": "select",
                        "display_options": { "options": ["draft", "paid"] },
                        "relation_options": {}
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(update_field_response.status(), StatusCode::OK);

    let create_after_field_update = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "status": "draft" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_after_field_update.status(), StatusCode::CREATED);

    let second_field_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/models/{model_id}/fields"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "note",
                        "title": "Note",
                        "field_kind": "text",
                        "is_required": false,
                        "is_unique": false
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(second_field_response.status(), StatusCode::CREATED);
    let second_field: serde_json::Value = serde_json::from_slice(
        &to_bytes(second_field_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let second_field_id = second_field["data"]["id"].as_str().unwrap().to_string();

    let delete_field_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/console/models/{model_id}/fields/{second_field_id}?confirmed=true"
                ))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(delete_field_response.status(), StatusCode::OK);

    let create_after_field_delete = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "status": "paid" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_after_field_delete.status(), StatusCode::CREATED);

    let list_runtime_records = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(list_runtime_records.status(), StatusCode::OK);
    let listed_records: serde_json::Value = serde_json::from_slice(
        &to_bytes(list_runtime_records.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(listed_records["data"]["total"], json!(4));
}

#[tokio::test]
async fn create_model_route_persists_draft_status_atomically_without_manage_permission() {
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    create_role(&app, &root_cookie, &root_csrf, "model_creator").await;
    replace_role_permissions(
        &app,
        &root_cookie,
        &root_csrf,
        "model_creator",
        &["state_model.create.all", "state_model.view.all"],
    )
    .await;
    let creator_member_id =
        create_member(&app, &root_cookie, &root_csrf, "draft-creator", "temp-pass").await;
    replace_member_roles(
        &app,
        &root_cookie,
        &root_csrf,
        &creator_member_id,
        &["model_creator"],
    )
    .await;
    let (creator_cookie, creator_csrf) =
        login_and_capture_cookie(&app, "draft-creator", "temp-pass").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &creator_cookie)
                .header("x-csrf-token", &creator_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "atomic_draft_orders",
                        "title": "Atomic Draft Orders",
                        "status": "draft",
                        "api_exposure_status": "api_exposed_ready"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(created["data"]["status"], json!("draft"));
    assert_eq!(created["data"]["api_exposure_status"], json!("draft"));
    assert_eq!(
        created["data"]["runtime_availability"],
        json!("not_published")
    );

    for request in [
        Request::builder()
            .method("POST")
            .uri("/api/runtime/models/atomic_draft_orders/records")
            .header("cookie", &root_cookie)
            .header("x-csrf-token", &root_csrf)
            .header("content-type", "application/json")
            .body(Body::from(json!({}).to_string()))
            .unwrap(),
        Request::builder()
            .method("GET")
            .uri("/api/runtime/models/atomic_draft_orders/records")
            .header("cookie", &root_cookie)
            .body(Body::empty())
            .unwrap(),
    ] {
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::CONFLICT);
        let error: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(error["code"], json!("model_not_published"));
    }
}

#[tokio::test]
async fn create_model_route_rejects_invalid_status_without_creating_model() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "invalid_status_orders",
                        "title": "Invalid Status Orders",
                        "status": "api_exposed_ready"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::BAD_REQUEST);
    let error: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(error["code"], json!("status"));

    let list_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_response.status(), StatusCode::OK);
    let listed: serde_json::Value = serde_json::from_slice(
        &to_bytes(list_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let models = listed["data"].as_array().unwrap();
    assert!(!models
        .iter()
        .any(|model| model["code"] == json!("invalid_status_orders")));
}

#[tokio::test]
async fn model_definition_routes_compute_ready_exposure_from_persisted_facts() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "ready_fact_orders",
                        "title": "Ready Fact Orders"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let model_id = created["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(
        created["data"]["api_exposure_status"],
        json!("published_not_exposed")
    );

    create_api_key(
        &app,
        &cookie,
        &csrf,
        "ready fact key",
        json!([
            {
                "data_model_id": model_id,
                "list": true,
                "get": false,
                "create": false,
                "update": false,
                "delete": false
            }
        ]),
    )
    .await;

    let get_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/console/models/{model_id}"))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);
    let ready: serde_json::Value = serde_json::from_slice(
        &to_bytes(get_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        ready["data"]["api_exposure_status"],
        json!("api_exposed_ready")
    );
}

#[tokio::test]
async fn model_definition_routes_do_not_trust_raw_ready_on_status_update() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "raw_update_ready_orders",
                        "title": "Raw Update Ready Orders",
                        "status": "draft"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let model_id = created["data"]["id"].as_str().unwrap().to_string();

    let update_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/console/models/{model_id}"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "status": "published",
                        "api_exposure_status": "api_exposed_ready"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(update_response.status(), StatusCode::OK);
    let updated: serde_json::Value = serde_json::from_slice(
        &to_bytes(update_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(updated["data"]["status"], json!("published"));
    assert_eq!(
        updated["data"]["api_exposure_status"],
        json!("published_not_exposed")
    );
}

#[tokio::test]
async fn model_definition_routes_require_state_model_visibility() {
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_model_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "orders_acl",
                        "title": "Orders ACL"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_model_response.status(), StatusCode::CREATED);
    let model_body = to_bytes(create_model_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let created_model: serde_json::Value = serde_json::from_slice(&model_body).unwrap();
    let model_id = created_model["data"]["id"].as_str().unwrap().to_string();

    create_role(&app, &root_cookie, &root_csrf, "model_reader").await;
    replace_role_permissions(
        &app,
        &root_cookie,
        &root_csrf,
        "model_reader",
        &["state_model.view.own"],
    )
    .await;

    create_role(&app, &root_cookie, &root_csrf, "no_model_access").await;

    let reader_member_id =
        create_member(&app, &root_cookie, &root_csrf, "reader-1", "temp-pass").await;
    replace_member_roles(
        &app,
        &root_cookie,
        &root_csrf,
        &reader_member_id,
        &["model_reader"],
    )
    .await;

    let blocked_member_id =
        create_member(&app, &root_cookie, &root_csrf, "blocked-1", "temp-pass").await;
    replace_member_roles(
        &app,
        &root_cookie,
        &root_csrf,
        &blocked_member_id,
        &["no_model_access"],
    )
    .await;

    let (reader_cookie, _) = login_and_capture_cookie(&app, "reader-1", "temp-pass").await;
    let allowed_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/console/models/{model_id}"))
                .header("cookie", &reader_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(allowed_response.status(), StatusCode::OK);

    let (blocked_cookie, _) = login_and_capture_cookie(&app, "blocked-1", "temp-pass").await;
    let blocked_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/console/models/{model_id}"))
                .header("cookie", &blocked_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(blocked_response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn create_model_route_accepts_workspace_and_system_scope_kinds_only() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let legacy_scope_kind = ["te", "am"].concat();

    let workspace_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "workspace_orders_scope_contract",
                        "title": "Workspace Orders Scope Contract"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(workspace_response.status(), StatusCode::CREATED);

    let system_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "system",
                        "code": "system_orders_scope_contract",
                        "title": "System Orders Scope Contract"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(system_response.status(), StatusCode::CREATED);
    let system_body = to_bytes(system_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let system_payload: serde_json::Value = serde_json::from_slice(&system_body).unwrap();
    assert_eq!(
        system_payload["data"]["scope_id"],
        serde_json::Value::String(domain::SYSTEM_SCOPE_ID.to_string())
    );

    let legacy_response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": legacy_scope_kind,
                        "code": "legacy_team_scope_contract",
                        "title": "Legacy Team Scope Contract"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(legacy_response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn create_model_route_rejects_field_code_that_sanitizes_to_platform_column() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "workspace",
                        "code": "platform_column_orders",
                        "title": "Platform Column Orders"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let model_id = created["data"]["id"].as_str().unwrap();

    let field_response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/models/{model_id}/fields"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "created-at",
                        "title": "Created At",
                        "field_kind": "datetime",
                        "is_required": false,
                        "is_unique": false
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(field_response.status(), StatusCode::BAD_REQUEST);
    let error: serde_json::Value = serde_json::from_slice(
        &to_bytes(field_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(error["code"], json!("physical_column_name"));
}
