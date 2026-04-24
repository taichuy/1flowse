use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, put},
    Json, Router,
};
use control_plane::file_management::{
    BindFileTableStorageCommand, CreateFileTableCommand, FileTableService,
};
use control_plane::ports::{FileManagementRepository, RuntimeRegistrySync};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{require_csrf::require_csrf, require_session::require_session},
    response::ApiSuccess,
    runtime_registry_sync::ApiRuntimeRegistrySync,
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateFileTableBody {
    pub code: String,
    pub title: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BindFileTableStorageBody {
    pub bound_storage_id: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FileTableResponse {
    pub id: String,
    pub code: String,
    pub title: String,
    pub scope_kind: String,
    pub scope_id: String,
    pub model_definition_id: String,
    pub bound_storage_id: String,
    pub bound_storage_title: Option<String>,
    pub is_builtin: bool,
    pub is_default: bool,
    pub status: String,
}

fn parse_uuid(raw: &str, field: &'static str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(raw)
        .map_err(|_| control_plane::errors::ControlPlaneError::InvalidInput(field).into())
}

async fn to_response<R>(
    repository: &R,
    record: domain::FileTableRecord,
) -> Result<FileTableResponse, ApiError>
where
    R: FileManagementRepository,
{
    let bound_storage_title = repository
        .get_file_storage(record.bound_storage_id)
        .await?
        .map(|storage| storage.title);

    Ok(FileTableResponse {
        id: record.id.to_string(),
        code: record.code,
        title: record.title,
        scope_kind: match record.scope_kind {
            domain::FileTableScopeKind::System => "system".into(),
            domain::FileTableScopeKind::Workspace => "workspace".into(),
        },
        scope_id: record.scope_id.to_string(),
        model_definition_id: record.model_definition_id.to_string(),
        bound_storage_id: record.bound_storage_id.to_string(),
        bound_storage_title,
        is_builtin: record.is_builtin,
        is_default: record.is_default,
        status: record.status,
    })
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route(
            "/file-tables",
            get(list_file_tables).post(create_file_table),
        )
        .route("/file-tables/:id/binding", put(bind_file_table_storage))
}

#[utoipa::path(
    get,
    path = "/api/console/file-tables",
    responses((status = 200, body = [FileTableResponse]), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn list_file_tables(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<Vec<FileTableResponse>>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let tables = FileTableService::new(state.store.clone())
        .list_tables(context.user.id)
        .await?;
    let mut response = Vec::with_capacity(tables.len());

    for table in tables {
        response.push(to_response(&state.store, table).await?);
    }

    Ok(Json(ApiSuccess::new(response)))
}

#[utoipa::path(
    post,
    path = "/api/console/file-tables",
    request_body = CreateFileTableBody,
    responses((status = 201, body = FileTableResponse), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody))
)]
pub async fn create_file_table(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<CreateFileTableBody>,
) -> Result<(StatusCode, Json<ApiSuccess<FileTableResponse>>), ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    let created = FileTableService::new(state.store.clone())
        .create_table(CreateFileTableCommand {
            actor_user_id: context.user.id,
            code: body.code,
            title: body.title,
        })
        .await?;
    ApiRuntimeRegistrySync::new(state.store.clone(), state.runtime_engine.registry().clone())
        .rebuild()
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiSuccess::new(to_response(&state.store, created).await?)),
    ))
}

#[utoipa::path(
    put,
    path = "/api/console/file-tables/{id}/binding",
    request_body = BindFileTableStorageBody,
    params(("id" = String, Path, description = "File table id")),
    responses((status = 200, body = FileTableResponse), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody))
)]
pub async fn bind_file_table_storage(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(file_table_id): Path<String>,
    Json(body): Json<BindFileTableStorageBody>,
) -> Result<Json<ApiSuccess<FileTableResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    let updated = FileTableService::new(state.store.clone())
        .bind_storage(BindFileTableStorageCommand {
            actor_user_id: context.user.id,
            file_table_id: parse_uuid(&file_table_id, "file_table_id")?,
            bound_storage_id: parse_uuid(&body.bound_storage_id, "bound_storage_id")?,
        })
        .await?;

    Ok(Json(ApiSuccess::new(
        to_response(&state.store, updated).await?,
    )))
}
