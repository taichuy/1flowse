use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, patch, post},
    Json, Router,
};
use control_plane::model_provider::{
    CreateModelProviderInstanceCommand, DeleteModelProviderInstanceCommand,
    ModelProviderCatalogEntry, ModelProviderInstanceView, ModelProviderModelCatalog,
    ModelProviderOptionEntry, ModelProviderService, UpdateModelProviderInstanceCommand,
    ValidateModelProviderResult,
};
use plugin_framework::{
    provider_contract::ProviderModelDescriptor, provider_package::ProviderConfigField,
};
use serde::{Deserialize, Serialize};
use time::format_description::well_known::Rfc3339;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{require_csrf::require_csrf, require_session::require_session},
    provider_runtime::ApiProviderRuntime,
    response::ApiSuccess,
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateModelProviderBody {
    pub installation_id: String,
    pub display_name: String,
    #[schema(value_type = Object)]
    pub config: serde_json::Value,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateModelProviderBody {
    pub display_name: String,
    #[schema(value_type = Object)]
    pub config: serde_json::Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModelProviderConfigFieldResponse {
    pub key: String,
    pub field_type: String,
    pub required: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProviderModelDescriptorResponse {
    pub model_id: String,
    pub display_name: String,
    pub source: String,
    pub supports_streaming: bool,
    pub supports_tool_call: bool,
    pub supports_multimodal: bool,
    pub context_window: Option<u64>,
    pub max_output_tokens: Option<u64>,
    #[schema(value_type = Object)]
    pub provider_metadata: serde_json::Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModelProviderCatalogEntryResponse {
    pub installation_id: String,
    pub provider_code: String,
    pub plugin_id: String,
    pub plugin_version: String,
    pub display_name: String,
    pub protocol: String,
    pub help_url: Option<String>,
    pub default_base_url: Option<String>,
    pub model_discovery_mode: String,
    pub supports_model_fetch_without_credentials: bool,
    pub enabled: bool,
    pub form_schema: Vec<ModelProviderConfigFieldResponse>,
    pub predefined_models: Vec<ProviderModelDescriptorResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModelProviderInstanceResponse {
    pub id: String,
    pub installation_id: String,
    pub provider_code: String,
    pub protocol: String,
    pub display_name: String,
    pub status: String,
    #[schema(value_type = Object)]
    pub config_json: serde_json::Value,
    pub last_validated_at: Option<String>,
    pub last_validation_status: Option<String>,
    pub last_validation_message: Option<String>,
    pub catalog_refresh_status: Option<String>,
    pub catalog_last_error_message: Option<String>,
    pub catalog_refreshed_at: Option<String>,
    pub model_count: usize,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ValidateModelProviderResponse {
    pub instance: ModelProviderInstanceResponse,
    #[schema(value_type = Object)]
    pub output: serde_json::Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModelProviderModelCatalogResponse {
    pub provider_instance_id: String,
    pub refresh_status: String,
    pub source: String,
    pub last_error_message: Option<String>,
    pub refreshed_at: Option<String>,
    pub models: Vec<ProviderModelDescriptorResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModelProviderOptionResponse {
    pub provider_instance_id: String,
    pub provider_code: String,
    pub protocol: String,
    pub display_name: String,
    pub models: Vec<ProviderModelDescriptorResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModelProviderOptionsResponse {
    pub instances: Vec<ModelProviderOptionResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DeletedResponse {
    pub deleted: bool,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/model-providers/catalog", get(list_catalog))
        .route(
            "/model-providers",
            get(list_instances).post(create_instance),
        )
        .route("/model-providers/options", get(list_options))
        .route(
            "/model-providers/:id",
            patch(update_instance).delete(delete_instance),
        )
        .route("/model-providers/:id/validate", post(validate_instance))
        .route("/model-providers/:id/models", get(list_models))
        .route("/model-providers/:id/models/refresh", post(refresh_models))
}

fn service(
    state: &ApiState,
) -> ModelProviderService<storage_pg::PgControlPlaneStore, ApiProviderRuntime> {
    ModelProviderService::new(
        state.store.clone(),
        ApiProviderRuntime::new(state.provider_runtime.clone()),
        state.provider_secret_master_key.clone(),
    )
}

fn format_time(value: time::OffsetDateTime) -> String {
    value.format(&Rfc3339).unwrap()
}

fn format_optional_time(value: Option<time::OffsetDateTime>) -> Option<String> {
    value.map(format_time)
}

fn parse_uuid(raw: &str, field: &'static str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(raw)
        .map_err(|_| control_plane::errors::ControlPlaneError::InvalidInput(field).into())
}

fn to_config_field_response(field: ProviderConfigField) -> ModelProviderConfigFieldResponse {
    ModelProviderConfigFieldResponse {
        key: field.key,
        field_type: field.field_type,
        required: field.required,
    }
}

fn to_model_descriptor_response(model: ProviderModelDescriptor) -> ProviderModelDescriptorResponse {
    ProviderModelDescriptorResponse {
        model_id: model.model_id,
        display_name: model.display_name,
        source: format!("{:?}", model.source).to_ascii_lowercase(),
        supports_streaming: model.supports_streaming,
        supports_tool_call: model.supports_tool_call,
        supports_multimodal: model.supports_multimodal,
        context_window: model.context_window,
        max_output_tokens: model.max_output_tokens,
        provider_metadata: model.provider_metadata,
    }
}

fn to_catalog_response(entry: ModelProviderCatalogEntry) -> ModelProviderCatalogEntryResponse {
    ModelProviderCatalogEntryResponse {
        installation_id: entry.installation_id.to_string(),
        provider_code: entry.provider_code,
        plugin_id: entry.plugin_id,
        plugin_version: entry.plugin_version,
        display_name: entry.display_name,
        protocol: entry.protocol,
        help_url: entry.help_url,
        default_base_url: entry.default_base_url,
        model_discovery_mode: entry.model_discovery_mode,
        supports_model_fetch_without_credentials: entry.supports_model_fetch_without_credentials,
        enabled: entry.enabled,
        form_schema: entry
            .form_schema
            .into_iter()
            .map(to_config_field_response)
            .collect(),
        predefined_models: entry
            .predefined_models
            .into_iter()
            .map(to_model_descriptor_response)
            .collect(),
    }
}

fn to_instance_response(view: ModelProviderInstanceView) -> ModelProviderInstanceResponse {
    let model_count = view
        .cache
        .as_ref()
        .and_then(|cache| cache.models_json.as_array().map(|items| items.len()))
        .unwrap_or(0);
    ModelProviderInstanceResponse {
        id: view.instance.id.to_string(),
        installation_id: view.instance.installation_id.to_string(),
        provider_code: view.instance.provider_code,
        protocol: view.instance.protocol,
        display_name: view.instance.display_name,
        status: view.instance.status.as_str().to_string(),
        config_json: view.instance.config_json,
        last_validated_at: format_optional_time(view.instance.last_validated_at),
        last_validation_status: view
            .instance
            .last_validation_status
            .map(|status| status.as_str().to_string()),
        last_validation_message: view.instance.last_validation_message,
        catalog_refresh_status: view
            .cache
            .as_ref()
            .map(|cache| cache.refresh_status.as_str().to_string()),
        catalog_last_error_message: view
            .cache
            .as_ref()
            .and_then(|cache| cache.last_error_message.clone()),
        catalog_refreshed_at: view
            .cache
            .as_ref()
            .and_then(|cache| format_optional_time(cache.refreshed_at)),
        model_count,
    }
}

fn to_validate_response(result: ValidateModelProviderResult) -> ValidateModelProviderResponse {
    ValidateModelProviderResponse {
        instance: to_instance_response(ModelProviderInstanceView {
            instance: result.instance,
            cache: Some(result.cache),
        }),
        output: result.output,
    }
}

fn to_model_catalog_response(
    catalog: ModelProviderModelCatalog,
) -> ModelProviderModelCatalogResponse {
    ModelProviderModelCatalogResponse {
        provider_instance_id: catalog.provider_instance_id.to_string(),
        refresh_status: catalog.refresh_status.as_str().to_string(),
        source: catalog.source.as_str().to_string(),
        last_error_message: catalog.last_error_message,
        refreshed_at: format_optional_time(catalog.refreshed_at),
        models: catalog
            .models
            .into_iter()
            .map(to_model_descriptor_response)
            .collect(),
    }
}

fn to_option_response(option: ModelProviderOptionEntry) -> ModelProviderOptionResponse {
    ModelProviderOptionResponse {
        provider_instance_id: option.provider_instance_id.to_string(),
        provider_code: option.provider_code,
        protocol: option.protocol,
        display_name: option.display_name,
        models: option
            .models
            .into_iter()
            .map(to_model_descriptor_response)
            .collect(),
    }
}

#[utoipa::path(
    get,
    path = "/api/console/model-providers/catalog",
    operation_id = "model_provider_list_catalog",
    responses((status = 200, body = [ModelProviderCatalogEntryResponse]), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn list_catalog(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<Vec<ModelProviderCatalogEntryResponse>>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let catalog = service(&state).list_catalog(context.user.id).await?;
    Ok(Json(ApiSuccess::new(
        catalog.into_iter().map(to_catalog_response).collect(),
    )))
}

#[utoipa::path(
    get,
    path = "/api/console/model-providers",
    operation_id = "model_provider_list_instances",
    responses((status = 200, body = [ModelProviderInstanceResponse]), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn list_instances(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<Vec<ModelProviderInstanceResponse>>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let instances = service(&state).list_instances(context.user.id).await?;
    Ok(Json(ApiSuccess::new(
        instances.into_iter().map(to_instance_response).collect(),
    )))
}

#[utoipa::path(
    post,
    path = "/api/console/model-providers",
    operation_id = "model_provider_create_instance",
    request_body = CreateModelProviderBody,
    responses((status = 201, body = ModelProviderInstanceResponse), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn create_instance(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<CreateModelProviderBody>,
) -> Result<(StatusCode, Json<ApiSuccess<ModelProviderInstanceResponse>>), ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;
    let created = service(&state)
        .create_instance(CreateModelProviderInstanceCommand {
            actor_user_id: context.user.id,
            installation_id: parse_uuid(&body.installation_id, "installation_id")?,
            display_name: body.display_name,
            config_json: body.config,
        })
        .await?;
    Ok((
        StatusCode::CREATED,
        Json(ApiSuccess::new(to_instance_response(created))),
    ))
}

#[utoipa::path(
    patch,
    path = "/api/console/model-providers/{id}",
    operation_id = "model_provider_update_instance",
    request_body = UpdateModelProviderBody,
    responses((status = 200, body = ModelProviderInstanceResponse), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn update_instance(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<UpdateModelProviderBody>,
) -> Result<Json<ApiSuccess<ModelProviderInstanceResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;
    let updated = service(&state)
        .update_instance(UpdateModelProviderInstanceCommand {
            actor_user_id: context.user.id,
            instance_id: parse_uuid(&id, "id")?,
            display_name: body.display_name,
            config_json: body.config,
        })
        .await?;
    Ok(Json(ApiSuccess::new(to_instance_response(updated))))
}

#[utoipa::path(
    post,
    path = "/api/console/model-providers/{id}/validate",
    operation_id = "model_provider_validate_instance",
    responses((status = 200, body = ValidateModelProviderResponse), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn validate_instance(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<ValidateModelProviderResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;
    let result = service(&state)
        .validate_instance(context.user.id, parse_uuid(&id, "id")?)
        .await?;
    Ok(Json(ApiSuccess::new(to_validate_response(result))))
}

#[utoipa::path(
    get,
    path = "/api/console/model-providers/{id}/models",
    operation_id = "model_provider_list_models",
    responses((status = 200, body = ModelProviderModelCatalogResponse), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn list_models(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<ModelProviderModelCatalogResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let catalog = service(&state)
        .list_models(context.user.id, parse_uuid(&id, "id")?)
        .await?;
    Ok(Json(ApiSuccess::new(to_model_catalog_response(catalog))))
}

#[utoipa::path(
    post,
    path = "/api/console/model-providers/{id}/models/refresh",
    operation_id = "model_provider_refresh_models",
    responses((status = 200, body = ModelProviderModelCatalogResponse), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn refresh_models(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<ModelProviderModelCatalogResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;
    let catalog = service(&state)
        .refresh_models(context.user.id, parse_uuid(&id, "id")?)
        .await?;
    Ok(Json(ApiSuccess::new(to_model_catalog_response(catalog))))
}

#[utoipa::path(
    delete,
    path = "/api/console/model-providers/{id}",
    operation_id = "model_provider_delete_instance",
    responses((status = 200, body = DeletedResponse), (status = 409, body = crate::error_response::ErrorBody))
)]
pub async fn delete_instance(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<DeletedResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;
    service(&state)
        .delete_instance(DeleteModelProviderInstanceCommand {
            actor_user_id: context.user.id,
            instance_id: parse_uuid(&id, "id")?,
        })
        .await?;
    Ok(Json(ApiSuccess::new(DeletedResponse { deleted: true })))
}

#[utoipa::path(
    get,
    path = "/api/console/model-providers/options",
    operation_id = "model_provider_list_options",
    responses((status = 200, body = ModelProviderOptionsResponse), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn list_options(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<ModelProviderOptionsResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let options = service(&state).options(context.user.id).await?;
    Ok(Json(ApiSuccess::new(ModelProviderOptionsResponse {
        instances: options.into_iter().map(to_option_response).collect(),
    })))
}
