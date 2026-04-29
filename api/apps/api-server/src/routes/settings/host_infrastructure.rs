use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, put},
    Json, Router,
};
use control_plane::host_infrastructure_config::{
    HostInfrastructureConfigService, HostInfrastructureProviderConfigView,
    SaveHostInfrastructureProviderConfigCommand,
};
use plugin_framework::provider_contract::{
    PluginFormCondition, PluginFormFieldSchema, PluginFormOption,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{require_csrf::require_csrf, require_session::require_session},
    response::ApiSuccess,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct PluginFormOptionResponse {
    pub label: String,
    #[schema(value_type = Object)]
    pub value: serde_json::Value,
    pub description: Option<String>,
    pub disabled: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PluginFormConditionResponse {
    pub field: String,
    pub operator: String,
    #[schema(value_type = Object)]
    pub value: Option<serde_json::Value>,
    #[schema(value_type = [Object])]
    pub values: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PluginFormFieldSchemaResponse {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub field_type: String,
    pub control: Option<String>,
    pub group: Option<String>,
    pub order: Option<i32>,
    pub advanced: Option<bool>,
    pub required: Option<bool>,
    pub send_mode: Option<String>,
    pub enabled_by_default: Option<bool>,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    #[schema(value_type = Object)]
    pub default_value: Option<serde_json::Value>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub step: Option<f64>,
    pub precision: Option<u32>,
    pub unit: Option<String>,
    pub options: Vec<PluginFormOptionResponse>,
    pub visible_when: Vec<PluginFormConditionResponse>,
    pub disabled_when: Vec<PluginFormConditionResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HostInfrastructureProviderConfigResponse {
    pub installation_id: String,
    pub extension_id: String,
    pub provider_code: String,
    pub display_name: String,
    pub description: Option<String>,
    pub runtime_status: String,
    pub desired_state: String,
    pub config_ref: String,
    pub contracts: Vec<String>,
    pub enabled_contracts: Vec<String>,
    pub config_schema: Vec<PluginFormFieldSchemaResponse>,
    #[schema(value_type = Object)]
    pub config_json: serde_json::Value,
    pub restart_required: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SaveHostInfrastructureProviderConfigBody {
    pub enabled_contracts: Vec<String>,
    #[schema(value_type = Object)]
    pub config_json: serde_json::Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SaveHostInfrastructureProviderConfigResponse {
    pub restart_required: bool,
    pub installation_desired_state: String,
    pub provider_config_status: String,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route(
            "/settings/host-infrastructure/providers",
            get(list_host_infrastructure_providers),
        )
        .route(
            "/settings/host-infrastructure/providers/:installation_id/:provider_code/config",
            put(save_host_infrastructure_provider_config),
        )
}

#[utoipa::path(
    get,
    path = "/api/console/settings/host-infrastructure/providers",
    responses((status = 200, body = [HostInfrastructureProviderConfigResponse]), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn list_host_infrastructure_providers(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<Vec<HostInfrastructureProviderConfigResponse>>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let providers = HostInfrastructureConfigService::new(state.store.clone())
        .list_providers(context.actor)
        .await?
        .providers
        .into_iter()
        .map(to_provider_response)
        .collect();

    Ok(Json(ApiSuccess::new(providers)))
}

#[utoipa::path(
    put,
    path = "/api/console/settings/host-infrastructure/providers/{installation_id}/{provider_code}/config",
    request_body = SaveHostInfrastructureProviderConfigBody,
    params(("installation_id" = String, Path), ("provider_code" = String, Path)),
    responses((status = 200, body = SaveHostInfrastructureProviderConfigResponse), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn save_host_infrastructure_provider_config(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path((installation_id, provider_code)): Path<(String, String)>,
    Json(body): Json<SaveHostInfrastructureProviderConfigBody>,
) -> Result<Json<ApiSuccess<SaveHostInfrastructureProviderConfigResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;
    let installation_id = Uuid::parse_str(&installation_id)
        .map_err(|_| control_plane::errors::ControlPlaneError::InvalidInput("installation_id"))?;

    let result = HostInfrastructureConfigService::new(state.store.clone())
        .save_provider_config(SaveHostInfrastructureProviderConfigCommand {
            actor_user_id: context.user.id,
            installation_id,
            provider_code,
            enabled_contracts: body.enabled_contracts,
            config_json: body.config_json,
        })
        .await?;

    Ok(Json(ApiSuccess::new(
        SaveHostInfrastructureProviderConfigResponse {
            restart_required: result.restart_required,
            installation_desired_state: result.installation_desired_state,
            provider_config_status: result.provider_config_status,
        },
    )))
}

fn to_provider_response(
    provider: HostInfrastructureProviderConfigView,
) -> HostInfrastructureProviderConfigResponse {
    HostInfrastructureProviderConfigResponse {
        installation_id: provider.installation_id.to_string(),
        extension_id: provider.extension_id,
        provider_code: provider.provider_code,
        display_name: provider.display_name,
        description: provider.description,
        runtime_status: provider.runtime_status,
        desired_state: provider.desired_state,
        config_ref: provider.config_ref,
        contracts: provider.contracts,
        enabled_contracts: provider.enabled_contracts,
        config_schema: provider
            .config_schema
            .into_iter()
            .map(to_plugin_form_field_schema_response)
            .collect(),
        config_json: provider.config_json,
        restart_required: provider.restart_required,
    }
}

fn to_plugin_form_option_response(option: PluginFormOption) -> PluginFormOptionResponse {
    PluginFormOptionResponse {
        label: option.label,
        value: option.value,
        description: option.description,
        disabled: option.disabled,
    }
}

fn to_plugin_form_condition_response(
    condition: PluginFormCondition,
) -> PluginFormConditionResponse {
    PluginFormConditionResponse {
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
        values: condition.values,
    }
}

fn to_plugin_form_field_schema_response(
    field: PluginFormFieldSchema,
) -> PluginFormFieldSchemaResponse {
    PluginFormFieldSchemaResponse {
        key: field.key,
        label: field.label,
        field_type: field.field_type,
        control: field.control,
        group: field.group,
        order: field.order,
        advanced: field.advanced,
        required: field.required,
        send_mode: field.send_mode,
        enabled_by_default: field.enabled_by_default,
        description: field.description,
        placeholder: field.placeholder,
        default_value: field.default_value,
        min: field.min,
        max: field.max,
        step: field.step,
        precision: field.precision,
        unit: field.unit,
        options: field
            .options
            .into_iter()
            .map(to_plugin_form_option_response)
            .collect(),
        visible_when: field
            .visible_when
            .into_iter()
            .map(to_plugin_form_condition_response)
            .collect(),
        disabled_when: field
            .disabled_when
            .into_iter()
            .map(to_plugin_form_condition_response)
            .collect(),
    }
}
