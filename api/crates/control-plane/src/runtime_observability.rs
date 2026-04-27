use anyhow::Result;
use observability::{DeltaCoalescer, RuntimeBusEvent, RuntimeEventBus};
use plugin_framework::provider_contract::ProviderStreamEvent;
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::ports::{
    AppendRuntimeEventInput, AppendRuntimeItemInput, AppendRuntimeSpanInput,
    OrchestrationRuntimeRepository,
};

pub mod items;
pub mod projection;

pub use items::item_kind_for_event;

pub const PROVIDER_DELTA_COALESCE_MAX_BYTES: usize = 4096;

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
    let event_type = event_type.into();
    let event = repository
        .append_runtime_event(&AppendRuntimeEventInput {
            flow_run_id,
            node_run_id,
            span_id,
            parent_span_id: None,
            event_type: event_type.clone(),
            layer,
            source: domain::RuntimeEventSource::Host,
            trust_level: domain::RuntimeTrustLevel::HostFact,
            item_id: None,
            ledger_ref: None,
            payload,
            visibility: domain::RuntimeEventVisibility::Workspace,
            durability: domain::RuntimeEventDurability::Durable,
        })
        .await?;

    if let Some(kind) = item_kind_for_event(&event_type) {
        repository
            .append_runtime_item(&AppendRuntimeItemInput {
                flow_run_id,
                span_id,
                kind,
                status: domain::RuntimeItemStatus::Created,
                source_event_id: Some(event.id),
                input_ref: None,
                output_ref: None,
                usage_ledger_id: None,
                trust_level: domain::RuntimeTrustLevel::HostFact,
            })
            .await?;
    }

    Ok(event)
}

pub fn coalesce_provider_stream_events(
    bus: &RuntimeEventBus,
    events: &[ProviderStreamEvent],
    max_bytes: usize,
) -> Result<Vec<ProviderStreamEvent>> {
    let mut coalescer = DeltaCoalescer::new(max_bytes);
    let mut coalesced = Vec::with_capacity(events.len());

    for event in events {
        match event {
            ProviderStreamEvent::TextDelta { delta } => {
                flush_reasoning_delta(bus, &mut coalesced, &mut coalescer);
                push_runtime_bus_delta(bus, &mut coalesced, coalescer.push_text(delta));
            }
            ProviderStreamEvent::ReasoningDelta { delta } => {
                flush_text_delta(bus, &mut coalesced, &mut coalescer);
                push_runtime_bus_delta(bus, &mut coalesced, coalescer.push_reasoning(delta));
            }
            other => {
                flush_text_delta(bus, &mut coalesced, &mut coalescer);
                flush_reasoning_delta(bus, &mut coalesced, &mut coalescer);
                bus.publish(RuntimeBusEvent::RuntimeEvent {
                    event_type: provider_stream_event_type(other).to_string(),
                    payload: serde_json::to_value(other)?,
                });
                coalesced.push(other.clone());
            }
        }
    }

    flush_text_delta(bus, &mut coalesced, &mut coalescer);
    flush_reasoning_delta(bus, &mut coalesced, &mut coalescer);

    Ok(coalesced)
}

pub fn provider_stream_event_type(event: &ProviderStreamEvent) -> &'static str {
    match event {
        ProviderStreamEvent::TextDelta { .. } => "text_delta",
        ProviderStreamEvent::ReasoningDelta { .. } => "reasoning_delta",
        ProviderStreamEvent::ToolCallDelta { .. } => "tool_call_delta",
        ProviderStreamEvent::ToolCallCommit { .. } => "tool_call_commit",
        ProviderStreamEvent::McpCallDelta { .. } => "mcp_call_delta",
        ProviderStreamEvent::McpCallCommit { .. } => "mcp_call_commit",
        ProviderStreamEvent::UsageDelta { .. } => "usage_delta",
        ProviderStreamEvent::UsageSnapshot { .. } => "usage_snapshot",
        ProviderStreamEvent::Finish { .. } => "finish",
        ProviderStreamEvent::Error { .. } => "error",
    }
}

fn flush_text_delta(
    bus: &RuntimeEventBus,
    coalesced: &mut Vec<ProviderStreamEvent>,
    coalescer: &mut DeltaCoalescer,
) {
    push_runtime_bus_delta(bus, coalesced, coalescer.flush_text());
}

fn flush_reasoning_delta(
    bus: &RuntimeEventBus,
    coalesced: &mut Vec<ProviderStreamEvent>,
    coalescer: &mut DeltaCoalescer,
) {
    push_runtime_bus_delta(bus, coalesced, coalescer.flush_reasoning());
}

fn push_runtime_bus_delta(
    bus: &RuntimeEventBus,
    coalesced: &mut Vec<ProviderStreamEvent>,
    event: Option<RuntimeBusEvent>,
) {
    let Some(event) = event else {
        return;
    };

    bus.publish(event.clone());
    match event {
        RuntimeBusEvent::TextDelta { delta } => {
            coalesced.push(ProviderStreamEvent::TextDelta { delta });
        }
        RuntimeBusEvent::ReasoningDelta { delta } => {
            coalesced.push(ProviderStreamEvent::ReasoningDelta { delta });
        }
        _ => {}
    }
}
