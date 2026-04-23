use std::path::PathBuf;

use anyhow::anyhow;
use async_trait::async_trait;

use crate::{
    driver::FileStorageDriver,
    errors::{FileStorageError, FileStorageResult},
    types::{
        DeleteObjectInput, FileStorageHealthcheck, FileStoragePutInput, FileStoragePutResult,
        GenerateAccessUrlInput, OpenReadInput, OpenReadResult,
    },
};

#[derive(Debug, Default)]
pub struct LocalFileStorageDriver;

fn root_path(config_json: &serde_json::Value) -> FileStorageResult<PathBuf> {
    config_json
        .get("root_path")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .ok_or(FileStorageError::InvalidConfig("root_path"))
}

#[async_trait]
impl FileStorageDriver for LocalFileStorageDriver {
    fn driver_type(&self) -> &'static str {
        "local"
    }

    fn validate_config(&self, config_json: &serde_json::Value) -> FileStorageResult<()> {
        let _ = root_path(config_json)?;
        Ok(())
    }

    async fn healthcheck(
        &self,
        config_json: &serde_json::Value,
    ) -> FileStorageResult<FileStorageHealthcheck> {
        let root = root_path(config_json)?;
        Ok(FileStorageHealthcheck {
            reachable: false,
            detail: Some(format!(
                "local driver behavior not implemented in task 1 for {}",
                root.display()
            )),
        })
    }

    async fn put_object(
        &self,
        _input: FileStoragePutInput<'_>,
    ) -> FileStorageResult<FileStoragePutResult> {
        Err(FileStorageError::Other(anyhow!(
            "local driver behavior not implemented in task 1"
        )))
    }

    async fn delete_object(&self, _input: DeleteObjectInput<'_>) -> FileStorageResult<()> {
        Err(FileStorageError::Other(anyhow!(
            "local driver behavior not implemented in task 1"
        )))
    }

    async fn open_read(&self, _input: OpenReadInput<'_>) -> FileStorageResult<OpenReadResult> {
        Err(FileStorageError::Other(anyhow!(
            "local driver behavior not implemented in task 1"
        )))
    }

    async fn generate_access_url(
        &self,
        _input: GenerateAccessUrlInput<'_>,
    ) -> FileStorageResult<Option<String>> {
        Ok(None)
    }
}
