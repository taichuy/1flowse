#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct DebugStreamPart {
    pub id: uuid::Uuid,
    pub flow_run_id: uuid::Uuid,
    pub item_id: Option<uuid::Uuid>,
    pub span_id: Option<uuid::Uuid>,
    pub part_type: String,
    pub status: String,
    pub trust_level: domain::RuntimeTrustLevel,
    pub payload: serde_json::Value,
}
