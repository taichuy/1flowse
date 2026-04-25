use crate::_tests::support::{
    create_member, login_and_capture_cookie, replace_member_roles, test_app,
};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

fn build_file_upload_body(
    boundary: &str,
    file_table_id: &str,
    file_name: &str,
    content_type: &str,
    bytes: &[u8],
) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file_table_id\"\r\n\r\n{file_table_id}\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\nContent-Type: {content_type}\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

async fn response_json(response: axum::response::Response) -> Value {
    serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap()
}

#[tokio::test]
async fn file_management_routes_create_workspace_table_upload_and_read_by_storage_snapshot() {
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let member_id = create_member(&app, &root_cookie, &root_csrf, "file-admin", "change-me").await;
    replace_member_roles(&app, &root_cookie, &root_csrf, &member_id, &["admin"]).await;
    let (admin_cookie, admin_csrf) =
        login_and_capture_cookie(&app, "file-admin", "change-me").await;

    let storages_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/file-storages")
                .header("cookie", &root_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(storages_response.status(), StatusCode::OK);
    let storages_payload = response_json(storages_response).await;
    let default_storage_id = storages_payload["data"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let create_table_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/file-tables")
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "project_assets",
                        "title": "Project Assets"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_table_response.status(), StatusCode::CREATED);
    let table_payload = response_json(create_table_response).await;
    let file_table_id = table_payload["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(
        table_payload["data"]["bound_storage_id"].as_str(),
        Some(default_storage_id.as_str())
    );
    assert_eq!(
        table_payload["data"]["bound_storage_title"].as_str(),
        storages_payload["data"][0]["title"].as_str()
    );

    let backup_root =
        std::env::temp_dir().join(format!("file-management-routes-{}", Uuid::now_v7()));
    let create_storage_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/file-storages")
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "backup_local",
                        "title": "Backup Local",
                        "driver_type": "local",
                        "enabled": true,
                        "is_default": false,
                        "config_json": {
                            "root_path": backup_root.display().to_string(),
                            "public_base_url": null
                        },
                        "rule_json": {}
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_storage_response.status(), StatusCode::CREATED);
    let create_storage_payload = response_json(create_storage_response).await;
    let backup_storage_id = create_storage_payload["data"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let boundary = "----1flowbase-file-upload";
    let upload_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/files/upload")
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(build_file_upload_body(
                    boundary,
                    &file_table_id,
                    "demo.txt",
                    "text/plain",
                    b"hello file-management",
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    let (upload_parts, upload_body) = upload_response.into_parts();
    let upload_body = to_bytes(upload_body, usize::MAX).await.unwrap();
    if upload_parts.status != StatusCode::CREATED {
        panic!(
            "upload failed: status={}, body={}",
            upload_parts.status,
            String::from_utf8_lossy(&upload_body)
        );
    }
    let upload_payload: Value = serde_json::from_slice(&upload_body).unwrap();
    assert_eq!(
        upload_payload["data"]["storage_id"].as_str(),
        Some(default_storage_id.as_str())
    );
    let record_id = upload_payload["data"]["record"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let bind_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/console/file-tables/{file_table_id}/binding"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "bound_storage_id": backup_storage_id }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bind_response.status(), StatusCode::OK);

    let content_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/console/files/{file_table_id}/records/{record_id}/content"
                ))
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(content_response.status(), StatusCode::OK);
    assert_eq!(
        content_response
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok()),
        Some("text/plain")
    );
    assert_eq!(
        to_bytes(content_response.into_body(), usize::MAX)
            .await
            .unwrap(),
        &b"hello file-management"[..]
    );

    let _ = std::fs::remove_dir_all(backup_root);
}

#[tokio::test]
async fn file_management_settings_routes_enforce_root_only_storage_and_binding_rules() {
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let member_id = create_member(&app, &root_cookie, &root_csrf, "file-admin", "change-me").await;
    replace_member_roles(&app, &root_cookie, &root_csrf, &member_id, &["admin"]).await;
    let (admin_cookie, admin_csrf) =
        login_and_capture_cookie(&app, "file-admin", "change-me").await;

    let create_table_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/file-tables")
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "workspace_docs",
                        "title": "Workspace Docs"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_table_response.status(), StatusCode::CREATED);
    let table_payload = response_json(create_table_response).await;
    let file_table_id = table_payload["data"]["id"].as_str().unwrap().to_string();

    let root_storages_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/file-storages")
                .header("cookie", &root_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(root_storages_response.status(), StatusCode::OK);
    let root_storages_payload = response_json(root_storages_response).await;
    let default_storage_title = root_storages_payload["data"][0]["title"]
        .as_str()
        .unwrap()
        .to_string();

    let list_tables_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/file-tables")
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_tables_response.status(), StatusCode::OK);
    let list_tables_payload = response_json(list_tables_response).await;
    assert_eq!(
        list_tables_payload["data"][0]["bound_storage_title"].as_str(),
        Some(default_storage_title.as_str())
    );

    let list_storages_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/file-storages")
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_storages_response.status(), StatusCode::FORBIDDEN);

    let create_storage_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/file-storages")
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "admin_local",
                        "title": "Admin Local",
                        "driver_type": "local",
                        "enabled": true,
                        "is_default": false,
                        "config_json": {
                            "root_path": std::env::temp_dir().join(format!("file-management-admin-{}", Uuid::now_v7())).display().to_string(),
                            "public_base_url": null
                        },
                        "rule_json": {}
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_storage_response.status(), StatusCode::FORBIDDEN);

    let bind_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/console/file-tables/{file_table_id}/binding"))
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "bound_storage_id": Uuid::now_v7() }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bind_response.status(), StatusCode::FORBIDDEN);

    let update_storage_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/console/file-storages/00000000-0000-0000-0000-000000000001")
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({"title":"Admin Local Updated","enabled":true,"is_default":false,"config_json":{"root_path":"/tmp/admin-local"},"rule_json":{}}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_storage_response.status(), StatusCode::FORBIDDEN);

    let delete_storage_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/console/file-storages/00000000-0000-0000-0000-000000000001")
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_storage_response.status(), StatusCode::FORBIDDEN);

    let delete_table_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/console/file-tables/{file_table_id}"))
                .header("cookie", &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_table_response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn file_management_settings_routes_allow_root_to_update_and_delete_storage_and_delete_table()
{
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let storages_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/file-storages")
                .header("cookie", &root_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(storages_response.status(), StatusCode::OK);
    let storages_payload = response_json(storages_response).await;
    let default_storage_id = storages_payload["data"][0]["id"].as_str().unwrap();

    let create_table_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/file-tables")
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "root_cleanup_docs",
                        "title": "Root Cleanup Docs"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_table_response.status(), StatusCode::CREATED);
    let table_payload = response_json(create_table_response).await;
    let file_table_id = table_payload["data"]["id"].as_str().unwrap().to_string();

    let storage_root =
        std::env::temp_dir().join(format!("file-management-update-{}", Uuid::now_v7()));
    let create_storage_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/file-storages")
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "code": "cleanup_local",
                        "title": "Cleanup Local",
                        "driver_type": "local",
                        "enabled": true,
                        "is_default": false,
                        "config_json": {
                            "root_path": storage_root.display().to_string()
                        },
                        "rule_json": {}
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_storage_response.status(), StatusCode::CREATED);
    let storage_payload = response_json(create_storage_response).await;
    let storage_id = storage_payload["data"]["id"].as_str().unwrap().to_string();

    let update_storage_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/console/file-storages/{storage_id}"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "title": "Cleanup Archive",
                        "enabled": false,
                        "is_default": false,
                        "config_json": {
                            "root_path": storage_root.display().to_string(),
                            "public_base_url": "https://files.example.com"
                        },
                        "rule_json": {
                            "description": "archive"
                        }
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_storage_response.status(), StatusCode::OK);
    let updated_storage_payload = response_json(update_storage_response).await;
    assert_eq!(
        updated_storage_payload["data"]["title"].as_str(),
        Some("Cleanup Archive")
    );
    assert_eq!(
        updated_storage_payload["data"]["enabled"].as_bool(),
        Some(false)
    );
    assert_eq!(
        updated_storage_payload["data"]["config_json"]["public_base_url"].as_str(),
        Some("https://files.example.com")
    );

    let delete_table_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/console/file-tables/{file_table_id}"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_table_response.status(), StatusCode::NO_CONTENT);

    let list_tables_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/file-tables")
                .header("cookie", &root_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_tables_response.status(), StatusCode::OK);
    let list_tables_payload = response_json(list_tables_response).await;
    let table_records = list_tables_payload["data"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    assert!(table_records
        .iter()
        .all(|record| record["id"].as_str() != Some(file_table_id.as_str())));

    let delete_storage_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/console/file-storages/{storage_id}"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_storage_response.status(), StatusCode::NO_CONTENT);

    let storages_after_delete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/file-storages")
                .header("cookie", &root_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(storages_after_delete_response.status(), StatusCode::OK);
    let storages_after_delete_payload = response_json(storages_after_delete_response).await;
    let storage_records = storages_after_delete_payload["data"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    assert!(storage_records
        .iter()
        .any(|record| record["id"].as_str() == Some(default_storage_id)));
    assert!(storage_records
        .iter()
        .all(|record| record["id"].as_str() != Some(storage_id.as_str())));

    let _ = std::fs::remove_dir_all(storage_root);
}
