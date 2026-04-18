use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompiledPlan {
    pub flow_id: Uuid,
    pub source_draft_id: String,
    pub schema_version: String,
    pub topological_order: Vec<String>,
    pub nodes: BTreeMap<String, CompiledNode>,
    #[serde(default)]
    pub compile_issues: Vec<CompileIssue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompiledNode {
    pub node_id: String,
    pub node_type: String,
    pub alias: String,
    pub container_id: Option<String>,
    pub dependency_node_ids: Vec<String>,
    pub downstream_node_ids: Vec<String>,
    pub bindings: BTreeMap<String, CompiledBinding>,
    pub outputs: Vec<CompiledOutput>,
    pub config: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub llm_runtime: Option<CompiledLlmRuntime>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompiledBinding {
    pub kind: String,
    pub raw_value: serde_json::Value,
    pub selector_paths: Vec<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompiledOutput {
    pub key: String,
    pub title: String,
    pub value_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompiledLlmRuntime {
    pub provider_instance_id: String,
    pub provider_code: String,
    pub protocol: String,
    pub model: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompileIssueCode {
    MissingProviderInstance,
    ProviderInstanceNotFound,
    ProviderInstanceNotReady,
    MissingModel,
    ModelNotAvailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompileIssue {
    pub node_id: String,
    pub code: CompileIssueCode,
    pub message: String,
}
