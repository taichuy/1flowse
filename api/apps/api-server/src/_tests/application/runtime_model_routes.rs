use crate::_tests::support::{login_and_capture_cookie, test_app, test_app_with_database_url};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

async fn current_workspace_id(app: &axum::Router, cookie: &str) -> String {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/session")
                .header("cookie", cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    payload["data"]["session"]["current_workspace_id"]
        .as_str()
        .unwrap()
        .to_string()
}

async fn grant_model_to_scope(
    database_url: &str,
    model_id: &str,
    scope_kind: &str,
    scope_id: &str,
    permission_profile: &str,
) {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    sqlx::query(
        r#"
        insert into scope_data_model_grants (
            id,
            scope_kind,
            scope_id,
            data_model_id,
            enabled,
            permission_profile,
            created_by
        )
        values ($1, $2, $3, $4, true, $5, null)
        on conflict (scope_kind, scope_id, data_model_id)
        do update set enabled = excluded.enabled,
                      permission_profile = excluded.permission_profile,
                      updated_at = now()
        "#,
    )
    .bind(uuid::Uuid::now_v7())
    .bind(scope_kind)
    .bind(uuid::Uuid::parse_str(scope_id).unwrap())
    .bind(uuid::Uuid::parse_str(model_id).unwrap())
    .bind(permission_profile)
    .execute(&pool)
    .await
    .unwrap();
}

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

#[tokio::test]
async fn runtime_model_routes_create_fetch_update_delete_and_filter_records() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let workspace_id = current_workspace_id(&app, &cookie).await;
    let model_id = create_orders_model(&app, &cookie, &csrf).await;
    grant_model_to_scope(
        &database_url,
        &model_id,
        "workspace",
        &workspace_id,
        "scope_all",
    )
    .await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;
    create_enum_field(&app, &cookie, &csrf, &model_id, "status").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "title": "A-001", "status": "draft" }).to_string(),
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
    let record_id = created["data"]["id"].as_str().unwrap().to_string();

    let list_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/orders/records?filter=status:eq:draft&sort=title:desc")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(list_response.status(), StatusCode::OK);

    let get_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/runtime/models/orders/records/{record_id}"))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);

    let update_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/runtime/models/orders/records/{record_id}"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "title": "A-001-UPDATED", "status": "draft" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_response.status(), StatusCode::OK);

    let delete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/runtime/models/orders/records/{record_id}"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_response.status(), StatusCode::OK);

    drop_runtime_table(&database_url, &model_id).await;

    let unavailable_response = app
        .clone()
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

    assert_eq!(unavailable_response.status(), StatusCode::CONFLICT);
    let unavailable_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(unavailable_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        unavailable_payload["code"],
        json!("runtime_model_unavailable")
    );
}

#[tokio::test]
async fn runtime_model_routes_apply_persisted_scope_all_grant_for_session_actors() {
    let (app, database_url) = test_app_with_database_url().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let workspace_id = current_workspace_id(&app, &root_cookie).await;
    let model_id = create_orders_model(&app, &root_cookie, &root_csrf).await;
    grant_model_to_scope(
        &database_url,
        &model_id,
        "workspace",
        &workspace_id,
        "scope_all",
    )
    .await;
    create_text_field(&app, &root_cookie, &root_csrf, &model_id, "title").await;
    create_enum_field(&app, &root_cookie, &root_csrf, &model_id, "status").await;

    let _manager_member_id =
        create_member(&app, &root_cookie, &root_csrf, "manager-acl", "temp-pass").await;
    let admin_member_id =
        create_member(&app, &root_cookie, &root_csrf, "admin-acl", "temp-pass").await;
    replace_member_roles(&app, &root_cookie, &root_csrf, &admin_member_id, &["admin"]).await;

    let (manager_cookie, manager_csrf) =
        login_and_capture_cookie(&app, "manager-acl", "temp-pass").await;
    let (admin_cookie, admin_csrf) = login_and_capture_cookie(&app, "admin-acl", "temp-pass").await;

    let manager_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &manager_cookie)
                .header("x-csrf-token", &manager_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "title": "manager-order", "status": "draft" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(manager_create.status(), StatusCode::CREATED);
    let manager_record_body = to_bytes(manager_create.into_body(), usize::MAX)
        .await
        .unwrap();
    let manager_record: serde_json::Value = serde_json::from_slice(&manager_record_body).unwrap();
    let manager_record_id = manager_record["data"]["id"].as_str().unwrap().to_string();

    let admin_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "title": "admin-order", "status": "paid" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(admin_create.status(), StatusCode::CREATED);
    let admin_record_body = to_bytes(admin_create.into_body(), usize::MAX)
        .await
        .unwrap();
    let admin_record: serde_json::Value = serde_json::from_slice(&admin_record_body).unwrap();
    let admin_record_id = admin_record["data"]["id"].as_str().unwrap().to_string();

    let root_create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "title": "root-order", "status": "draft" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(root_create.status(), StatusCode::CREATED);

    let manager_list = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &manager_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(manager_list.status(), StatusCode::OK);
    let manager_list_body = to_bytes(manager_list.into_body(), usize::MAX)
        .await
        .unwrap();
    let manager_list_payload: serde_json::Value =
        serde_json::from_slice(&manager_list_body).unwrap();
    assert_eq!(manager_list_payload["data"]["total"], json!(3));

    let admin_list = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(admin_list.status(), StatusCode::OK);
    let admin_list_body = to_bytes(admin_list.into_body(), usize::MAX).await.unwrap();
    let admin_list_payload: serde_json::Value = serde_json::from_slice(&admin_list_body).unwrap();
    assert_eq!(admin_list_payload["data"]["total"], json!(3));

    let root_list = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/orders/records")
                .header("cookie", &root_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(root_list.status(), StatusCode::OK);
    let root_list_body = to_bytes(root_list.into_body(), usize::MAX).await.unwrap();
    let root_list_payload: serde_json::Value = serde_json::from_slice(&root_list_body).unwrap();
    assert_eq!(root_list_payload["data"]["total"], json!(3));

    let manager_get = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/runtime/models/orders/records/{admin_record_id}"
                ))
                .header("cookie", &manager_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(manager_get.status(), StatusCode::OK);

    let admin_get = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/runtime/models/orders/records/{manager_record_id}"
                ))
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(admin_get.status(), StatusCode::OK);

    let root_get = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/runtime/models/orders/records/{admin_record_id}"
                ))
                .header("cookie", &root_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(root_get.status(), StatusCode::OK);
}

#[tokio::test]
async fn runtime_model_routes_gate_crud_by_model_status_changes() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let workspace_id = current_workspace_id(&app, &cookie).await;
    let model_code = "status_route_orders";
    let model_id = create_model_with_status(&app, &cookie, &csrf, model_code, Some("draft")).await;
    grant_model_to_scope(
        &database_url,
        &model_id,
        "workspace",
        &workspace_id,
        "scope_all",
    )
    .await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;

    assert_runtime_crud_blocked(
        &app,
        &cookie,
        &csrf,
        model_code,
        StatusCode::CONFLICT,
        "model_not_published",
    )
    .await;

    let published = update_model_status(&app, &cookie, &csrf, &model_id, "published").await;
    assert_eq!(published["data"]["status"], json!("published"));
    assert_eq!(
        published["data"]["runtime_availability"],
        json!("available")
    );

    let created = create_runtime_record(&app, &cookie, &csrf, model_code, "created").await;
    let record_id = created["data"]["id"].as_str().unwrap().to_string();

    let get_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/runtime/models/{model_code}/records/{record_id}"
                ))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);

    let disabled = update_model_status(&app, &cookie, &csrf, &model_id, "disabled").await;
    assert_eq!(disabled["data"]["status"], json!("disabled"));
    assert_eq!(disabled["data"]["runtime_availability"], json!("disabled"));

    assert_runtime_crud_blocked(
        &app,
        &cookie,
        &csrf,
        model_code,
        StatusCode::CONFLICT,
        "model_disabled",
    )
    .await;

    let broken = update_model_status(&app, &cookie, &csrf, &model_id, "broken").await;
    assert_eq!(broken["data"]["status"], json!("broken"));
    assert_eq!(broken["data"]["runtime_availability"], json!("broken"));

    assert_runtime_crud_blocked(
        &app,
        &cookie,
        &csrf,
        model_code,
        StatusCode::CONFLICT,
        "model_broken",
    )
    .await;
}

#[tokio::test]
async fn runtime_model_routes_use_default_scope_id_for_system_model_crud() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "system_route_orders";
    let model_id = create_system_model(&app, &cookie, &csrf, model_code).await;
    grant_model_to_scope(
        &database_url,
        &model_id,
        "system",
        &domain::SYSTEM_SCOPE_ID.to_string(),
        "scope_all",
    )
    .await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;

    create_runtime_record(&app, &cookie, &csrf, model_code, "system scoped").await;

    let durable = storage_durable::build_main_durable_postgres(&database_url)
        .await
        .unwrap();
    let pool = durable.store;
    let physical_table_name: String =
        sqlx::query_scalar("select physical_table_name from model_definitions where id = $1")
            .bind(uuid::Uuid::parse_str(&model_id).unwrap())
            .fetch_one(pool.pool())
            .await
            .unwrap();
    let scope_id: uuid::Uuid = sqlx::query_scalar(&format!(
        "select scope_id from \"{physical_table_name}\" limit 1"
    ))
    .fetch_one(pool.pool())
    .await
    .unwrap();

    assert_eq!(scope_id, domain::SYSTEM_SCOPE_ID);
}

#[tokio::test]
async fn runtime_model_routes_return_403_when_scope_grant_is_missing() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "ungranted_route_orders";
    let model_id =
        create_model_with_status(&app, &cookie, &csrf, model_code, Some("published")).await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;

    assert_runtime_crud_blocked(
        &app,
        &cookie,
        &csrf,
        model_code,
        StatusCode::FORBIDDEN,
        "data_model_scope_not_granted",
    )
    .await;
}

async fn create_orders_model(app: &axum::Router, cookie: &str, csrf: &str) -> String {
    create_model_with_status(app, cookie, csrf, "orders", None).await
}

async fn create_system_model(app: &axum::Router, cookie: &str, csrf: &str, code: &str) -> String {
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
                        "scope_kind": "system",
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

async fn create_model_with_status(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    code: &str,
    status: Option<&str>,
) -> String {
    let mut body = json!({
        "scope_kind": "workspace",
        "code": code,
        "title": code
    });
    if let Some(status) = status {
        body["status"] = json!(status);
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/models")
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    payload["data"]["id"].as_str().unwrap().to_string()
}

async fn update_model_status(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    model_id: &str,
    status: &str,
) -> serde_json::Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/console/models/{model_id}"))
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "status": status }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap()
}

async fn create_runtime_record(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    model_code: &str,
    title: &str,
) -> serde_json::Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/runtime/models/{model_code}/records"))
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "title": title }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap()
}

async fn assert_runtime_crud_blocked(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    model_code: &str,
    expected_status: StatusCode,
    expected_code: &str,
) {
    let record_id = uuid::Uuid::now_v7();
    let requests = [
        Request::builder()
            .method("GET")
            .uri(format!("/api/runtime/models/{model_code}/records"))
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .method("GET")
            .uri(format!(
                "/api/runtime/models/{model_code}/records/{record_id}"
            ))
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .method("POST")
            .uri(format!("/api/runtime/models/{model_code}/records"))
            .header("cookie", cookie)
            .header("x-csrf-token", csrf)
            .header("content-type", "application/json")
            .body(Body::from(json!({ "title": "blocked" }).to_string()))
            .unwrap(),
        Request::builder()
            .method("PATCH")
            .uri(format!(
                "/api/runtime/models/{model_code}/records/{record_id}"
            ))
            .header("cookie", cookie)
            .header("x-csrf-token", csrf)
            .header("content-type", "application/json")
            .body(Body::from(json!({ "title": "blocked" }).to_string()))
            .unwrap(),
        Request::builder()
            .method("DELETE")
            .uri(format!(
                "/api/runtime/models/{model_code}/records/{record_id}"
            ))
            .header("cookie", cookie)
            .header("x-csrf-token", csrf)
            .body(Body::empty())
            .unwrap(),
    ];

    for request in requests {
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), expected_status);
        let payload: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(payload["code"], json!(expected_code));
    }
}

async fn create_text_field(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    model_id: &str,
    code: &str,
) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/models/{model_id}/fields"))
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": code,
                        "title": code,
                        "field_kind": "text",
                        "is_required": true,
                        "is_unique": false,
                        "display_options": {}
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
}

async fn create_enum_field(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    model_id: &str,
    code: &str,
) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/models/{model_id}/fields"))
                .header("cookie", cookie)
                .header("x-csrf-token", csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": code,
                        "title": code,
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
    assert_eq!(response.status(), StatusCode::CREATED);
}

async fn drop_runtime_table(database_url: &str, model_id: &str) {
    let durable = storage_durable::build_main_durable_postgres(database_url)
        .await
        .unwrap();
    let pool = durable.store;
    let model_id = uuid::Uuid::parse_str(model_id).unwrap();
    let physical_table_name: String =
        sqlx::query_scalar("select physical_table_name from model_definitions where id = $1")
            .bind(model_id)
            .fetch_one(pool.pool())
            .await
            .unwrap();
    let statement = format!("drop table if exists \"{physical_table_name}\"");
    sqlx::query(&statement).execute(pool.pool()).await.unwrap();
}
