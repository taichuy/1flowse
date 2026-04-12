use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use control_plane::errors::ControlPlaneError;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug)]
pub struct ApiError(pub anyhow::Error);

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
}

impl<E> From<E> for ApiError
where
    E: Into<anyhow::Error>,
{
    fn from(value: E) -> Self {
        Self(value.into())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match self.0.downcast_ref::<ControlPlaneError>() {
            Some(ControlPlaneError::NotAuthenticated) => {
                (StatusCode::UNAUTHORIZED, "not_authenticated")
            }
            Some(ControlPlaneError::PermissionDenied(reason)) => (StatusCode::FORBIDDEN, *reason),
            Some(ControlPlaneError::NotFound(name)) => (StatusCode::NOT_FOUND, *name),
            Some(ControlPlaneError::Conflict(name)) => (StatusCode::CONFLICT, *name),
            Some(ControlPlaneError::InvalidInput(name)) => (StatusCode::BAD_REQUEST, *name),
            None => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        };

        (
            status,
            Json(ErrorBody {
                code: code.to_string(),
                message: self.0.to_string(),
            }),
        )
            .into_response()
    }
}
