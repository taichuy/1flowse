use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::provider_contract::PluginFormFieldSchema;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DataSourceStdioMethod {
    ValidateConfig,
    TestConnection,
    DiscoverCatalog,
    DescribeResource,
    PreviewRead,
    ImportSnapshot,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceStdioRequest {
    pub method: DataSourceStdioMethod,
    #[serde(default)]
    pub input: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceStdioError {
    pub message: String,
    #[serde(default)]
    pub provider_summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceStdioResponse {
    pub ok: bool,
    #[serde(default)]
    pub result: Value,
    #[serde(default)]
    pub error: Option<DataSourceStdioError>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceConfigInput {
    #[serde(default)]
    pub config_json: Value,
    #[serde(default)]
    pub secret_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceCatalogEntry {
    pub resource_key: String,
    pub display_name: String,
    pub resource_kind: String,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceDescribeResourceInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceResourceDescriptor {
    pub resource_key: String,
    #[serde(default)]
    pub primary_key: Option<String>,
    #[serde(default)]
    pub fields: Vec<PluginFormFieldSchema>,
    pub supports_preview_read: bool,
    pub supports_import_snapshot: bool,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourcePreviewReadInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub options_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourcePreviewReadOutput {
    #[serde(default)]
    pub rows: Vec<Value>,
    #[serde(default)]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceImportSnapshotInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub options_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceImportSnapshotOutput {
    #[serde(default)]
    pub rows: Vec<Value>,
    pub schema_version: String,
    #[serde(default)]
    pub metadata: Value,
}
