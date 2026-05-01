mod external_mapping;
mod scope_grant_acl;

use crate::_tests::support::{login_and_capture_cookie, test_app, test_app_with_database_url};
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

async fn set_stored_api_exposure_status(database_url: &str, model_id: &str, status: &str) {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    sqlx::query(
        r#"
        update model_definitions
        set api_exposure_status = $2
        where id = $1
        "#,
    )
    .bind(uuid::Uuid::parse_str(model_id).unwrap())
    .bind(status)
    .execute(&pool)
    .await
    .unwrap();
}

async fn set_model_grant_permission_profile(database_url: &str, model_id: &str, profile: &str) {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    sqlx::query(
        r#"
        update scope_data_model_grants
        set permission_profile = $2
        where data_model_id = $1
        "#,
    )
    .bind(uuid::Uuid::parse_str(model_id).unwrap())
    .bind(profile)
    .execute(&pool)
    .await
    .unwrap();
}

async fn protect_model(database_url: &str, model_id: &str) {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    sqlx::query(
        r#"
        update model_definitions
        set owner_kind = 'runtime_extension',
            owner_id = 'ext.crm',
            is_protected = true
        where id = $1
        "#,
    )
    .bind(uuid::Uuid::parse_str(model_id).unwrap())
    .execute(&pool)
    .await
    .unwrap();
}

async fn audit_event_count(database_url: &str, event_code: &str) -> i64 {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    sqlx::query_scalar("select count(*) from audit_logs where event_code = $1")
        .bind(event_code)
        .fetch_one(&pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn protected_model_routes_reject_non_root_admin_mutations() {
    let (app, database_url) = test_app_with_database_url().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    create_role(&app, &root_cookie, &root_csrf, "model_admin").await;
    replace_role_permissions(
        &app,
        &root_cookie,
        &root_csrf,
        "model_admin",
        &[
            "state_model.view.all",
            "state_model.manage.all",
            "api_reference.view.all",
        ],
    )
    .await;
    let member_id = create_member(
        &app,
        &root_cookie,
        &root_csrf,
        "protected-admin",
        "temp-pass",
    )
    .await;
    replace_member_roles(&app, &root_cookie, &root_csrf, &member_id, &["model_admin"]).await;
    let (admin_cookie, admin_csrf) =
        login_and_capture_cookie(&app, "protected-admin", "temp-pass").await;

    let create_response = app
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
                        "code": "protected_route_orders",
                        "title": "Protected Route Orders"
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

    let field_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/models/{model_id}/fields"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "email",
                        "title": "Email",
                        "field_kind": "string"
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
    protect_model(&database_url, &model_id).await;

    for request in [
        Request::builder()
            .method("PATCH")
            .uri(format!("/api/console/models/{model_id}"))
            .header("cookie", &admin_cookie)
            .header("x-csrf-token", &admin_csrf)
            .header("content-type", "application/json")
            .body(Body::from(json!({ "status": "disabled" }).to_string()))
            .unwrap(),
        Request::builder()
            .method("PATCH")
            .uri(format!("/api/console/models/{model_id}/fields/{field_id}"))
            .header("cookie", &admin_cookie)
            .header("x-csrf-token", &admin_csrf)
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "title": "Work Email",
                    "is_required": true,
                    "is_unique": false,
                    "relation_options": {}
                })
                .to_string(),
            ))
            .unwrap(),
        Request::builder()
            .method("DELETE")
            .uri(format!(
                "/api/console/models/{model_id}/fields/{field_id}?confirmed=true"
            ))
            .header("cookie", &admin_cookie)
            .header("x-csrf-token", &admin_csrf)
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .method("DELETE")
            .uri(format!("/api/console/models/{model_id}?confirmed=true"))
            .header("cookie", &admin_cookie)
            .header("x-csrf-token", &admin_csrf)
            .body(Body::empty())
            .unwrap(),
    ] {
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let payload: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(payload["code"], json!("protected_data_model"));
    }

    let root_delete = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/console/models/{model_id}?confirmed=true"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(root_delete.status(), StatusCode::OK);
}

#[tokio::test]
async fn model_definition_routes_expose_advisor_findings_and_dynamic_openapi_docs() {
    let (app, database_url) = test_app_with_database_url().await;
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
                        "code": "advisor_doc_orders",
                        "title": "Advisor Doc Orders"
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
                        "display_options": { "options": ["draft", "paid"] }
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(field_response.status(), StatusCode::CREATED);
    protect_model(&database_url, &model_id).await;

    let advisor_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/console/models/{model_id}/advisor-findings"))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(advisor_response.status(), StatusCode::OK);
    let advisor_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(advisor_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let finding_codes = advisor_payload["data"]
        .as_array()
        .unwrap()
        .iter()
        .map(|finding| finding["code"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert!(finding_codes.contains(&"published_not_exposed"));

    let docs_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/console/docs/data-models/{model_id}/openapi.json"
                ))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(docs_response.status(), StatusCode::OK);
    let docs: serde_json::Value = serde_json::from_slice(
        &to_bytes(docs_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();

    assert_eq!(docs["openapi"], json!("3.1.0"));
    assert!(docs["paths"]["/api/runtime/models/advisor_doc_orders/records"]["get"].is_object());
    assert!(docs["paths"]["/api/runtime/models/advisor_doc_orders/records"]["post"].is_object());
    assert!(
        docs["paths"]["/api/runtime/models/advisor_doc_orders/records/{id}"]["get"].is_object()
    );
    assert!(
        docs["paths"]["/api/runtime/models/advisor_doc_orders/records/{id}"]["patch"].is_object()
    );
    assert!(
        docs["paths"]["/api/runtime/models/advisor_doc_orders/records/{id}"]["delete"].is_object()
    );
    assert_eq!(
        docs["components"]["schemas"]["AdvisorDocOrdersRecord"]["properties"]["status"]["type"],
        json!("string")
    );
    assert_eq!(
        docs["components"]["securitySchemes"]["apiKeyBearer"]["description"],
        json!("Use Authorization: Bearer <api_key> for Data Model runtime APIs.")
    );
    assert_eq!(
        docs["x-data-model"]["api_exposure_status"],
        json!("published_not_exposed")
    );
    assert!(docs["x-scope-permission-note"]
        .as_str()
        .unwrap()
        .contains("scope grant"));
    assert!(docs["x-external-source-safety-limits"]
        .as_str()
        .unwrap()
        .contains("scope filter"));
    assert_eq!(
        docs["paths"]["/api/runtime/models/advisor_doc_orders/records"]["get"]["parameters"][0]
            ["name"],
        json!("filter")
    );
    assert!(
        docs["paths"]["/api/runtime/models/advisor_doc_orders/records"]["get"]["responses"]["403"]
            .is_object()
    );
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

    let list_main_source_models = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/console/models?data_source_instance_id=main_source")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_main_source_models.status(), StatusCode::OK);
    let list_main_source_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(list_main_source_models.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let models = list_main_source_payload["data"].as_array().unwrap();
    let model_codes = models
        .iter()
        .filter_map(|model| model["code"].as_str())
        .collect::<Vec<_>>();
    assert!(model_codes.contains(&"attachments"));
    assert!(model_codes.contains(&"users"));
    assert!(model_codes.contains(&"roles"));
    assert!(models.iter().any(|model| {
        model["id"].as_str() == Some(&model_id)
            && model["source_kind"].as_str() == Some("main_source")
    }));
    assert!(models.iter().all(|model| {
        model["data_source_instance_id"].is_null()
            && model["source_kind"].as_str() == Some("main_source")
    }));

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
async fn model_definition_routes_reject_main_source_external_mapping_keys() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_with_external_resource_key = app
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
                        "external_resource_key": "contacts",
                        "code": "main_source_with_external_key",
                        "title": "Main Source With External Key"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        create_with_external_resource_key.status(),
        StatusCode::BAD_REQUEST
    );
    let error: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_with_external_resource_key.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(error["code"], json!("external_resource_key"));
    assert_eq!(
        error["message"],
        json!("invalid input: external_resource_key")
    );

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
                        "code": "main_source_field_external_key",
                        "title": "Main Source Field External Key"
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

    let field_with_external_key = app
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
                        "code": "email",
                        "title": "Email",
                        "external_field_key": "properties.email",
                        "field_kind": "string"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(field_with_external_key.status(), StatusCode::BAD_REQUEST);
    let error: serde_json::Value = serde_json::from_slice(
        &to_bytes(field_with_external_key.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(error["code"], json!("external_field_key"));
    assert_eq!(error["message"], json!("invalid input: external_field_key"));
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
async fn model_definition_routes_patch_api_exposure_request_without_status_update() {
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
                        "code": "api_request_only_orders",
                        "title": "API Request Only Orders"
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
                        "api_exposure_status": "api_exposed_no_permission"
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
async fn model_definition_routes_show_not_exposed_for_stored_ready_or_no_permission_without_api_key(
) {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    for (code, stored_status) in [
        ("stored_ready_without_key_orders", "api_exposed_ready"),
        (
            "stored_no_permission_without_key_orders",
            "api_exposed_no_permission",
        ),
    ] {
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
                            "code": code,
                            "title": code
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
        set_stored_api_exposure_status(&database_url, model_id, stored_status).await;

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
        let payload: serde_json::Value = serde_json::from_slice(
            &to_bytes(get_response.into_body(), usize::MAX)
                .await
                .unwrap(),
        )
        .unwrap();
        assert_eq!(
            payload["data"]["api_exposure_status"],
            json!("published_not_exposed")
        );
    }
}

#[tokio::test]
async fn model_definition_scope_grant_routes_audit_and_update_runtime_readiness() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_model_response = app
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
                        "code": "scope_grant_route_orders",
                        "title": "Scope Grant Route Orders"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_model_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_model_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let model_id = created["data"]["id"].as_str().unwrap().to_string();

    let create_grant_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/models/{model_id}/scope-grants"))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "scope_kind": "system",
                        "scope_id": domain::SYSTEM_SCOPE_ID,
                        "enabled": true,
                        "permission_profile": "scope_all"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_grant_response.status(), StatusCode::CREATED);
    let grant_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_grant_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let grant_id = grant_payload["data"]["id"].as_str().unwrap().to_string();

    let list_grants_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/console/models/{model_id}/scope-grants"))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_grants_response.status(), StatusCode::OK);
    let list_grants_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(list_grants_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert!(list_grants_payload["data"]
        .as_array()
        .unwrap()
        .iter()
        .any(|grant| {
            grant["id"].as_str() == Some(&grant_id)
                && grant["data_model_id"].as_str() == Some(&model_id)
                && grant["scope_kind"].as_str() == Some("system")
                && grant["permission_profile"].as_str() == Some("scope_all")
        }));

    let system_key_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/api-keys")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "name": "scope grant route system key",
                        "scope_kind": "system",
                        "scope_id": domain::SYSTEM_SCOPE_ID,
                        "permissions": [
                            {
                                "data_model_id": model_id,
                                "list": true,
                                "get": false,
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
    assert_eq!(system_key_response.status(), StatusCode::CREATED);
    let system_key_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(system_key_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let system_token = system_key_payload["data"]["token"].as_str().unwrap();

    let ready_response = app
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
    assert_eq!(ready_response.status(), StatusCode::OK);
    let ready_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(ready_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        ready_payload["data"]["api_exposure_status"],
        json!("api_exposed_ready")
    );
    let runtime_ready_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/scope_grant_route_orders/records")
                .header("authorization", format!("Bearer {system_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(runtime_ready_response.status(), StatusCode::OK);

    let update_grant_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!(
                    "/api/console/models/{model_id}/scope-grants/{grant_id}"
                ))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "enabled": false }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_grant_response.status(), StatusCode::OK);

    let no_permission_response = app
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
    assert_eq!(no_permission_response.status(), StatusCode::OK);
    let no_permission_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(no_permission_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        no_permission_payload["data"]["api_exposure_status"],
        json!("api_exposed_no_permission")
    );

    let reenable_grant_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!(
                    "/api/console/models/{model_id}/scope-grants/{grant_id}"
                ))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "enabled": true,
                        "permission_profile": "owner"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reenable_grant_response.status(), StatusCode::OK);

    let delete_grant_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/console/models/{model_id}/scope-grants/{grant_id}"
                ))
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_grant_response.status(), StatusCode::OK);

    let after_delete_response = app
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
    assert_eq!(after_delete_response.status(), StatusCode::OK);
    let after_delete_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(after_delete_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        after_delete_payload["data"]["api_exposure_status"],
        json!("api_exposed_no_permission")
    );
    let runtime_after_delete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/scope_grant_route_orders/records")
                .header("authorization", format!("Bearer {system_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let runtime_after_delete_status = runtime_after_delete_response.status();
    let runtime_after_delete_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(runtime_after_delete_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        runtime_after_delete_status,
        StatusCode::FORBIDDEN,
        "unexpected runtime delete payload: {runtime_after_delete_payload}"
    );

    assert!(audit_event_count(&database_url, "state_model.scope_grant_created").await >= 2);
    assert_eq!(
        audit_event_count(&database_url, "state_model.scope_grant_updated").await,
        2
    );
    assert_eq!(
        audit_event_count(&database_url, "state_model.scope_grant_deleted").await,
        1
    );
}

#[tokio::test]
async fn model_definition_routes_do_not_mark_system_all_api_key_path_ready() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_model_response = app
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
                        "code": "system_all_route_orders",
                        "title": "System All Route Orders"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_model_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_model_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let model_id = created["data"]["id"].as_str().unwrap().to_string();

    set_model_grant_permission_profile(&database_url, &model_id, "system_all").await;

    let system_key_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/api-keys")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "name": "system all non-root key",
                        "scope_kind": "system",
                        "scope_id": domain::SYSTEM_SCOPE_ID,
                        "permissions": [
                            {
                                "data_model_id": model_id,
                                "list": true,
                                "get": false,
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
    assert_eq!(system_key_response.status(), StatusCode::CREATED);
    let system_key_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(system_key_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let token = system_key_payload["data"]["token"].as_str().unwrap();

    let ready_response = app
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
    assert_eq!(ready_response.status(), StatusCode::OK);
    let ready_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(ready_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        ready_payload["data"]["api_exposure_status"],
        json!("api_exposed_no_permission")
    );

    let runtime_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/system_all_route_orders/records")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let runtime_status = runtime_response.status();
    let runtime_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(runtime_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        runtime_status,
        StatusCode::FORBIDDEN,
        "unexpected runtime payload: {runtime_payload}"
    );
    assert_eq!(
        runtime_payload["code"],
        json!("system_all_requires_system_actor")
    );
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_access_denied").await,
        1
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
