use crate::_tests::support::{login_and_capture_cookie, test_app, test_app_with_database_url};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use sqlx::Row;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tower::ServiceExt;

struct TempDataSourcePackage {
    root: PathBuf,
}

impl TempDataSourcePackage {
    fn new() -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "api-runtime-model-data-source-test-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        Self { root }
    }

    fn path(&self) -> &Path {
        &self.root
    }

    fn write(&self, relative_path: &str, content: &str) {
        let path = self.root.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }
}

impl Drop for TempDataSourcePackage {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn write_external_runtime_package(package: &TempDataSourcePackage) {
    let list_output = json!({
        "ok": true,
        "result": {
            "rows": [{
                "id": "contact-1",
                "email_address": "list@example.com",
                "secret_echo": "Bearer route-runtime-secret"
            }],
            "total_count": 1,
            "metadata": {}
        }
    })
    .to_string();
    let get_output = json!({
        "ok": true,
        "result": {
            "record": {
                "id": "contact-1",
                "email_address": "get@example.com",
                "secret_echo": "Bearer route-runtime-secret"
            },
            "metadata": {}
        }
    })
    .to_string();
    let create_output = json!({
        "ok": true,
        "result": {
            "record": {
                "id": "contact-created",
                "email_address": "created@example.com",
                "secret_echo": "Bearer route-runtime-secret"
            },
            "metadata": {}
        }
    })
    .to_string();
    let update_output = json!({
        "ok": true,
        "result": {
            "record": {
                "id": "contact-1",
                "email_address": "updated@example.com",
                "secret_echo": "Bearer route-runtime-secret"
            },
            "metadata": {}
        }
    })
    .to_string();
    let delete_output = json!({
        "ok": true,
        "result": {
            "deleted": true,
            "metadata": {}
        }
    })
    .to_string();
    let error_output = json!({
        "ok": false,
        "error": {
            "message": "runtime CRUD request missing connection secret or unsupported method",
            "provider_summary": null
        }
    })
    .to_string();

    package.write(
        "bin/fixture_external_data_source",
        &format!(
            r#"#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
case "${{payload}}" in
  *'"method":"list_records"'*)
    if [[ "${{payload}}" == *'"client_secret":"route-runtime-secret"'* && "${{payload}}" == *'"resource_key":"contacts"'* ]]; then
      printf '%s' '{list_output}'
    else
      printf '%s' '{error_output}'
      exit 1
    fi
    ;;
  *'"method":"get_record"'*)
    if [[ "${{payload}}" == *'"client_secret":"route-runtime-secret"'* && "${{payload}}" == *'"record_id":"contact-1"'* ]]; then
      printf '%s' '{get_output}'
    else
      printf '%s' '{error_output}'
      exit 1
    fi
    ;;
  *'"method":"create_record"'*)
    if [[ "${{payload}}" == *'"client_secret":"route-runtime-secret"'* && "${{payload}}" == *'"transaction_id":null'* ]]; then
      printf '%s' '{create_output}'
    else
      printf '%s' '{error_output}'
      exit 1
    fi
    ;;
  *'"method":"update_record"'*)
    if [[ "${{payload}}" == *'"client_secret":"route-runtime-secret"'* && "${{payload}}" == *'"transaction_id":null'* ]]; then
      printf '%s' '{update_output}'
    else
      printf '%s' '{error_output}'
      exit 1
    fi
    ;;
  *'"method":"delete_record"'*)
    if [[ "${{payload}}" == *'"client_secret":"route-runtime-secret"'* && "${{payload}}" == *'"transaction_id":null'* ]]; then
      printf '%s' '{delete_output}'
    else
      printf '%s' '{error_output}'
      exit 1
    fi
    ;;
  *)
    printf '%s' '{error_output}'
    exit 1
    ;;
esac
"#
        ),
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let path = package.path().join("bin/fixture_external_data_source");
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions).unwrap();
    }

    package.write(
        "manifest.yaml",
        r#"manifest_version: 1
plugin_id: fixture_external_data_source@0.1.0
version: 0.1.0
vendor: taichuy
display_name: Fixture External Data Source
description: Fixture External Data Source
source_kind: uploaded
trust_level: unverified
consumption_kind: runtime_extension
execution_mode: process_per_call
slot_codes:
  - data_source
binding_targets:
  - workspace
selection_mode: assignment_then_select
minimum_host_version: 0.1.0
contract_version: 1flowbase.data_source/v1
schema_version: 1flowbase.plugin.manifest/v1
permissions:
  network: outbound_only
  secrets: provider_instance_only
  storage: none
  mcp: none
  subprocess: deny
runtime:
  protocol: stdio_json
  entry: bin/fixture_external_data_source
  limits:
    memory_bytes: 134217728
    timeout_ms: 5000
node_contributions: []
"#,
    );
    package.write(
        "datasource/fixture_external_data_source.yaml",
        r#"source_code: fixture_external_data_source
display_name: Fixture External Data Source
auth_modes:
  - api_key
capabilities:
  - list_records
  - get_record
  - create_record
  - update_record
  - delete_record
supports_sync: false
supports_webhook: false
resource_kinds:
  - object
config_schema:
  - key: client_id
    label: Client ID
    type: string
    required: true
"#,
    );
}

async fn revoke_model_grant(database_url: &str, model_id: &str) {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    sqlx::query(
        r#"
        delete from scope_data_model_grants
        where data_model_id = $1
        "#,
    )
    .bind(uuid::Uuid::parse_str(model_id).unwrap())
    .execute(&pool)
    .await
    .unwrap();
}

async fn seed_runtime_data_source_instance(
    database_url: &str,
    package: &TempDataSourcePackage,
) -> String {
    seed_runtime_data_source_instance_with_options(
        database_url,
        package,
        RuntimeDataSourceSeedOptions::default(),
    )
    .await
}

struct RuntimeDataSourceSeedOptions<'a> {
    provider_code: &'a str,
    source_code: &'a str,
    contract_version: &'a str,
    desired_state: &'a str,
    artifact_status: &'a str,
    runtime_status: &'a str,
    availability_status: &'a str,
    instance_status: &'a str,
    installed_path: Option<&'a str>,
    assign: bool,
}

impl Default for RuntimeDataSourceSeedOptions<'_> {
    fn default() -> Self {
        Self {
            provider_code: "fixture_external_data_source",
            source_code: "fixture_external_data_source",
            contract_version: "1flowbase.data_source/v1",
            desired_state: "active_requested",
            artifact_status: "ready",
            runtime_status: "active",
            availability_status: "available",
            instance_status: "ready",
            installed_path: None,
            assign: true,
        }
    }
}

async fn seed_runtime_data_source_instance_with_options(
    database_url: &str,
    package: &TempDataSourcePackage,
    options: RuntimeDataSourceSeedOptions<'_>,
) -> String {
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
    let assignment_id = uuid::Uuid::now_v7();
    let data_source_instance_id = uuid::Uuid::now_v7();

    sqlx::query(
        r#"
        insert into plugin_installations (
            id, provider_code, plugin_id, plugin_version, contract_version, protocol,
            display_name, source_kind, trust_level, verification_status, desired_state,
            artifact_status, runtime_status, availability_status, installed_path,
            metadata_json, created_by
        ) values (
            $1, $2, 'fixture_external_data_source@0.1.0',
            '0.1.0', $3, 'stdio_json',
            'Fixture External Data Source', 'uploaded', 'unverified', 'valid',
            $4, $5, $6, $7, $8,
            '{}', $9
        )
        "#,
    )
    .bind(installation_id)
    .bind(options.provider_code)
    .bind(options.contract_version)
    .bind(options.desired_state)
    .bind(options.artifact_status)
    .bind(options.runtime_status)
    .bind(options.availability_status)
    .bind(
        options
            .installed_path
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| package.path().display().to_string()),
    )
    .bind(actor_user_id)
    .execute(&pool)
    .await
    .unwrap();

    if options.assign {
        sqlx::query(
            r#"
            insert into plugin_assignments (
                id, installation_id, workspace_id, provider_code, assigned_by
            ) values ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(assignment_id)
        .bind(installation_id)
        .bind(workspace_id)
        .bind(options.provider_code)
        .bind(actor_user_id)
        .execute(&pool)
        .await
        .unwrap();
    }

    sqlx::query(
        r#"
        insert into data_source_instances (
            id, workspace_id, installation_id, source_code, display_name, status,
            config_json, metadata_json, default_data_model_status,
            default_api_exposure_status, created_by
        ) values (
            $1, $2, $3, $4, 'Fixture External Data Source',
            $5, '{"client_id":"route-runtime-client"}', '{}',
            'published', 'published_not_exposed', $6
        )
        "#,
    )
    .bind(data_source_instance_id)
    .bind(workspace_id)
    .bind(installation_id)
    .bind(options.source_code)
    .bind(options.instance_status)
    .bind(actor_user_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        insert into data_source_secrets (
            data_source_instance_id, encrypted_secret_json, secret_version
        ) values ($1, '{"client_secret":"route-runtime-secret"}', 1)
        "#,
    )
    .bind(data_source_instance_id)
    .execute(&pool)
    .await
    .unwrap();

    data_source_instance_id.to_string()
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

async fn audit_event_count(database_url: &str, event_code: &str) -> i64 {
    let pool = sqlx::PgPool::connect(database_url).await.unwrap();
    sqlx::query_scalar("select count(*) from audit_logs where event_code = $1")
        .bind(event_code)
        .fetch_one(&pool)
        .await
        .unwrap()
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

async fn list_records_with_api_key(
    app: &axum::Router,
    model_code: &str,
    token: &str,
) -> (StatusCode, serde_json::Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/runtime/models/{model_code}/records"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    (status, payload)
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
async fn runtime_model_routes_api_key_can_list_granted_records() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "api_key_list_orders";
    let model_id =
        create_model_with_status(&app, &cookie, &csrf, model_code, Some("published")).await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;
    create_runtime_record(&app, &cookie, &csrf, model_code, "visible").await;

    let token = create_api_key(
        &app,
        &cookie,
        &csrf,
        "runtime list key",
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

    let (status, payload) = list_records_with_api_key(&app, model_code, &token).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["data"]["total"], json!(1));
    assert_eq!(payload["data"]["items"][0]["title"], json!("visible"));
}

#[tokio::test]
async fn runtime_model_routes_api_key_cannot_call_ungranted_data_model() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let granted_model_id = create_model_with_status(
        &app,
        &cookie,
        &csrf,
        "api_key_granted_orders",
        Some("published"),
    )
    .await;
    create_text_field(&app, &cookie, &csrf, &granted_model_id, "title").await;
    let denied_model_code = "api_key_ungranted_orders";
    let denied_model_id =
        create_model_with_status(&app, &cookie, &csrf, denied_model_code, Some("published")).await;
    create_text_field(&app, &cookie, &csrf, &denied_model_id, "title").await;

    let token = create_api_key(
        &app,
        &cookie,
        &csrf,
        "runtime ungranted key",
        json!([
            {
                "data_model_id": granted_model_id,
                "list": true,
                "get": false,
                "create": false,
                "update": false,
                "delete": false
            }
        ]),
    )
    .await;

    let (status, payload) = list_records_with_api_key(&app, denied_model_code, &token).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(payload["code"], json!("api_key_action_not_allowed"));
}

#[tokio::test]
async fn runtime_model_routes_api_key_cannot_call_disabled_action() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "api_key_disabled_action_orders";
    let model_id =
        create_model_with_status(&app, &cookie, &csrf, model_code, Some("published")).await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;

    let token = create_api_key(
        &app,
        &cookie,
        &csrf,
        "runtime disabled action key",
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

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/runtime/models/{model_code}/records"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({ "title": "blocked" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(payload["code"], json!("api_key_action_not_allowed"));
}

#[tokio::test]
async fn runtime_model_routes_audit_api_key_denied_and_write_results() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "api_key_audit_orders";
    let model_id =
        create_model_with_status(&app, &cookie, &csrf, model_code, Some("published")).await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;

    let read_only_token = create_api_key(
        &app,
        &cookie,
        &csrf,
        "runtime audit denied key",
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
    let denied = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/runtime/models/{model_code}/records"))
                .header("authorization", format!("Bearer {read_only_token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({ "title": "denied" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(denied.status(), StatusCode::FORBIDDEN);
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_access_denied").await,
        1
    );

    let write_token = create_api_key(
        &app,
        &cookie,
        &csrf,
        "runtime audit write key",
        json!([
            {
                "data_model_id": model_id,
                "list": false,
                "get": false,
                "create": true,
                "update": false,
                "delete": false
            }
        ]),
    )
    .await;
    let success = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/runtime/models/{model_code}/records"))
                .header("authorization", format!("Bearer {write_token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({ "title": "success" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(success.status(), StatusCode::CREATED);
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_write_succeeded").await,
        1
    );

    drop_runtime_table(&database_url, &model_id).await;
    let failure = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/runtime/models/{model_code}/records"))
                .header("authorization", format!("Bearer {write_token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({ "title": "failure" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(failure.status(), StatusCode::CONFLICT);
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_write_failed").await,
        1
    );
}

#[tokio::test]
async fn runtime_model_routes_api_key_cannot_bypass_owner_scope() {
    let (app, database_url) = test_app_with_database_url().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "api_key_owner_orders";
    let model_id = create_model_with_status(
        &app,
        &root_cookie,
        &root_csrf,
        model_code,
        Some("published"),
    )
    .await;
    create_text_field(&app, &root_cookie, &root_csrf, &model_id, "title").await;

    let member_id = create_member(
        &app,
        &root_cookie,
        &root_csrf,
        "api-key-owner-member",
        "temp-pass",
    )
    .await;
    replace_member_roles(&app, &root_cookie, &root_csrf, &member_id, &["admin"]).await;
    let (member_cookie, member_csrf) =
        login_and_capture_cookie(&app, "api-key-owner-member", "temp-pass").await;

    set_model_grant_permission_profile(&database_url, &model_id, "owner").await;
    create_runtime_record(&app, &root_cookie, &root_csrf, model_code, "root-owner").await;
    create_runtime_record(
        &app,
        &member_cookie,
        &member_csrf,
        model_code,
        "member-owner",
    )
    .await;

    let token = create_api_key(
        &app,
        &root_cookie,
        &root_csrf,
        "runtime owner key",
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

    let (status, payload) = list_records_with_api_key(&app, model_code, &token).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["data"]["total"], json!(1));
    assert_eq!(payload["data"]["items"][0]["title"], json!("root-owner"));
}

#[tokio::test]
async fn runtime_model_routes_api_key_uses_system_scope_grant() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "api_key_system_orders";
    let model_id = create_system_model(&app, &cookie, &csrf, model_code).await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;
    create_runtime_record(&app, &cookie, &csrf, model_code, "system-visible").await;

    let response = app
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
                        "name": "runtime system key",
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
    assert_eq!(response.status(), StatusCode::CREATED);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    let token = payload["data"]["token"].as_str().unwrap();

    let (status, payload) = list_records_with_api_key(&app, model_code, token).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["data"]["total"], json!(1));
    assert_eq!(
        payload["data"]["items"][0]["title"],
        json!("system-visible")
    );
}

#[tokio::test]
async fn runtime_model_routes_audit_api_key_engine_level_acl_denials() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "api_key_system_all_acl_orders";
    let model_id = create_system_model(&app, &cookie, &csrf, model_code).await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;
    set_model_grant_permission_profile(&database_url, &model_id, "system_all").await;

    let response = app
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
                        "name": "runtime system all denied key",
                        "scope_kind": "system",
                        "scope_id": domain::SYSTEM_SCOPE_ID,
                        "permissions": [
                            {
                                "data_model_id": model_id,
                                "list": true,
                                "get": false,
                                "create": true,
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

    let (list_status, list_payload) = list_records_with_api_key(&app, model_code, token).await;
    assert_eq!(list_status, StatusCode::FORBIDDEN);
    assert_eq!(
        list_payload["code"],
        json!("system_all_requires_system_actor")
    );
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_access_denied").await,
        1
    );

    let create_denied = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/runtime/models/{model_code}/records"))
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(json!({ "title": "denied" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_denied.status(), StatusCode::FORBIDDEN);
    let create_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_denied.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        create_payload["code"],
        json!("system_all_requires_system_actor")
    );
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_access_denied").await,
        2
    );
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_write_failed").await,
        1
    );
    assert_eq!(
        audit_event_count(&database_url, "state_model.api_key_runtime_write_succeeded").await,
        0
    );
}

#[tokio::test]
async fn runtime_model_routes_create_fetch_update_delete_and_filter_records() {
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_id = create_orders_model(&app, &cookie, &csrf).await;
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
async fn runtime_model_routes_dispatch_external_source_crud_to_data_source_runtime() {
    let package = TempDataSourcePackage::new();
    write_external_runtime_package(&package);
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let data_source_instance_id = seed_runtime_data_source_instance(&database_url, &package).await;

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
                        "code": "external_runtime_contacts",
                        "title": "External Runtime Contacts",
                        "status": "published"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_model_response.status(), StatusCode::CREATED);
    let model_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_model_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let model_id = model_payload["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(
        model_payload["data"]["source_kind"],
        json!("external_source")
    );

    create_text_field_with_external_key(&app, &cookie, &csrf, &model_id, "email", "email_address")
        .await;
    create_text_field_with_external_key(
        &app,
        &cookie,
        &csrf,
        &model_id,
        "token_echo",
        "secret_echo",
    )
    .await;

    let list_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/external_runtime_contacts/records")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let list_status = list_response.status();
    let list_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(list_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        list_status,
        StatusCode::OK,
        "unexpected list payload: {list_payload}"
    );
    assert_eq!(list_payload["data"]["total"], json!(1));
    assert_eq!(
        list_payload["data"]["items"][0]["email"],
        json!("list@example.com")
    );
    assert_eq!(
        list_payload["data"]["items"][0]["token_echo"],
        json!("Bearer ***")
    );
    assert!(!list_payload.to_string().contains("route-runtime-secret"));

    let get_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/runtime/models/external_runtime_contacts/records/contact-1")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);
    let get_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(get_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(get_payload["data"]["email"], json!("get@example.com"));
    assert_eq!(get_payload["data"]["token_echo"], json!("Bearer ***"));

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/runtime/models/external_runtime_contacts/records")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "email": "created@example.com" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::CREATED);
    let create_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(create_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(create_payload["data"]["id"], json!("contact-created"));
    assert_eq!(
        create_payload["data"]["email"],
        json!("created@example.com")
    );
    assert_eq!(create_payload["data"]["token_echo"], json!("Bearer ***"));

    let update_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/api/runtime/models/external_runtime_contacts/records/contact-1")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "email": "updated@example.com" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_response.status(), StatusCode::OK);
    let update_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(update_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        update_payload["data"]["email"],
        json!("updated@example.com")
    );
    assert_eq!(update_payload["data"]["token_echo"], json!("Bearer ***"));

    let delete_response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/runtime/models/external_runtime_contacts/records/contact-1")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_response.status(), StatusCode::OK);
    let delete_payload: serde_json::Value = serde_json::from_slice(
        &to_bytes(delete_response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(delete_payload["data"]["deleted"], json!(true));
}

#[tokio::test]
async fn runtime_model_routes_external_source_runtime_blocks_unassigned_or_unavailable_installations(
) {
    let cases = [
        (
            "instance_not_ready",
            RuntimeDataSourceSeedOptions {
                provider_code: "fixture_external_data_source_instance_not_ready",
                source_code: "fixture_external_data_source_instance_not_ready",
                instance_status: "draft",
                ..RuntimeDataSourceSeedOptions::default()
            },
            StatusCode::CONFLICT,
            "data_source_instance_not_ready",
        ),
        (
            "unassigned",
            RuntimeDataSourceSeedOptions {
                provider_code: "fixture_external_data_source_unassigned",
                source_code: "fixture_external_data_source_unassigned",
                assign: false,
                ..RuntimeDataSourceSeedOptions::default()
            },
            StatusCode::CONFLICT,
            "plugin_assignment_required",
        ),
        (
            "disabled",
            RuntimeDataSourceSeedOptions {
                provider_code: "fixture_external_data_source_disabled",
                source_code: "fixture_external_data_source_disabled",
                desired_state: "disabled",
                runtime_status: "active",
                availability_status: "disabled",
                ..RuntimeDataSourceSeedOptions::default()
            },
            StatusCode::CONFLICT,
            "plugin_installation_unavailable",
        ),
        (
            "load_failed",
            RuntimeDataSourceSeedOptions {
                provider_code: "fixture_external_data_source_load_failed",
                source_code: "fixture_external_data_source_load_failed",
                desired_state: "active_requested",
                runtime_status: "load_failed",
                availability_status: "load_failed",
                ..RuntimeDataSourceSeedOptions::default()
            },
            StatusCode::CONFLICT,
            "plugin_installation_unavailable",
        ),
        (
            "artifact_missing",
            RuntimeDataSourceSeedOptions {
                provider_code: "fixture_external_data_source_artifact_missing",
                source_code: "fixture_external_data_source_artifact_missing",
                installed_path: Some(
                    "/tmp/1flowbase-plan-d-runtime-artifact-missing-does-not-exist",
                ),
                ..RuntimeDataSourceSeedOptions::default()
            },
            StatusCode::CONFLICT,
            "plugin_installation_unavailable",
        ),
        (
            "contract_mismatch",
            RuntimeDataSourceSeedOptions {
                provider_code: "fixture_external_data_source_contract_mismatch",
                source_code: "fixture_external_data_source_contract_mismatch",
                contract_version: "1flowbase.model_provider/v1",
                ..RuntimeDataSourceSeedOptions::default()
            },
            StatusCode::BAD_REQUEST,
            "plugin_installation",
        ),
        (
            "source_code_mismatch",
            RuntimeDataSourceSeedOptions {
                provider_code: "fixture_external_data_source_source_mismatch",
                source_code: "fixture_external_data_source_other",
                ..RuntimeDataSourceSeedOptions::default()
            },
            StatusCode::BAD_REQUEST,
            "source_code",
        ),
    ];

    for (case_name, options, expected_status, expected_code) in cases {
        let package = TempDataSourcePackage::new();
        write_external_runtime_package(&package);
        let (app, database_url) = test_app_with_database_url().await;
        let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
        let data_source_instance_id =
            seed_runtime_data_source_instance_with_options(&database_url, &package, options).await;
        let model_code = format!("external_runtime_blocked_{case_name}");

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
                            "code": model_code,
                            "title": format!("External Runtime Blocked {case_name}"),
                            "status": "published"
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(create_model_response.status(), StatusCode::CREATED);
        let model_payload: serde_json::Value = serde_json::from_slice(
            &to_bytes(create_model_response.into_body(), usize::MAX)
                .await
                .unwrap(),
        )
        .unwrap();
        let model_id = model_payload["data"]["id"].as_str().unwrap().to_string();
        create_text_field_with_external_key(&app, &cookie, &csrf, &model_id, "email", "email")
            .await;

        let list_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/runtime/models/{model_code}/records"))
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = list_response.status();
        let payload: serde_json::Value = serde_json::from_slice(
            &to_bytes(list_response.into_body(), usize::MAX)
                .await
                .unwrap(),
        )
        .unwrap();

        assert_eq!(
            status, expected_status,
            "unexpected status for {case_name}: {payload}"
        );
        assert_eq!(payload["code"], json!(expected_code));
        assert!(
            !payload.to_string().contains("list@example.com"),
            "runtime fixture was called for {case_name}: {payload}"
        );
    }
}

#[tokio::test]
async fn runtime_model_routes_apply_persisted_scope_all_grant_for_session_actors() {
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_id = create_orders_model(&app, &root_cookie, &root_csrf).await;
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
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "status_route_orders";
    let model_id = create_model_with_status(&app, &cookie, &csrf, model_code, Some("draft")).await;
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
    let (app, database_url) = test_app_with_database_url().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let model_code = "ungranted_route_orders";
    let model_id =
        create_model_with_status(&app, &cookie, &csrf, model_code, Some("published")).await;
    create_text_field(&app, &cookie, &csrf, &model_id, "title").await;
    revoke_model_grant(&database_url, &model_id).await;

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
    assert_eq!(payload["data"]["scope_kind"], json!("system"));
    assert_eq!(
        payload["data"]["scope_id"],
        json!(domain::SYSTEM_SCOPE_ID.to_string())
    );
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
    assert_eq!(payload["data"]["scope_kind"], json!("system"));
    assert_eq!(
        payload["data"]["scope_id"],
        json!(domain::SYSTEM_SCOPE_ID.to_string())
    );
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

async fn create_text_field_with_external_key(
    app: &axum::Router,
    cookie: &str,
    csrf: &str,
    model_id: &str,
    code: &str,
    external_field_key: &str,
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
                        "external_field_key": external_field_key,
                        "field_kind": "text",
                        "is_required": false,
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
