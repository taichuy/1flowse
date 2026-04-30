use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{
        require_csrf::require_csrf,
        require_session::{require_session, RequestContext},
    },
    response::ApiSuccess,
};
use control_plane::{audit::audit_log, ports::AuthRepository};

fn map_runtime_error(error: anyhow::Error) -> ApiError {
    if let Some(runtime_core::runtime_acl::RuntimeAclError::PermissionDenied(reason)) =
        error.downcast_ref::<runtime_core::runtime_acl::RuntimeAclError>()
    {
        return control_plane::errors::ControlPlaneError::PermissionDenied(reason).into();
    }

    if error.to_string().contains("runtime record not found") {
        return control_plane::errors::ControlPlaneError::NotFound("runtime_record").into();
    }

    if let Some(model_error) =
        error.downcast_ref::<runtime_core::runtime_engine::RuntimeModelError>()
    {
        let code = match model_error {
            runtime_core::runtime_engine::RuntimeModelError::Unavailable(_) => {
                "runtime_model_unavailable"
            }
            runtime_core::runtime_engine::RuntimeModelError::NotPublished(_) => {
                "model_not_published"
            }
            runtime_core::runtime_engine::RuntimeModelError::Disabled(_) => "model_disabled",
            runtime_core::runtime_engine::RuntimeModelError::Broken(_) => "model_broken",
        };
        return control_plane::errors::ControlPlaneError::Conflict(code).into();
    }

    error.into()
}

#[derive(Debug, Deserialize, Default)]
pub struct RuntimeListQueryParams {
    pub filter: Option<String>,
    pub sort: Option<String>,
    pub expand: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, ToSchema)]
#[schema(value_type = Object)]
pub struct RuntimeRecordEnvelope(#[allow(dead_code)] Value);

#[derive(Debug, Serialize, ToSchema)]
pub struct RuntimeListResponse {
    #[schema(value_type = Vec<RuntimeRecordEnvelope>)]
    pub items: Vec<Value>,
    pub total: i64,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route(
            "/models/:model_code/records",
            get(list_records).post(create_record),
        )
        .route(
            "/models/:model_code/records/:id",
            get(get_record).patch(update_record).delete(delete_record),
        )
}

fn parse_filters(
    filter: Option<&str>,
) -> Result<Vec<runtime_core::runtime_engine::RuntimeFilterInput>, ApiError> {
    let Some(filter) = filter else {
        return Ok(vec![]);
    };
    let mut parts = filter.splitn(3, ':');
    let field_code = parts
        .next()
        .ok_or(control_plane::errors::ControlPlaneError::InvalidInput(
            "filter",
        ))?;
    let operator = parts
        .next()
        .ok_or(control_plane::errors::ControlPlaneError::InvalidInput(
            "filter",
        ))?;
    let value = parts
        .next()
        .ok_or(control_plane::errors::ControlPlaneError::InvalidInput(
            "filter",
        ))?;

    Ok(vec![runtime_core::runtime_engine::RuntimeFilterInput {
        field_code: field_code.to_string(),
        operator: operator.to_string(),
        value: serde_json::json!(value),
    }])
}

fn parse_sorts(
    sort: Option<&str>,
) -> Result<Vec<runtime_core::runtime_engine::RuntimeSortInput>, ApiError> {
    let Some(sort) = sort else {
        return Ok(vec![]);
    };
    let mut parts = sort.splitn(2, ':');
    let field_code = parts
        .next()
        .ok_or(control_plane::errors::ControlPlaneError::InvalidInput(
            "sort",
        ))?;
    let direction = parts
        .next()
        .ok_or(control_plane::errors::ControlPlaneError::InvalidInput(
            "sort",
        ))?;

    Ok(vec![runtime_core::runtime_engine::RuntimeSortInput {
        field_code: field_code.to_string(),
        direction: direction.to_string(),
    }])
}

fn parse_expand(expand: Option<&str>) -> Vec<String> {
    expand
        .map(|expand| {
            expand
                .split(',')
                .filter(|item| !item.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

async fn load_runtime_scope_grant(
    state: &ApiState,
    actor: &domain::ActorContext,
    data_model_id: uuid::Uuid,
) -> Result<Option<runtime_core::runtime_acl::RuntimeScopeGrant>, ApiError> {
    Ok(
        control_plane::model_definition::ModelDefinitionService::new(state.store.clone())
            .load_runtime_scope_grant(actor, data_model_id)
            .await?,
    )
}

fn resolve_runtime_model(
    state: &ApiState,
    actor: &domain::ActorContext,
    model_code: &str,
) -> Option<runtime_core::model_metadata::ModelMetadata> {
    state
        .runtime_engine
        .registry()
        .get(
            domain::DataModelScopeKind::Workspace,
            actor.current_workspace_id,
            model_code,
        )
        .or_else(|| {
            state.runtime_engine.registry().get(
                domain::DataModelScopeKind::System,
                domain::SYSTEM_SCOPE_ID,
                model_code,
            )
        })
}

enum RuntimeCredential {
    Session(RequestContext),
    ApiKey(control_plane::auth::ApiKeyActor),
}

impl RuntimeCredential {
    fn actor(&self) -> &domain::ActorContext {
        match self {
            Self::Session(context) => &context.actor,
            Self::ApiKey(context) => &context.actor,
        }
    }

    fn into_actor(self) -> domain::ActorContext {
        match self {
            Self::Session(context) => context.actor,
            Self::ApiKey(context) => context.actor,
        }
    }
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let value = headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?;
    value.strip_prefix("Bearer ")
}

async fn authenticate_runtime_request(
    state: &ApiState,
    headers: &HeaderMap,
) -> Result<RuntimeCredential, ApiError> {
    if let Some(token) = bearer_token(headers) {
        let api_key = control_plane::auth::ApiKeyService::new(state.store.clone())
            .authenticate_bearer_token(token)
            .await?;
        return Ok(RuntimeCredential::ApiKey(api_key));
    }

    Ok(RuntimeCredential::Session(
        require_session(state, headers).await?,
    ))
}

fn ensure_api_key_action_allowed(
    api_key: &control_plane::auth::ApiKeyActor,
    data_model_id: uuid::Uuid,
    action: domain::ApiKeyDataModelAction,
) -> Result<(), ApiError> {
    if api_key
        .permissions
        .iter()
        .any(|permission| permission.data_model_id == data_model_id && permission.allows(action))
    {
        return Ok(());
    }

    Err(
        control_plane::errors::ControlPlaneError::PermissionDenied("api_key_action_not_allowed")
            .into(),
    )
}

async fn append_api_key_runtime_audit(
    state: &ApiState,
    credential: &RuntimeCredential,
    model_code: &str,
    action: domain::ApiKeyDataModelAction,
    event_code: &str,
    reason: Option<&str>,
) -> Result<(), ApiError> {
    let RuntimeCredential::ApiKey(api_key) = credential else {
        return Ok(());
    };
    let model_id =
        resolve_runtime_model(state, credential.actor(), model_code).map(|model| model.model_id);
    let workspace_id = if api_key.actor.current_workspace_id == domain::SYSTEM_SCOPE_ID {
        None
    } else {
        Some(api_key.actor.current_workspace_id)
    };
    AuthRepository::append_audit_log(
        &state.store,
        &audit_log(
            workspace_id,
            Some(api_key.actor.user_id),
            "state_model",
            model_id,
            event_code,
            serde_json::json!({
                "api_key_id": api_key.api_key.id,
                "model_code": model_code,
                "action": action.as_str(),
                "scope_kind": api_key.api_key.scope_kind.as_str(),
                "scope_id": api_key.api_key.scope_id,
                "reason": reason,
            }),
        ),
    )
    .await?;
    Ok(())
}

async fn runtime_authorization(
    state: &ApiState,
    headers: &HeaderMap,
    model_code: &str,
    action: domain::ApiKeyDataModelAction,
) -> Result<
    (
        RuntimeCredential,
        Option<runtime_core::runtime_acl::RuntimeScopeGrant>,
    ),
    ApiError,
> {
    let credential = authenticate_runtime_request(state, headers).await?;
    let Some(model) = resolve_runtime_model(state, credential.actor(), model_code) else {
        return Ok((credential, None));
    };
    if let RuntimeCredential::ApiKey(api_key) = &credential {
        if let Err(error) = ensure_api_key_action_allowed(api_key, model.model_id, action) {
            append_api_key_runtime_audit(
                state,
                &credential,
                model_code,
                action,
                "state_model.api_key_runtime_access_denied",
                Some("api_key_action_not_allowed"),
            )
            .await?;
            return Err(error);
        }
    }

    let scope_grant = match &credential {
        RuntimeCredential::ApiKey(api_key) => {
            let grant =
                control_plane::model_definition::ModelDefinitionService::new(state.store.clone())
                    .load_runtime_scope_grant_for_scope(
                        api_key.api_key.scope_kind,
                        api_key.api_key.scope_id,
                        model.model_id,
                    )
                    .await?;
            if grant.is_none() {
                append_api_key_runtime_audit(
                    state,
                    &credential,
                    model_code,
                    action,
                    "state_model.api_key_runtime_access_denied",
                    Some("data_model_scope_not_granted"),
                )
                .await?;
                return Err(control_plane::errors::ControlPlaneError::PermissionDenied(
                    "data_model_scope_not_granted",
                )
                .into());
            }
            grant
        }
        RuntimeCredential::Session(_) => {
            load_runtime_scope_grant(state, credential.actor(), model.model_id).await?
        }
    };
    Ok((credential, scope_grant))
}

fn require_session_csrf_for_write(
    headers: &HeaderMap,
    credential: &RuntimeCredential,
) -> Result<(), ApiError> {
    if let RuntimeCredential::Session(context) = credential {
        require_csrf(headers, &context.session)?;
    }
    Ok(())
}

#[utoipa::path(
    get,
    path = "/api/runtime/models/{model_code}/records",
    params(("model_code" = String, Path, description = "Runtime model code")),
    responses((status = 200, body = RuntimeListResponse), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody), (status = 409, body = crate::error_response::ErrorBody))
)]
pub async fn list_records(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(model_code): Path<String>,
    Query(query): Query<RuntimeListQueryParams>,
) -> Result<Json<ApiSuccess<RuntimeListResponse>>, ApiError> {
    let (credential, scope_grant) = runtime_authorization(
        &state,
        &headers,
        &model_code,
        domain::ApiKeyDataModelAction::List,
    )
    .await?;
    let result = state
        .runtime_engine
        .list_records(runtime_core::runtime_engine::RuntimeListInput {
            actor: credential.into_actor(),
            model_code,
            scope_grant,
            filters: parse_filters(query.filter.as_deref())?,
            sorts: parse_sorts(query.sort.as_deref())?,
            expand_relations: parse_expand(query.expand.as_deref()),
            page: query.page.unwrap_or(1),
            page_size: query.page_size.unwrap_or(20),
        })
        .await
        .map_err(map_runtime_error)?;

    Ok(Json(ApiSuccess::new(RuntimeListResponse {
        items: result.items,
        total: result.total,
    })))
}

#[utoipa::path(
    get,
    path = "/api/runtime/models/{model_code}/records/{id}",
    params(
        ("model_code" = String, Path, description = "Runtime model code"),
        ("id" = String, Path, description = "Runtime record id")
    ),
    responses((status = 200, body = RuntimeRecordEnvelope), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody), (status = 409, body = crate::error_response::ErrorBody))
)]
pub async fn get_record(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path((model_code, record_id)): Path<(String, String)>,
) -> Result<Json<ApiSuccess<Value>>, ApiError> {
    let (credential, scope_grant) = runtime_authorization(
        &state,
        &headers,
        &model_code,
        domain::ApiKeyDataModelAction::Get,
    )
    .await?;
    let record = state
        .runtime_engine
        .get_record(runtime_core::runtime_engine::RuntimeGetInput {
            actor: credential.into_actor(),
            model_code,
            record_id,
            scope_grant,
        })
        .await
        .map_err(map_runtime_error)?
        .ok_or(control_plane::errors::ControlPlaneError::NotFound(
            "runtime_record",
        ))?;

    Ok(Json(ApiSuccess::new(record)))
}

#[utoipa::path(
    post,
    path = "/api/runtime/models/{model_code}/records",
    request_body = RuntimeRecordEnvelope,
    params(("model_code" = String, Path, description = "Runtime model code")),
    responses((status = 201, body = RuntimeRecordEnvelope), (status = 400, body = crate::error_response::ErrorBody), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody), (status = 409, body = crate::error_response::ErrorBody))
)]
pub async fn create_record(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(model_code): Path<String>,
    Json(payload): Json<Value>,
) -> Result<(StatusCode, Json<ApiSuccess<Value>>), ApiError> {
    let (credential, scope_grant) = runtime_authorization(
        &state,
        &headers,
        &model_code,
        domain::ApiKeyDataModelAction::Create,
    )
    .await?;
    require_session_csrf_for_write(&headers, &credential)?;

    let result = state
        .runtime_engine
        .create_record(runtime_core::runtime_engine::RuntimeCreateInput {
            actor: credential.actor().clone(),
            model_code: model_code.clone(),
            payload,
            scope_grant,
        })
        .await;
    let record = match result {
        Ok(record) => {
            append_api_key_runtime_audit(
                &state,
                &credential,
                &model_code,
                domain::ApiKeyDataModelAction::Create,
                "state_model.api_key_runtime_write_succeeded",
                None,
            )
            .await?;
            record
        }
        Err(error) => {
            let reason = error.to_string();
            append_api_key_runtime_audit(
                &state,
                &credential,
                &model_code,
                domain::ApiKeyDataModelAction::Create,
                "state_model.api_key_runtime_write_failed",
                Some(&reason),
            )
            .await?;
            return Err(map_runtime_error(error));
        }
    };

    Ok((StatusCode::CREATED, Json(ApiSuccess::new(record))))
}

#[utoipa::path(
    patch,
    path = "/api/runtime/models/{model_code}/records/{id}",
    request_body = RuntimeRecordEnvelope,
    params(
        ("model_code" = String, Path, description = "Runtime model code"),
        ("id" = String, Path, description = "Runtime record id")
    ),
    responses((status = 200, body = RuntimeRecordEnvelope), (status = 400, body = crate::error_response::ErrorBody), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody), (status = 409, body = crate::error_response::ErrorBody))
)]
pub async fn update_record(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path((model_code, record_id)): Path<(String, String)>,
    Json(payload): Json<Value>,
) -> Result<Json<ApiSuccess<Value>>, ApiError> {
    let (credential, scope_grant) = runtime_authorization(
        &state,
        &headers,
        &model_code,
        domain::ApiKeyDataModelAction::Update,
    )
    .await?;
    require_session_csrf_for_write(&headers, &credential)?;

    let result = state
        .runtime_engine
        .update_record(runtime_core::runtime_engine::RuntimeUpdateInput {
            actor: credential.actor().clone(),
            model_code: model_code.clone(),
            record_id,
            payload,
            scope_grant,
        })
        .await;
    let record = match result {
        Ok(record) => {
            append_api_key_runtime_audit(
                &state,
                &credential,
                &model_code,
                domain::ApiKeyDataModelAction::Update,
                "state_model.api_key_runtime_write_succeeded",
                None,
            )
            .await?;
            record
        }
        Err(error) => {
            let reason = error.to_string();
            append_api_key_runtime_audit(
                &state,
                &credential,
                &model_code,
                domain::ApiKeyDataModelAction::Update,
                "state_model.api_key_runtime_write_failed",
                Some(&reason),
            )
            .await?;
            return Err(map_runtime_error(error));
        }
    };

    Ok(Json(ApiSuccess::new(record)))
}

#[utoipa::path(
    delete,
    path = "/api/runtime/models/{model_code}/records/{id}",
    params(
        ("model_code" = String, Path, description = "Runtime model code"),
        ("id" = String, Path, description = "Runtime record id")
    ),
    responses((status = 200, body = RuntimeRecordEnvelope), (status = 401, body = crate::error_response::ErrorBody), (status = 403, body = crate::error_response::ErrorBody), (status = 404, body = crate::error_response::ErrorBody))
)]
pub async fn delete_record(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path((model_code, record_id)): Path<(String, String)>,
) -> Result<Json<ApiSuccess<Value>>, ApiError> {
    let (credential, scope_grant) = runtime_authorization(
        &state,
        &headers,
        &model_code,
        domain::ApiKeyDataModelAction::Delete,
    )
    .await?;
    require_session_csrf_for_write(&headers, &credential)?;

    let delete_result = state
        .runtime_engine
        .delete_record(runtime_core::runtime_engine::RuntimeDeleteInput {
            actor: credential.actor().clone(),
            model_code: model_code.clone(),
            record_id,
            scope_grant,
        })
        .await;
    let result = match delete_result {
        Ok(result) => {
            append_api_key_runtime_audit(
                &state,
                &credential,
                &model_code,
                domain::ApiKeyDataModelAction::Delete,
                "state_model.api_key_runtime_write_succeeded",
                None,
            )
            .await?;
            result
        }
        Err(error) => {
            let reason = error.to_string();
            append_api_key_runtime_audit(
                &state,
                &credential,
                &model_code,
                domain::ApiKeyDataModelAction::Delete,
                "state_model.api_key_runtime_write_failed",
                Some(&reason),
            )
            .await?;
            return Err(map_runtime_error(error));
        }
    };

    Ok(Json(ApiSuccess::new(result)))
}
