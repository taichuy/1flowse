use anyhow::Result;
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::ports::{
    AppendRuntimeEventInput, AppendRuntimeSpanInput, OrchestrationRuntimeRepository,
};

pub async fn append_host_span<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    parent_span_id: Option<Uuid>,
    kind: domain::RuntimeSpanKind,
    name: impl Into<String>,
    started_at: OffsetDateTime,
    metadata: Value,
) -> Result<domain::RuntimeSpanRecord>
where
    R: OrchestrationRuntimeRepository,
{
    repository
        .append_runtime_span(&AppendRuntimeSpanInput {
            flow_run_id,
            node_run_id,
            parent_span_id,
            kind,
            name: name.into(),
            status: domain::RuntimeSpanStatus::Running,
            capability_id: None,
            input_ref: None,
            output_ref: None,
            error_payload: None,
            metadata,
            started_at,
            finished_at: None,
        })
        .await
}

pub async fn append_host_event<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    span_id: Option<Uuid>,
    event_type: impl Into<String>,
    layer: domain::RuntimeEventLayer,
    payload: Value,
) -> Result<domain::RuntimeEventRecord>
where
    R: OrchestrationRuntimeRepository,
{
    repository
        .append_runtime_event(&AppendRuntimeEventInput {
            flow_run_id,
            node_run_id,
            span_id,
            parent_span_id: None,
            event_type: event_type.into(),
            layer,
            source: domain::RuntimeEventSource::Host,
            trust_level: domain::RuntimeTrustLevel::HostFact,
            item_id: None,
            ledger_ref: None,
            payload,
            visibility: domain::RuntimeEventVisibility::Workspace,
            durability: domain::RuntimeEventDurability::Durable,
        })
        .await
}
