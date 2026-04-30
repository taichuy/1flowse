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
    ListRecords,
    GetRecord,
    CreateRecord,
    UpdateRecord,
    DeleteRecord,
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

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
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
    pub capabilities: DataSourceCrudCapabilities,
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
    pub capabilities: DataSourceCrudCapabilities,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DataSourceCrudCapabilities {
    #[serde(default)]
    pub supports_list: bool,
    #[serde(default)]
    pub supports_get: bool,
    #[serde(default)]
    pub supports_create: bool,
    #[serde(default)]
    pub supports_update: bool,
    #[serde(default)]
    pub supports_delete: bool,
    #[serde(default)]
    pub supports_filter: bool,
    #[serde(default)]
    pub supports_sort: bool,
    #[serde(default)]
    pub supports_pagination: bool,
    #[serde(default)]
    pub supports_owner_filter: bool,
    #[serde(default)]
    pub supports_scope_filter: bool,
    #[serde(default)]
    pub supports_write: bool,
    /// Declares that the adapter can apply write requests inside a host-provided
    /// transaction context. This is a capability snapshot only; the platform
    /// must not infer implicit transaction behavior when this is false.
    #[serde(default)]
    pub supports_transactions: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct DataSourceRecordScopeContext {
    #[serde(default)]
    pub owner_id: Option<String>,
    #[serde(default)]
    pub scope_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceRecordFilter {
    pub field_key: String,
    pub operator: String,
    #[serde(default)]
    pub value: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DataSourceRecordSort {
    pub field_key: String,
    #[serde(default)]
    pub descending: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DataSourceRecordPage {
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub offset: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceListRecordsInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
    #[serde(default)]
    pub context: DataSourceRecordScopeContext,
    #[serde(default)]
    pub filters: Vec<DataSourceRecordFilter>,
    #[serde(default)]
    pub sort: Vec<DataSourceRecordSort>,
    #[serde(default)]
    pub page: Option<DataSourceRecordPage>,
    #[serde(default)]
    pub options_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceListRecordsOutput {
    #[serde(default)]
    pub rows: Vec<Value>,
    #[serde(default)]
    pub next_cursor: Option<String>,
    #[serde(default)]
    pub total_count: Option<u64>,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceGetRecordInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
    pub record_id: String,
    #[serde(default)]
    pub context: DataSourceRecordScopeContext,
    #[serde(default)]
    pub options_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceGetRecordOutput {
    #[serde(default)]
    pub record: Option<Value>,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceCreateRecordInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
    #[serde(default)]
    pub record: Value,
    #[serde(default)]
    pub context: DataSourceRecordScopeContext,
    /// Optional host transaction context identifier. Adapters that declare
    /// `supports_transactions` may bind the write to this context; adapters
    /// that do not support transactions should reject or ignore it according to
    /// their contract version.
    #[serde(default)]
    pub transaction_id: Option<String>,
    #[serde(default)]
    pub options_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceCreateRecordOutput {
    #[serde(default)]
    pub record: Value,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceUpdateRecordInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
    pub record_id: String,
    #[serde(default)]
    pub patch: Value,
    #[serde(default)]
    pub context: DataSourceRecordScopeContext,
    /// Optional host transaction context identifier. It identifies an existing
    /// write transaction context and does not request the plugin to open one.
    #[serde(default)]
    pub transaction_id: Option<String>,
    #[serde(default)]
    pub options_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceUpdateRecordOutput {
    #[serde(default)]
    pub record: Value,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceDeleteRecordInput {
    #[serde(flatten)]
    pub connection: DataSourceConfigInput,
    pub resource_key: String,
    pub record_id: String,
    #[serde(default)]
    pub context: DataSourceRecordScopeContext,
    /// Optional host transaction context identifier. It identifies an existing
    /// write transaction context and does not request the plugin to open one.
    #[serde(default)]
    pub transaction_id: Option<String>,
    #[serde(default)]
    pub options_json: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceDeleteRecordOutput {
    pub deleted: bool,
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
