use async_trait::async_trait;
use aws_config::{meta::region::RegionProviderChain, BehaviorVersion};
use aws_sdk_s3::{
    config::{Builder as S3ConfigBuilder, Credentials, Region},
    Client,
};

use crate::{
    driver::FileStorageDriver,
    errors::{FileStorageError, FileStorageResult},
    types::{
        DeleteObjectInput, FileStorageHealthcheck, FileStoragePutInput, FileStoragePutResult,
        GenerateAccessUrlInput, OpenReadInput, OpenReadResult,
    },
};

#[derive(Debug, Default)]
pub struct RustfsFileStorageDriver;

#[derive(Debug, Clone)]
struct RustfsConfig {
    endpoint: String,
    bucket: String,
    access_key: String,
    secret_key: String,
    region: String,
    force_path_style: bool,
    public_base_url: Option<String>,
}

fn required_string(
    config_json: &serde_json::Value,
    field: &'static str,
) -> FileStorageResult<String> {
    config_json
        .get(field)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or(FileStorageError::InvalidConfig(field))
}

fn optional_string(config_json: &serde_json::Value, field: &'static str) -> Option<String> {
    config_json
        .get(field)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn optional_bool(config_json: &serde_json::Value, field: &'static str) -> Option<bool> {
    config_json.get(field).and_then(|value| value.as_bool())
}

fn parse_config(config_json: &serde_json::Value) -> FileStorageResult<RustfsConfig> {
    Ok(RustfsConfig {
        endpoint: required_string(config_json, "endpoint")?,
        bucket: required_string(config_json, "bucket")?,
        access_key: required_string(config_json, "access_key")?,
        secret_key: required_string(config_json, "secret_key")?,
        region: optional_string(config_json, "region")
            .unwrap_or_else(|| "us-east-1".to_string()),
        force_path_style: optional_bool(config_json, "force_path_style")
            .or_else(|| optional_bool(config_json, "path_style"))
            .unwrap_or(true),
        public_base_url: optional_string(config_json, "public_base_url"),
    })
}

fn other_error(error: impl Into<anyhow::Error>) -> FileStorageError {
    FileStorageError::Other(error.into())
}

async fn build_client(config: &RustfsConfig) -> FileStorageResult<Client> {
    let region = Region::new(config.region.clone());
    let shared = aws_config::defaults(BehaviorVersion::latest())
        .region(RegionProviderChain::first_try(region.clone()))
        .credentials_provider(Credentials::new(
            config.access_key.clone(),
            config.secret_key.clone(),
            None,
            None,
            "rustfs-driver",
        ))
        .load()
        .await;

    let s3_config = S3ConfigBuilder::from(&shared)
        .region(region)
        .endpoint_url(config.endpoint.clone())
        .force_path_style(config.force_path_style)
        .build();

    Ok(Client::from_conf(s3_config))
}

#[async_trait]
impl FileStorageDriver for RustfsFileStorageDriver {
    fn driver_type(&self) -> &'static str {
        "rustfs"
    }

    fn validate_config(&self, config_json: &serde_json::Value) -> FileStorageResult<()> {
        let _ = parse_config(config_json)?;
        Ok(())
    }

    async fn healthcheck(
        &self,
        config_json: &serde_json::Value,
    ) -> FileStorageResult<FileStorageHealthcheck> {
        let config = parse_config(config_json)?;
        let client = build_client(&config).await?;
        client
            .head_bucket()
            .bucket(&config.bucket)
            .send()
            .await
            .map_err(other_error)?;
        Ok(FileStorageHealthcheck {
            reachable: true,
            detail: Some(config.bucket),
        })
    }

    async fn put_object(
        &self,
        input: FileStoragePutInput<'_>,
    ) -> FileStorageResult<FileStoragePutResult> {
        let config = parse_config(input.config_json)?;
        let client = build_client(&config).await?;
        client
            .put_object()
            .bucket(&config.bucket)
            .key(input.object_path)
            .body(input.bytes.to_vec().into())
            .set_content_type(input.content_type.map(str::to_string))
            .send()
            .await
            .map_err(other_error)?;

        let url = config
            .public_base_url
            .as_ref()
            .map(|base| format!("{}/{}", base.trim_end_matches('/'), input.object_path));

        Ok(FileStoragePutResult {
            path: input.object_path.to_string(),
            url,
            metadata_json: serde_json::json!({
                "driver_type": "rustfs",
                "bucket": config.bucket,
            }),
        })
    }

    async fn delete_object(&self, input: DeleteObjectInput<'_>) -> FileStorageResult<()> {
        let config = parse_config(input.config_json)?;
        let client = build_client(&config).await?;
        client
            .delete_object()
            .bucket(&config.bucket)
            .key(input.object_path)
            .send()
            .await
            .map_err(other_error)?;
        Ok(())
    }

    async fn open_read(&self, input: OpenReadInput<'_>) -> FileStorageResult<OpenReadResult> {
        let config = parse_config(input.config_json)?;
        let client = build_client(&config).await?;
        let output = client
            .get_object()
            .bucket(&config.bucket)
            .key(input.object_path)
            .send()
            .await
            .map_err(other_error)?;
        let bytes = output
            .body
            .collect()
            .await
            .map_err(other_error)?
            .into_bytes()
            .to_vec();

        Ok(OpenReadResult {
            bytes,
            content_type: output.content_type,
        })
    }

    async fn generate_access_url(
        &self,
        input: GenerateAccessUrlInput<'_>,
    ) -> FileStorageResult<Option<String>> {
        let config = parse_config(input.config_json)?;
        Ok(config
            .public_base_url
            .map(|base| format!("{}/{}", base.trim_end_matches('/'), input.object_path)))
    }
}
