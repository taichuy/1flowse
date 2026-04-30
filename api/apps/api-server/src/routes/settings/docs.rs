use std::sync::Arc;

use access_control::ensure_permission;
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::get,
    Json, Router,
};
use control_plane::errors::ControlPlaneError;
use control_plane::model_definition::ModelDefinitionService;
use serde::Serialize;
use serde_json::Value;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::require_session::require_session,
    openapi_docs::{DocsCatalog, DocsCatalogCategoryOperations},
    response::ApiSuccess,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct DataModelOpenApiDocumentResponse {
    pub openapi: String,
    #[schema(value_type = Object)]
    pub info: Value,
    #[schema(value_type = Object)]
    pub paths: Value,
    #[schema(value_type = Object)]
    pub components: Value,
    #[serde(rename = "x-data-model")]
    #[schema(value_type = Object)]
    pub data_model: Value,
    #[serde(rename = "x-scope-permission-note")]
    pub scope_permission_note: String,
    #[serde(rename = "x-external-source-safety-limits")]
    pub external_source_safety_limits: String,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/docs/catalog", get(get_docs_catalog))
        .route(
            "/docs/categories/:category_id/operations",
            get(get_category_operations),
        )
        .route(
            "/docs/categories/:category_id/openapi.json",
            get(get_category_openapi),
        )
        .route(
            "/docs/operations/:operation_id/openapi.json",
            get(get_operation_openapi),
        )
        .route(
            "/docs/data-models/:model_id/openapi.json",
            get(get_data_model_openapi),
        )
}

pub async fn get_docs_catalog(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<DocsCatalog>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    ensure_permission(&context.actor, "api_reference.view.all")
        .map_err(ControlPlaneError::PermissionDenied)?;

    Ok(Json(ApiSuccess::new(state.api_docs.catalog().clone())))
}

pub async fn get_category_operations(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(category_id): Path<String>,
) -> Result<Json<ApiSuccess<DocsCatalogCategoryOperations>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    ensure_permission(&context.actor, "api_reference.view.all")
        .map_err(ControlPlaneError::PermissionDenied)?;

    let operations = state
        .api_docs
        .category_operations(&category_id)
        .cloned()
        .ok_or(ControlPlaneError::NotFound("category_id"))?;

    Ok(Json(ApiSuccess::new(operations)))
}

pub async fn get_category_openapi(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(category_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let context = require_session(&state, &headers).await?;
    ensure_permission(&context.actor, "api_reference.view.all")
        .map_err(ControlPlaneError::PermissionDenied)?;

    let spec = state
        .api_docs
        .category_spec(&category_id)
        .cloned()
        .ok_or(ControlPlaneError::NotFound("category_id"))?;

    Ok(Json(spec))
}

pub async fn get_operation_openapi(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(operation_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let context = require_session(&state, &headers).await?;
    ensure_permission(&context.actor, "api_reference.view.all")
        .map_err(ControlPlaneError::PermissionDenied)?;

    let spec = state
        .api_docs
        .operation_spec(&operation_id)
        .cloned()
        .ok_or(ControlPlaneError::NotFound("operation_id"))?;

    Ok(Json(spec))
}

#[utoipa::path(
    get,
    path = "/api/console/docs/data-models/{model_id}/openapi.json",
    params(("model_id" = String, Path, description = "Data Model id")),
    responses((status = 200, body = DataModelOpenApiDocumentResponse), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody))
)]
pub async fn get_data_model_openapi(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(model_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let context = require_session(&state, &headers).await?;
    ensure_permission(&context.actor, "api_reference.view.all")
        .map_err(ControlPlaneError::PermissionDenied)?;

    let model_id =
        Uuid::parse_str(&model_id).map_err(|_| ControlPlaneError::InvalidInput("model_id"))?;
    let model = ModelDefinitionService::new(state.store.clone())
        .get_model(context.user.id, model_id)
        .await?;

    Ok(Json(build_data_model_openapi(&model)))
}

fn build_data_model_openapi(model: &domain::ModelDefinitionRecord) -> Value {
    let records_path = format!("/api/runtime/models/{}/records", model.code);
    let record_path = format!("/api/runtime/models/{}/records/{{id}}", model.code);
    let schema_name = record_schema_name(&model.code);
    let schema_ref = format!("#/components/schemas/{schema_name}");

    serde_json::json!({
        "openapi": "3.1.0",
        "info": {
            "title": format!("{} Data Model API", model.title),
            "version": "1.0.0"
        },
        "security": [{ "apiKeyBearer": [] }],
        "paths": {
            records_path: {
                "get": {
                    "operationId": format!("list_{}_records", model.code),
                    "summary": format!("List {} records", model.title),
                    "description": "List records with filter, sort, pagination, and relation expansion. Requires API key action permission plus an enabled scope grant.",
                    "security": [{ "apiKeyBearer": [] }],
                    "parameters": runtime_list_parameters(),
                    "responses": runtime_responses(&schema_ref, true)
                },
                "post": {
                    "operationId": format!("create_{}_record", model.code),
                    "summary": format!("Create {} record", model.title),
                    "description": "Create a record. Write APIs require API key write permission, scope permission, and audit logging.",
                    "security": [{ "apiKeyBearer": [] }],
                    "requestBody": json_request_body(&schema_ref),
                    "responses": runtime_responses(&schema_ref, false)
                }
            },
            record_path: {
                "get": {
                    "operationId": format!("get_{}_record", model.code),
                    "summary": format!("Get {} record", model.title),
                    "security": [{ "apiKeyBearer": [] }],
                    "parameters": [id_parameter(), expand_parameter()],
                    "responses": runtime_responses(&schema_ref, false)
                },
                "patch": {
                    "operationId": format!("update_{}_record", model.code),
                    "summary": format!("Update {} record", model.title),
                    "description": "Update a record. Write APIs require API key write permission, scope permission, and audit logging.",
                    "security": [{ "apiKeyBearer": [] }],
                    "parameters": [id_parameter()],
                    "requestBody": json_request_body(&schema_ref),
                    "responses": runtime_responses(&schema_ref, false)
                },
                "delete": {
                    "operationId": format!("delete_{}_record", model.code),
                    "summary": format!("Delete {} record", model.title),
                    "description": "Delete a record. Write APIs require API key delete permission, scope permission, and audit logging.",
                    "security": [{ "apiKeyBearer": [] }],
                    "parameters": [id_parameter()],
                    "responses": runtime_delete_responses()
                }
            }
        },
        "components": {
            "securitySchemes": {
                "apiKeyBearer": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "API Key",
                    "description": "Use Authorization: Bearer <api_key> for Data Model runtime APIs."
                }
            },
            "schemas": {
                schema_name: record_schema(model)
            }
        },
        "x-data-model": {
            "id": model.id.to_string(),
            "code": model.code,
            "status": model.status.as_str(),
            "api_exposure_status": model.api_exposure_status.as_str(),
            "source_kind": model.source_kind.as_str(),
            "protected": model.protection.is_protected
        },
        "x-scope-permission-note": "Runtime Data Model APIs require API key action permission and an enabled owner or scope_all scope grant for the request scope.",
        "x-external-source-safety-limits": external_source_safety_limits(model)
    })
}

fn runtime_list_parameters() -> Value {
    serde_json::json!([
        {
            "name": "filter",
            "in": "query",
            "required": false,
            "schema": { "type": "string" },
            "example": "status:eq:paid",
            "description": "Single filter expression using field:operator:value."
        },
        {
            "name": "sort",
            "in": "query",
            "required": false,
            "schema": { "type": "string" },
            "example": "created_at:desc",
            "description": "Single sort expression using field:asc or field:desc."
        },
        expand_parameter()
    ])
}

fn id_parameter() -> Value {
    serde_json::json!({
        "name": "id",
        "in": "path",
        "required": true,
        "schema": { "type": "string", "format": "uuid" }
    })
}

fn expand_parameter() -> Value {
    serde_json::json!({
        "name": "expand",
        "in": "query",
        "required": false,
        "schema": { "type": "string" },
        "example": "customer,items",
        "description": "Comma-separated relation field codes to expand."
    })
}

fn json_request_body(schema_ref: &str) -> Value {
    serde_json::json!({
        "required": true,
        "content": {
            "application/json": {
                "schema": { "$ref": schema_ref }
            }
        }
    })
}

fn runtime_responses(schema_ref: &str, list: bool) -> Value {
    let success_schema = if list {
        serde_json::json!({
            "type": "object",
            "properties": {
                "data": {
                    "type": "array",
                    "items": { "$ref": schema_ref }
                },
                "total": { "type": "integer" }
            }
        })
    } else {
        serde_json::json!({ "$ref": schema_ref })
    };

    serde_json::json!({
        "200": {
            "description": "Success",
            "content": { "application/json": { "schema": success_schema } }
        },
        "201": { "description": "Created" },
        "400": { "description": "Bad request or invalid filter/sort/expand expression" },
        "401": { "description": "Missing or invalid API key" },
        "403": { "description": "API key, action permission, or scope grant denied" },
        "404": { "description": "Data Model or record not found" },
        "409": { "description": "Data Model is not published, disabled, broken, or unsafe" }
    })
}

fn runtime_delete_responses() -> Value {
    serde_json::json!({
        "200": { "description": "Deleted" },
        "401": { "description": "Missing or invalid API key" },
        "403": { "description": "API key, action permission, or scope grant denied" },
        "404": { "description": "Data Model or record not found" },
        "409": { "description": "Data Model is not published, disabled, broken, or unsafe" }
    })
}

fn record_schema(model: &domain::ModelDefinitionRecord) -> Value {
    let mut properties = serde_json::Map::new();
    let mut required = Vec::new();
    for field in &model.fields {
        properties.insert(field.code.clone(), field_schema(field));
        if field.is_required {
            required.push(Value::String(field.code.clone()));
        }
    }

    serde_json::json!({
        "type": "object",
        "properties": properties,
        "required": required
    })
}

fn field_schema(field: &domain::ModelFieldRecord) -> Value {
    match field.field_kind {
        domain::ModelFieldKind::Number => serde_json::json!({ "type": "number" }),
        domain::ModelFieldKind::Boolean => serde_json::json!({ "type": "boolean" }),
        domain::ModelFieldKind::Datetime => {
            serde_json::json!({ "type": "string", "format": "date-time" })
        }
        domain::ModelFieldKind::Json => serde_json::json!({ "type": "object" }),
        domain::ModelFieldKind::ManyToOne
        | domain::ModelFieldKind::OneToMany
        | domain::ModelFieldKind::ManyToMany => serde_json::json!({
            "type": "string",
            "format": "uuid",
            "description": "Relation record id or relation expansion target."
        }),
        domain::ModelFieldKind::String
        | domain::ModelFieldKind::Enum
        | domain::ModelFieldKind::Text => serde_json::json!({ "type": "string" }),
    }
}

fn external_source_safety_limits(model: &domain::ModelDefinitionRecord) -> String {
    if model.source_kind == domain::DataModelSourceKind::ExternalSource {
        let supports_scope_filter = model
            .external_capability_snapshot
            .as_ref()
            .and_then(|snapshot| snapshot.get("supports_scope_filter"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        return format!(
            "External source APIs require provider-enforced scope filter support before exposure; supports_scope_filter={supports_scope_filter}."
        );
    }

    "Main-source APIs use platform scope filter enforcement; external source exposure still requires provider scope filter support.".to_string()
}

fn record_schema_name(code: &str) -> String {
    let mut name = String::new();
    for segment in code.split(['_', '-']).filter(|segment| !segment.is_empty()) {
        let mut chars = segment.chars();
        if let Some(first) = chars.next() {
            name.extend(first.to_uppercase());
            name.push_str(chars.as_str());
        }
    }
    if name.is_empty() {
        name.push_str("DataModel");
    }
    name.push_str("Record");
    name
}
