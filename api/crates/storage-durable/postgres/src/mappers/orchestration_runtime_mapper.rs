use anyhow::{anyhow, Result};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct StoredCompiledPlanRow {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub flow_draft_id: Uuid,
    pub schema_version: String,
    pub document_updated_at: OffsetDateTime,
    pub plan: serde_json::Value,
    pub created_by: Uuid,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct StoredFlowRunRow {
    pub id: Uuid,
    pub application_id: Uuid,
    pub flow_id: Uuid,
    pub flow_draft_id: Uuid,
    pub compiled_plan_id: Uuid,
    pub run_mode: String,
    pub target_node_id: Option<String>,
    pub status: String,
    pub input_payload: serde_json::Value,
    pub output_payload: serde_json::Value,
    pub error_payload: Option<serde_json::Value>,
    pub created_by: Uuid,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct StoredNodeRunRow {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_id: String,
    pub node_type: String,
    pub node_alias: String,
    pub status: String,
    pub input_payload: serde_json::Value,
    pub output_payload: serde_json::Value,
    pub error_payload: Option<serde_json::Value>,
    pub metrics_payload: serde_json::Value,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone)]
pub struct StoredCheckpointRow {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub status: String,
    pub reason: String,
    pub locator_payload: serde_json::Value,
    pub variable_snapshot: serde_json::Value,
    pub external_ref_payload: Option<serde_json::Value>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct StoredCallbackTaskRow {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Uuid,
    pub callback_kind: String,
    pub status: String,
    pub request_payload: serde_json::Value,
    pub response_payload: Option<serde_json::Value>,
    pub external_ref_payload: Option<serde_json::Value>,
    pub created_at: OffsetDateTime,
    pub completed_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone)]
pub struct StoredRunEventRow {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub sequence: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct StoredRuntimeSpanRow {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub kind: String,
    pub name: String,
    pub status: String,
    pub capability_id: Option<String>,
    pub input_ref: Option<String>,
    pub output_ref: Option<String>,
    pub error_payload: Option<serde_json::Value>,
    pub metadata: serde_json::Value,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone)]
pub struct StoredRuntimeEventRow {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub span_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub sequence: i64,
    pub event_type: String,
    pub layer: String,
    pub source: String,
    pub trust_level: String,
    pub item_id: Option<Uuid>,
    pub ledger_ref: Option<String>,
    pub payload: serde_json::Value,
    pub visibility: String,
    pub durability: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct StoredApplicationRunSummaryRow {
    pub id: Uuid,
    pub run_mode: String,
    pub status: String,
    pub target_node_id: Option<String>,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

pub struct PgOrchestrationRuntimeMapper;

impl PgOrchestrationRuntimeMapper {
    pub fn to_compiled_plan_record(row: StoredCompiledPlanRow) -> domain::CompiledPlanRecord {
        domain::CompiledPlanRecord {
            id: row.id,
            flow_id: row.flow_id,
            draft_id: row.flow_draft_id,
            schema_version: row.schema_version,
            document_updated_at: row.document_updated_at,
            plan: row.plan,
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }

    pub fn to_flow_run_record(row: StoredFlowRunRow) -> Result<domain::FlowRunRecord> {
        Ok(domain::FlowRunRecord {
            id: row.id,
            application_id: row.application_id,
            flow_id: row.flow_id,
            draft_id: row.flow_draft_id,
            compiled_plan_id: row.compiled_plan_id,
            run_mode: parse_flow_run_mode(&row.run_mode)?,
            target_node_id: row.target_node_id,
            status: parse_flow_run_status(&row.status)?,
            input_payload: row.input_payload,
            output_payload: row.output_payload,
            error_payload: row.error_payload,
            created_by: row.created_by,
            started_at: row.started_at,
            finished_at: row.finished_at,
            created_at: row.created_at,
        })
    }

    pub fn to_node_run_record(row: StoredNodeRunRow) -> Result<domain::NodeRunRecord> {
        Ok(domain::NodeRunRecord {
            id: row.id,
            flow_run_id: row.flow_run_id,
            node_id: row.node_id,
            node_type: row.node_type,
            node_alias: row.node_alias,
            status: parse_node_run_status(&row.status)?,
            input_payload: row.input_payload,
            output_payload: row.output_payload,
            error_payload: row.error_payload,
            metrics_payload: row.metrics_payload,
            started_at: row.started_at,
            finished_at: row.finished_at,
        })
    }

    pub fn to_checkpoint_record(row: StoredCheckpointRow) -> domain::CheckpointRecord {
        domain::CheckpointRecord {
            id: row.id,
            flow_run_id: row.flow_run_id,
            node_run_id: row.node_run_id,
            status: row.status,
            reason: row.reason,
            locator_payload: row.locator_payload,
            variable_snapshot: row.variable_snapshot,
            external_ref_payload: row.external_ref_payload,
            created_at: row.created_at,
        }
    }

    pub fn to_callback_task_record(
        row: StoredCallbackTaskRow,
    ) -> Result<domain::CallbackTaskRecord> {
        Ok(domain::CallbackTaskRecord {
            id: row.id,
            flow_run_id: row.flow_run_id,
            node_run_id: row.node_run_id,
            callback_kind: row.callback_kind,
            status: parse_callback_task_status(&row.status)?,
            request_payload: row.request_payload,
            response_payload: row.response_payload,
            external_ref_payload: row.external_ref_payload,
            created_at: row.created_at,
            completed_at: row.completed_at,
        })
    }

    pub fn to_run_event_record(row: StoredRunEventRow) -> domain::RunEventRecord {
        domain::RunEventRecord {
            id: row.id,
            flow_run_id: row.flow_run_id,
            node_run_id: row.node_run_id,
            sequence: row.sequence,
            event_type: row.event_type,
            payload: row.payload,
            created_at: row.created_at,
        }
    }

    pub fn to_runtime_span_record(row: StoredRuntimeSpanRow) -> Result<domain::RuntimeSpanRecord> {
        Ok(domain::RuntimeSpanRecord {
            id: row.id,
            flow_run_id: row.flow_run_id,
            node_run_id: row.node_run_id,
            parent_span_id: row.parent_span_id,
            kind: parse_runtime_span_kind(&row.kind)?,
            name: row.name,
            status: parse_runtime_span_status(&row.status)?,
            capability_id: row.capability_id,
            input_ref: row.input_ref,
            output_ref: row.output_ref,
            error_payload: row.error_payload,
            metadata: row.metadata,
            started_at: row.started_at,
            finished_at: row.finished_at,
        })
    }

    pub fn to_runtime_event_record(
        row: StoredRuntimeEventRow,
    ) -> Result<domain::RuntimeEventRecord> {
        Ok(domain::RuntimeEventRecord {
            id: row.id,
            flow_run_id: row.flow_run_id,
            node_run_id: row.node_run_id,
            span_id: row.span_id,
            parent_span_id: row.parent_span_id,
            sequence: row.sequence,
            event_type: row.event_type,
            layer: parse_runtime_event_layer(&row.layer)?,
            source: parse_runtime_event_source(&row.source)?,
            trust_level: parse_runtime_trust_level(&row.trust_level)?,
            item_id: row.item_id,
            ledger_ref: row.ledger_ref,
            payload: row.payload,
            visibility: parse_runtime_event_visibility(&row.visibility)?,
            durability: parse_runtime_event_durability(&row.durability)?,
            created_at: row.created_at,
        })
    }

    pub fn to_application_run_summary(
        row: StoredApplicationRunSummaryRow,
    ) -> Result<domain::ApplicationRunSummary> {
        Ok(domain::ApplicationRunSummary {
            id: row.id,
            run_mode: parse_flow_run_mode(&row.run_mode)?,
            status: parse_flow_run_status(&row.status)?,
            target_node_id: row.target_node_id,
            started_at: row.started_at,
            finished_at: row.finished_at,
        })
    }
}

pub fn parse_flow_run_mode(value: &str) -> Result<domain::FlowRunMode> {
    match value {
        "debug_node_preview" => Ok(domain::FlowRunMode::DebugNodePreview),
        "debug_flow_run" => Ok(domain::FlowRunMode::DebugFlowRun),
        _ => Err(anyhow!("unknown flow run mode: {value}")),
    }
}

pub fn parse_callback_task_status(value: &str) -> Result<domain::CallbackTaskStatus> {
    match value {
        "pending" => Ok(domain::CallbackTaskStatus::Pending),
        "completed" => Ok(domain::CallbackTaskStatus::Completed),
        "cancelled" => Ok(domain::CallbackTaskStatus::Cancelled),
        _ => Err(anyhow!("unknown callback task status: {value}")),
    }
}

pub fn parse_flow_run_status(value: &str) -> Result<domain::FlowRunStatus> {
    match value {
        "queued" => Ok(domain::FlowRunStatus::Queued),
        "running" => Ok(domain::FlowRunStatus::Running),
        "waiting_callback" => Ok(domain::FlowRunStatus::WaitingCallback),
        "waiting_human" => Ok(domain::FlowRunStatus::WaitingHuman),
        "paused" => Ok(domain::FlowRunStatus::Paused),
        "succeeded" => Ok(domain::FlowRunStatus::Succeeded),
        "failed" => Ok(domain::FlowRunStatus::Failed),
        "cancelled" => Ok(domain::FlowRunStatus::Cancelled),
        _ => Err(anyhow!("unknown flow run status: {value}")),
    }
}

pub fn parse_node_run_status(value: &str) -> Result<domain::NodeRunStatus> {
    match value {
        "pending" => Ok(domain::NodeRunStatus::Pending),
        "ready" => Ok(domain::NodeRunStatus::Ready),
        "running" => Ok(domain::NodeRunStatus::Running),
        "streaming" => Ok(domain::NodeRunStatus::Streaming),
        "waiting_tool" => Ok(domain::NodeRunStatus::WaitingTool),
        "waiting_callback" => Ok(domain::NodeRunStatus::WaitingCallback),
        "waiting_human" => Ok(domain::NodeRunStatus::WaitingHuman),
        "retrying" => Ok(domain::NodeRunStatus::Retrying),
        "succeeded" => Ok(domain::NodeRunStatus::Succeeded),
        "failed" => Ok(domain::NodeRunStatus::Failed),
        "skipped" => Ok(domain::NodeRunStatus::Skipped),
        _ => Err(anyhow!("unknown node run status: {value}")),
    }
}

pub fn parse_runtime_span_kind(value: &str) -> Result<domain::RuntimeSpanKind> {
    match value {
        "flow" => Ok(domain::RuntimeSpanKind::Flow),
        "node" => Ok(domain::RuntimeSpanKind::Node),
        "llm_turn" => Ok(domain::RuntimeSpanKind::LlmTurn),
        "provider_request" => Ok(domain::RuntimeSpanKind::ProviderRequest),
        "gateway_forward" => Ok(domain::RuntimeSpanKind::GatewayForward),
        "tool_call" => Ok(domain::RuntimeSpanKind::ToolCall),
        "mcp_call" => Ok(domain::RuntimeSpanKind::McpCall),
        "skill_load" => Ok(domain::RuntimeSpanKind::SkillLoad),
        "skill_action" => Ok(domain::RuntimeSpanKind::SkillAction),
        "workflow_tool" => Ok(domain::RuntimeSpanKind::WorkflowTool),
        "data_retrieval" => Ok(domain::RuntimeSpanKind::DataRetrieval),
        "approval" => Ok(domain::RuntimeSpanKind::Approval),
        "compaction" => Ok(domain::RuntimeSpanKind::Compaction),
        "subagent" => Ok(domain::RuntimeSpanKind::Subagent),
        "system_agent" => Ok(domain::RuntimeSpanKind::SystemAgent),
        _ => Err(anyhow!("unknown runtime span kind: {value}")),
    }
}

pub fn parse_runtime_span_status(value: &str) -> Result<domain::RuntimeSpanStatus> {
    match value {
        "running" => Ok(domain::RuntimeSpanStatus::Running),
        "succeeded" => Ok(domain::RuntimeSpanStatus::Succeeded),
        "failed" => Ok(domain::RuntimeSpanStatus::Failed),
        "cancelled" => Ok(domain::RuntimeSpanStatus::Cancelled),
        "waiting" => Ok(domain::RuntimeSpanStatus::Waiting),
        _ => Err(anyhow!("unknown runtime span status: {value}")),
    }
}

pub fn parse_runtime_event_layer(value: &str) -> Result<domain::RuntimeEventLayer> {
    match value {
        "provider_raw" => Ok(domain::RuntimeEventLayer::ProviderRaw),
        "runtime_item" => Ok(domain::RuntimeEventLayer::RuntimeItem),
        "capability" => Ok(domain::RuntimeEventLayer::Capability),
        "agent_transition" => Ok(domain::RuntimeEventLayer::AgentTransition),
        "ledger" => Ok(domain::RuntimeEventLayer::Ledger),
        "diagnostic" => Ok(domain::RuntimeEventLayer::Diagnostic),
        _ => Err(anyhow!("unknown runtime event layer: {value}")),
    }
}

pub fn parse_runtime_event_source(value: &str) -> Result<domain::RuntimeEventSource> {
    match value {
        "host" => Ok(domain::RuntimeEventSource::Host),
        "provider_plugin" => Ok(domain::RuntimeEventSource::ProviderPlugin),
        "gateway_relay" => Ok(domain::RuntimeEventSource::GatewayRelay),
        "internal_agent" => Ok(domain::RuntimeEventSource::InternalAgent),
        "external_agent" => Ok(domain::RuntimeEventSource::ExternalAgent),
        _ => Err(anyhow!("unknown runtime event source: {value}")),
    }
}

pub fn parse_runtime_trust_level(value: &str) -> Result<domain::RuntimeTrustLevel> {
    match value {
        "host_fact" => Ok(domain::RuntimeTrustLevel::HostFact),
        "verified_bridge" => Ok(domain::RuntimeTrustLevel::VerifiedBridge),
        "agent_reported" => Ok(domain::RuntimeTrustLevel::AgentReported),
        "external_opaque" => Ok(domain::RuntimeTrustLevel::ExternalOpaque),
        "inferred" => Ok(domain::RuntimeTrustLevel::Inferred),
        _ => Err(anyhow!("unknown runtime trust level: {value}")),
    }
}

pub fn parse_runtime_event_visibility(value: &str) -> Result<domain::RuntimeEventVisibility> {
    match value {
        "internal" => Ok(domain::RuntimeEventVisibility::Internal),
        "workspace" => Ok(domain::RuntimeEventVisibility::Workspace),
        "user" => Ok(domain::RuntimeEventVisibility::User),
        "public" => Ok(domain::RuntimeEventVisibility::Public),
        _ => Err(anyhow!("unknown runtime event visibility: {value}")),
    }
}

pub fn parse_runtime_event_durability(value: &str) -> Result<domain::RuntimeEventDurability> {
    match value {
        "ephemeral" => Ok(domain::RuntimeEventDurability::Ephemeral),
        "durable" => Ok(domain::RuntimeEventDurability::Durable),
        "sampled" => Ok(domain::RuntimeEventDurability::Sampled),
        _ => Err(anyhow!("unknown runtime event durability: {value}")),
    }
}
