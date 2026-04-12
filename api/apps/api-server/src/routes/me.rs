use std::sync::Arc;

use axum::{extract::State, http::HeaderMap, Json};
use control_plane::profile::ProfileService;
use serde::Serialize;
use utoipa::ToSchema;

use crate::{
    app_state::ApiState, error_response::ApiError, middleware::require_session::require_session,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct MeResponse {
    pub id: String,
    pub account: String,
    pub email: String,
    pub nickname: String,
    pub name: String,
    pub effective_display_role: String,
    pub permissions: Vec<String>,
}

#[utoipa::path(
    get,
    path = "/api/console/me",
    responses((status = 200, body = MeResponse), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn get_me(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<MeResponse>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let profile = ProfileService::new(state.store.clone())
        .get_me(context.user.id, context.session.team_id)
        .await?;
    let mut permissions = profile.actor.permissions.into_iter().collect::<Vec<_>>();
    permissions.sort();

    Ok(Json(MeResponse {
        id: profile.user.id.to_string(),
        account: profile.user.account,
        email: profile.user.email,
        nickname: profile.user.nickname,
        name: profile.user.name,
        effective_display_role: profile.actor.effective_display_role,
        permissions,
    }))
}
