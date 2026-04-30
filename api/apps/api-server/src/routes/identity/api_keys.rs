use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::post,
    Json, Router,
};
use control_plane::auth::{ApiKeyDataModelPermissionCommand, ApiKeyService, CreateApiKeyCommand};
use serde::{Deserialize, Serialize};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{require_csrf::require_csrf, require_session::require_session},
    response::ApiSuccess,
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scope_kind: Option<String>,
    pub scope_id: Option<Uuid>,
    pub expires_at: Option<String>,
    pub permissions: Vec<ApiKeyDataModelPermissionRequest>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ApiKeyDataModelPermissionRequest {
    pub data_model_id: Uuid,
    pub list: bool,
    pub get: bool,
    pub create: bool,
    pub update: bool,
    pub delete: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub token: String,
    pub token_prefix: String,
    pub creator_user_id: Uuid,
    pub scope_kind: String,
    pub scope_id: Uuid,
    pub enabled: bool,
    pub expires_at: Option<String>,
    pub permissions: Vec<ApiKeyDataModelPermissionResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ApiKeyDataModelPermissionResponse {
    pub data_model_id: Uuid,
    pub list: bool,
    pub get: bool,
    pub create: bool,
    pub update: bool,
    pub delete: bool,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new().route("/api-keys", post(create_api_key))
}

fn parse_scope_kind(raw: Option<String>) -> Result<Option<domain::DataModelScopeKind>, ApiError> {
    raw.map(|value| match value.as_str() {
        "workspace" => Ok(domain::DataModelScopeKind::Workspace),
        "system" => Ok(domain::DataModelScopeKind::System),
        _ => Err(control_plane::errors::ControlPlaneError::InvalidInput("scope_kind").into()),
    })
    .transpose()
}

fn parse_expires_at(raw: Option<String>) -> Result<Option<OffsetDateTime>, ApiError> {
    raw.map(|value| {
        OffsetDateTime::parse(&value, &Rfc3339).map_err(|_| {
            control_plane::errors::ControlPlaneError::InvalidInput("expires_at").into()
        })
    })
    .transpose()
}

fn format_optional_time(value: Option<OffsetDateTime>) -> Option<String> {
    value.map(|value| value.format(&Rfc3339).unwrap())
}

#[utoipa::path(
    post,
    path = "/api/console/api-keys",
    request_body = CreateApiKeyRequest,
    responses((status = 201, body = CreateApiKeyResponse), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn create_api_key(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<(StatusCode, Json<ApiSuccess<CreateApiKeyResponse>>), ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;
    let result = ApiKeyService::new(state.store.clone())
        .create_api_key(CreateApiKeyCommand {
            actor_user_id: context.actor.user_id,
            name: payload.name,
            scope_kind: parse_scope_kind(payload.scope_kind)?,
            scope_id: payload.scope_id,
            expires_at: parse_expires_at(payload.expires_at)?,
            permissions: payload
                .permissions
                .into_iter()
                .map(|permission| ApiKeyDataModelPermissionCommand {
                    data_model_id: permission.data_model_id,
                    allow_list: permission.list,
                    allow_get: permission.get,
                    allow_create: permission.create,
                    allow_update: permission.update,
                    allow_delete: permission.delete,
                })
                .collect(),
        })
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiSuccess::new(CreateApiKeyResponse {
            id: result.api_key.id,
            name: result.api_key.name,
            token: result.token,
            token_prefix: result.api_key.token_prefix,
            creator_user_id: result.api_key.creator_user_id,
            scope_kind: result.api_key.scope_kind.as_str().to_string(),
            scope_id: result.api_key.scope_id,
            enabled: result.api_key.enabled,
            expires_at: format_optional_time(result.api_key.expires_at),
            permissions: result
                .permissions
                .into_iter()
                .map(|permission| ApiKeyDataModelPermissionResponse {
                    data_model_id: permission.data_model_id,
                    list: permission.allow_list,
                    get: permission.allow_get,
                    create: permission.allow_create,
                    update: permission.allow_update,
                    delete: permission.allow_delete,
                })
                .collect(),
        })),
    ))
}
