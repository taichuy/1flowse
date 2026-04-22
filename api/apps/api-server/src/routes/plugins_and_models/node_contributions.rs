use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::get,
    Json, Router,
};
use control_plane::{
    application::ApplicationService,
    node_contribution::{ListNodeContributionsQuery, NodeContributionService},
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::{
    app_state::ApiState, error_response::ApiError, middleware::require_session::require_session,
    response::ApiSuccess,
};

#[derive(Debug, Deserialize, IntoParams, Clone, ToSchema)]
pub struct NodeContributionQuery {
    pub application_id: Uuid,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct NodeContributionResponse {
    pub installation_id: String,
    pub provider_code: String,
    pub plugin_id: String,
    pub plugin_version: String,
    pub contribution_code: String,
    pub node_shell: String,
    pub category: String,
    pub title: String,
    pub description: String,
    pub dependency_status: String,
    pub schema_version: String,
    pub experimental: bool,
    pub icon: String,
    #[schema(value_type = Object)]
    pub schema_ui: serde_json::Value,
    #[schema(value_type = Object)]
    pub output_schema: serde_json::Value,
    pub required_auth: Vec<String>,
    pub visibility: String,
    pub dependency_installation_kind: String,
    pub dependency_plugin_version_range: String,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new().route("/node-contributions", get(list_node_contributions))
}

fn to_response(entry: domain::NodeContributionRegistryEntry) -> NodeContributionResponse {
    NodeContributionResponse {
        installation_id: entry.installation_id.to_string(),
        provider_code: entry.provider_code,
        plugin_id: entry.plugin_id,
        plugin_version: entry.plugin_version,
        contribution_code: entry.contribution_code,
        node_shell: entry.node_shell,
        category: entry.category,
        title: entry.title,
        description: entry.description,
        dependency_status: entry.dependency_status.as_str().to_string(),
        schema_version: entry.schema_version,
        experimental: entry.experimental,
        icon: entry.icon,
        schema_ui: entry.schema_ui,
        output_schema: entry.output_schema,
        required_auth: entry.required_auth,
        visibility: entry.visibility,
        dependency_installation_kind: entry.dependency_installation_kind,
        dependency_plugin_version_range: entry.dependency_plugin_version_range,
    }
}

#[utoipa::path(
    get,
    path = "/api/console/node-contributions",
    params(NodeContributionQuery),
    responses(
        (status = 200, body = [NodeContributionResponse]),
        (status = 401, body = crate::error_response::ErrorBody),
        (status = 403, body = crate::error_response::ErrorBody),
        (status = 404, body = crate::error_response::ErrorBody)
    )
)]
pub async fn list_node_contributions(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Query(query): Query<NodeContributionQuery>,
) -> Result<Json<ApiSuccess<Vec<NodeContributionResponse>>>, ApiError> {
    let context = require_session(&state, &headers).await?;

    ApplicationService::new(state.store.clone())
        .get_application(context.user.id, query.application_id)
        .await?;

    let entries = NodeContributionService::new(state.store.clone())
        .list_node_contributions(ListNodeContributionsQuery {
            actor_user_id: context.user.id,
        })
        .await?;

    Ok(Json(ApiSuccess::new(
        entries.entries.into_iter().map(to_response).collect(),
    )))
}
