use axum::http::HeaderMap;
use domain::SessionRecord;

use crate::error_response::ApiError;

pub fn require_csrf(headers: &HeaderMap, session: &SessionRecord) -> Result<(), ApiError> {
    let csrf = headers
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok())
        .ok_or(control_plane::errors::ControlPlaneError::NotAuthenticated)?;

    if csrf == session.csrf_token {
        Ok(())
    } else {
        Err(control_plane::errors::ControlPlaneError::PermissionDenied("csrf_mismatch").into())
    }
}
