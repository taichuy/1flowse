use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::get,
    Json, Router,
};
use control_plane::file_management::{CreateFileStorageCommand, FileStorageService};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{require_csrf::require_csrf, require_session::require_session},
    response::ApiSuccess,
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateFileStorageBody {
    pub code: String,
    pub title: String,
    pub driver_type: String,
    pub enabled: bool,
    pub is_default: bool,
    #[schema(value_type = Object)]
    pub config_json: serde_json::Value,
    #[schema(value_type = Object)]
    pub rule_json: serde_json::Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FileStorageResponse {
    pub id: String,
    pub code: String,
    pub title: String,
    pub driver_type: String,
    pub enabled: bool,
    pub is_default: bool,
    #[schema(value_type = Object)]
    pub config_json: serde_json::Value,
    #[schema(value_type = Object)]
    pub rule_json: serde_json::Value,
    pub health_status: String,
    pub last_health_error: Option<String>,
}

fn to_response(record: domain::FileStorageRecord) -> FileStorageResponse {
    FileStorageResponse {
        id: record.id.to_string(),
        code: record.code,
        title: record.title,
        driver_type: record.driver_type,
        enabled: record.enabled,
        is_default: record.is_default,
        config_json: record.config_json,
        rule_json: record.rule_json,
        health_status: match record.health_status {
            domain::FileStorageHealthStatus::Unknown => "unknown".into(),
            domain::FileStorageHealthStatus::Ready => "ready".into(),
            domain::FileStorageHealthStatus::Failed => "failed".into(),
        },
        last_health_error: record.last_health_error,
    }
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new().route("/file-storages", get(list_file_storages).post(create_file_storage))
}

#[utoipa::path(
    get,
    path = "/api/console/file-storages",
    responses((status = 200, body = [FileStorageResponse]), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn list_file_storages(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<Vec<FileStorageResponse>>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let storages = FileStorageService::new(state.store.clone())
        .list_storages(context.user.id)
        .await?;

    Ok(Json(ApiSuccess::new(
        storages.into_iter().map(to_response).collect(),
    )))
}

#[utoipa::path(
    post,
    path = "/api/console/file-storages",
    request_body = CreateFileStorageBody,
    responses((status = 201, body = FileStorageResponse), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn create_file_storage(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<CreateFileStorageBody>,
) -> Result<(StatusCode, Json<ApiSuccess<FileStorageResponse>>), ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    let created = FileStorageService::new(state.store.clone())
        .create_storage(CreateFileStorageCommand {
            actor_user_id: context.user.id,
            code: body.code,
            title: body.title,
            driver_type: body.driver_type,
            enabled: body.enabled,
            is_default: body.is_default,
            config_json: body.config_json,
            rule_json: body.rule_json,
        })
        .await?;

    Ok((StatusCode::CREATED, Json(ApiSuccess::new(to_response(created)))))
}
