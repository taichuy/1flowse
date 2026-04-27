use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

macro_rules! string_enum {
    ($name:ident { $($variant:ident => $value:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        #[serde(rename_all = "snake_case")]
        pub enum $name {
            $($variant),+
        }

        impl $name {
            pub fn as_str(self) -> &'static str {
                match self {
                    $(Self::$variant => $value),+
                }
            }
        }
    };
}

string_enum!(RuntimeSpanKind {
    Flow => "flow",
    Node => "node",
    LlmTurn => "llm_turn",
    ProviderRequest => "provider_request",
    GatewayForward => "gateway_forward",
    ToolCall => "tool_call",
    McpCall => "mcp_call",
    SkillLoad => "skill_load",
    SkillAction => "skill_action",
    WorkflowTool => "workflow_tool",
    DataRetrieval => "data_retrieval",
    Approval => "approval",
    Compaction => "compaction",
    Subagent => "subagent",
    SystemAgent => "system_agent",
});

string_enum!(RuntimeSpanStatus {
    Running => "running",
    Succeeded => "succeeded",
    Failed => "failed",
    Cancelled => "cancelled",
    Waiting => "waiting",
});

string_enum!(RuntimeEventLayer {
    ProviderRaw => "provider_raw",
    RuntimeItem => "runtime_item",
    Capability => "capability",
    AgentTransition => "agent_transition",
    Ledger => "ledger",
    Diagnostic => "diagnostic",
});

string_enum!(RuntimeEventSource {
    Host => "host",
    ProviderPlugin => "provider_plugin",
    GatewayRelay => "gateway_relay",
    InternalAgent => "internal_agent",
    ExternalAgent => "external_agent",
});

string_enum!(RuntimeTrustLevel {
    HostFact => "host_fact",
    VerifiedBridge => "verified_bridge",
    AgentReported => "agent_reported",
    ExternalOpaque => "external_opaque",
    Inferred => "inferred",
});

string_enum!(RuntimeEventVisibility {
    Internal => "internal",
    Workspace => "workspace",
    User => "user",
    Public => "public",
});

string_enum!(RuntimeEventDurability {
    Ephemeral => "ephemeral",
    Durable => "durable",
    Sampled => "sampled",
});

string_enum!(RuntimeItemKind {
    Message => "message",
    Reasoning => "reasoning",
    ToolCall => "tool_call",
    ToolResult => "tool_result",
    McpCall => "mcp_call",
    SkillLoad => "skill_load",
    SkillAction => "skill_action",
    Approval => "approval",
    Handoff => "handoff",
    AgentAsTool => "agent_as_tool",
    Compaction => "compaction",
    GatewayForward => "gateway_forward",
});

string_enum!(RuntimeItemStatus {
    Created => "created",
    Running => "running",
    Waiting => "waiting",
    Succeeded => "succeeded",
    Failed => "failed",
    Cancelled => "cancelled",
});

string_enum!(UsageLedgerStatus {
    Recorded => "recorded",
    UnavailableError => "unavailable_error",
});

string_enum!(BillingSessionStatus {
    Reserved => "reserved",
    Settled => "settled",
    Refunded => "refunded",
    Failed => "failed",
});

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeSpanRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub kind: RuntimeSpanKind,
    pub name: String,
    pub status: RuntimeSpanStatus,
    pub capability_id: Option<String>,
    pub input_ref: Option<String>,
    pub output_ref: Option<String>,
    pub error_payload: Option<serde_json::Value>,
    pub metadata: serde_json::Value,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeEventRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub span_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub sequence: i64,
    pub event_type: String,
    pub layer: RuntimeEventLayer,
    pub source: RuntimeEventSource,
    pub trust_level: RuntimeTrustLevel,
    pub item_id: Option<Uuid>,
    pub ledger_ref: Option<String>,
    pub payload: serde_json::Value,
    pub visibility: RuntimeEventVisibility,
    pub durability: RuntimeEventDurability,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeItemRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub span_id: Option<Uuid>,
    pub kind: RuntimeItemKind,
    pub status: RuntimeItemStatus,
    pub source_event_id: Option<Uuid>,
    pub input_ref: Option<String>,
    pub output_ref: Option<String>,
    pub usage_ledger_id: Option<Uuid>,
    pub trust_level: RuntimeTrustLevel,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}
