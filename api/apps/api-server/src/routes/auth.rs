use std::sync::Arc;

use axum::{extract::State, Json};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use control_plane::auth::{AuthKernel, LoginCommand, SessionIssuer};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{app_state::ApiState, error_response::ApiError};

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginBody {
    pub authenticator: Option<String>,
    pub identifier: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LoginResponse {
    pub csrf_token: String,
    pub effective_display_role: String,
}

#[utoipa::path(
    post,
    path = "/api/console/auth/login",
    request_body = LoginBody,
    responses((status = 200, body = LoginResponse), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn login(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<LoginBody>,
) -> Result<(CookieJar, Json<LoginResponse>), ApiError> {
    let team = state.store.upsert_team(&state.bootstrap_team_name).await?;
    let kernel = AuthKernel::new(
        state.store.clone(),
        SessionIssuer::new(state.session_store.clone(), state.session_ttl_days),
    );
    let result = kernel
        .login(LoginCommand {
            authenticator: body
                .authenticator
                .unwrap_or_else(|| "password-local".to_string()),
            identifier: body.identifier,
            password: body.password,
            team_id: team.id,
        })
        .await?;

    let cookie = Cookie::build((state.cookie_name.clone(), result.session.session_id.clone()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .build();
    let jar = CookieJar::new().add(cookie);

    Ok((
        jar,
        Json(LoginResponse {
            csrf_token: result.session.csrf_token,
            effective_display_role: result.actor.effective_display_role,
        }),
    ))
}
