use crate::_tests::support::{login_and_capture_cookie, test_app_with_database_url};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use sqlx::Row;
use tower::ServiceExt;

async fn seed_external_data_source_instance(database_url: &str) -> String {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    let actor = sqlx::query(
        r#"
        select users.id as user_id, workspace_memberships.workspace_id as workspace_id
        from users
        join workspace_memberships on workspace_memberships.user_id = users.id
        where users.account = 'root'
        order by workspace_memberships.created_at asc
        limit 1
        "#,
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let actor_user_id: uuid::Uuid = actor.get("user_id");
    let workspace_id: uuid::Uuid = actor.get("workspace_id");
    let installation_id = uuid::Uuid::now_v7();
    let data_source_instance_id = uuid::Uuid::now_v7();
    let provider_code = format!("route_external_source_{}", data_source_instance_id.simple());

    sqlx::query(
        r#"
        insert into plugin_installations (
            id, provider_code, plugin_id, plugin_version, contract_version, protocol,
            display_name, source_kind, trust_level, verification_status, desired_state,
            artifact_status, runtime_status, availability_status, installed_path,
            metadata_json, created_by
        ) values (
            $1, $2, $3, '0.1.0', '1flowbase.data_source/v1', 'stdio_json',
            'Route External Source', 'uploaded', 'unverified', 'valid', 'active_requested',
            'ready', 'active', 'available', '/tmp/route-external-source',
            '{}', $4
        )
        "#,
    )
    .bind(installation_id)
    .bind(&provider_code)
    .bind(format!("{provider_code}@0.1.0"))
    .bind(actor_user_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        insert into data_source_instances (
            id, workspace_id, installation_id, source_code, display_name, status,
            config_json, metadata_json, default_data_model_status,
            default_api_exposure_status, created_by
        ) values (
            $1, $2, $3, 'route_external_source', 'Route External Source', 'ready',
            '{}', '{}', 'published', 'published_not_exposed', $4
        )
        "#,
    )
    .bind(data_source_instance_id)
    .bind(workspace_id)
    .bind(installation_id)
    .bind(actor_user_id)
    .execute(&pool)
    .await
    .unwrap();

    data_source_instance_id.to_string()
}

#[tokio::test]
async fn create_external_model_and_field_mapping_keys() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let data_source_instance_id = seed_external_data_source_instance(&database_url).await;

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
                        "data_source_instance_id": data_source_instance_id,
                        "external_resource_key": "contacts",
                        "code": "external_contacts",
                        "title": "External Contacts"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_model_response.status(), StatusCode::CREATED);
    let created_model: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_model_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        created_model["data"]["data_source_instance_id"],
        json!(data_source_instance_id)
    );
    assert_eq!(
        created_model["data"]["source_kind"],
        json!("external_source")
    );
    assert_eq!(
        created_model["data"]["external_resource_key"],
        json!("contacts")
    );
    let model_id = created_model["data"]["id"].as_str().unwrap();

    let create_field_response = app
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

    assert_eq!(create_field_response.status(), StatusCode::CREATED);
    let created_field: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_field_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        created_field["data"]["external_field_key"],
        json!("properties.email")
    );
}
