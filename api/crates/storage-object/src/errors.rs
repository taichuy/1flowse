use thiserror::Error;

pub type FileStorageResult<T> = Result<T, FileStorageError>;

#[derive(Debug, Error)]
pub enum FileStorageError {
    #[error("unsupported file storage driver: {0}")]
    UnsupportedDriver(String),
    #[error("invalid file storage config: {0}")]
    InvalidConfig(&'static str),
    #[error("object not found")]
    ObjectNotFound,
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

impl FileStorageError {
    pub fn unsupported_driver(driver_type: impl Into<String>) -> Self {
        Self::UnsupportedDriver(driver_type.into())
    }
}
