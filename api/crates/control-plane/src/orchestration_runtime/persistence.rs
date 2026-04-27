use anyhow::{anyhow, Result};
use observability::RuntimeEventBus;
use plugin_framework::provider_contract::ProviderStreamEvent;
use serde_json::{json, Value};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

use crate::{
    capability_runtime::{host_tool_capability_id, mcp_tool_capability_id},
    ports::{
        AppendCapabilityInvocationInput, AppendContextProjectionInput, AppendRunEventInput,
        AppendUsageLedgerInput, CreateCallbackTaskInput, CreateCheckpointInput, CreateNodeRunInput,
        OrchestrationRuntimeRepository, UpdateFlowRunInput, UpdateNodeRunInput,
    },
    runtime_observability::{
        append_host_event, append_host_span, coalesce_provider_stream_events,
        projection::{estimate_tokens_for_text, model_input_hash},
        provider_stream_event_type, PROVIDER_DELTA_COALESCE_MAX_BYTES,
    },
    state_transition::{ensure_flow_run_transition, ensure_node_run_transition},
};

pub(super) struct WaitingNodeResumeUpdate {
    pub(super) node_run_id: Uuid,
    pub(super) from_status: domain::NodeRunStatus,
    pub(super) output_payload: Value,
}

pub(super) struct PersistFlowDebugOutcomeInput<'a> {
    pub(super) application_id: Uuid,
    pub(super) flow_run: &'a domain::FlowRunRecord,
    pub(super) outcome: &'a orchestration_runtime::execution_state::FlowDebugExecutionOutcome,
    pub(super) trigger_event_type: &'a str,
    pub(super) trigger_event_payload: Value,
    pub(super) base_started_at: OffsetDateTime,
    pub(super) waiting_node_resume: Option<WaitingNodeResumeUpdate>,
}

pub(super) async fn persist_flow_debug_outcome<R>(
    repository: &R,
    input: PersistFlowDebugOutcomeInput<'_>,
) -> Result<domain::ApplicationRunDetail>
where
    R: OrchestrationRuntimeRepository,
{
    let PersistFlowDebugOutcomeInput {
        application_id,
        flow_run,
        outcome,
        trigger_event_type,
        trigger_event_payload,
        base_started_at,
        waiting_node_resume,
    } = input;
    let flow_span = append_host_span(
        repository,
        flow_run.id,
        None,
        None,
        domain::RuntimeSpanKind::Flow,
        "debug flow",
        base_started_at,
        json!({
            "application_id": application_id,
            "run_mode": flow_run.run_mode.as_str(),
            "trigger_event_type": trigger_event_type,
        }),
    )
    .await?;
    repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: waiting_node_resume.as_ref().map(|value| value.node_run_id),
            event_type: trigger_event_type.to_string(),
            payload: trigger_event_payload,
        })
        .await?;

    if let Some(waiting_node_resume) = waiting_node_resume {
        ensure_node_run_transition(
            waiting_node_resume.from_status,
            domain::NodeRunStatus::Succeeded,
            "resume_waiting_node",
        )?;
        repository
            .update_node_run(&UpdateNodeRunInput {
                node_run_id: waiting_node_resume.node_run_id,
                status: domain::NodeRunStatus::Succeeded,
                output_payload: waiting_node_resume.output_payload,
                error_payload: None,
                metrics_payload: json!({ "resumed": true }),
                finished_at: Some(OffsetDateTime::now_utc()),
            })
            .await?;
    }

    let waiting_node_run = persist_flow_debug_node_traces(
        repository,
        flow_run.id,
        Some(flow_span.id),
        outcome,
        base_started_at,
    )
    .await?;

    match &outcome.stop_reason {
        orchestration_runtime::execution_state::ExecutionStopReason::WaitingHuman(wait) => {
            let snapshot = outcome
                .checkpoint_snapshot
                .as_ref()
                .ok_or_else(|| anyhow!("waiting_human outcome is missing checkpoint"))?;
            let waiting_node_run = waiting_node_run
                .ok_or_else(|| anyhow!("waiting_human outcome is missing node run"))?;
            repository
                .create_checkpoint(&CreateCheckpointInput {
                    flow_run_id: flow_run.id,
                    node_run_id: Some(waiting_node_run.id),
                    status: "waiting_human".to_string(),
                    reason: "等待人工输入".to_string(),
                    locator_payload: json!({
                        "node_id": wait.node_id,
                        "next_node_index": snapshot.next_node_index,
                    }),
                    variable_snapshot: Value::Object(snapshot.variable_pool.clone()),
                    external_ref_payload: Some(json!({ "prompt": wait.prompt })),
                })
                .await?;
            repository
                .update_flow_run(&UpdateFlowRunInput {
                    flow_run_id: flow_run.id,
                    status: {
                        ensure_flow_run_transition(
                            flow_run.status,
                            domain::FlowRunStatus::WaitingHuman,
                            "persist_flow_waiting_human",
                        )?;
                        domain::FlowRunStatus::WaitingHuman
                    },
                    output_payload: json!({}),
                    error_payload: None,
                    finished_at: None,
                })
                .await?;
        }
        orchestration_runtime::execution_state::ExecutionStopReason::WaitingCallback(wait) => {
            let snapshot = outcome
                .checkpoint_snapshot
                .as_ref()
                .ok_or_else(|| anyhow!("waiting_callback outcome is missing checkpoint"))?;
            let waiting_node_run = waiting_node_run
                .ok_or_else(|| anyhow!("waiting_callback outcome is missing node run"))?;
            repository
                .create_checkpoint(&CreateCheckpointInput {
                    flow_run_id: flow_run.id,
                    node_run_id: Some(waiting_node_run.id),
                    status: "waiting_callback".to_string(),
                    reason: "等待 callback 回填".to_string(),
                    locator_payload: json!({
                        "node_id": wait.node_id,
                        "next_node_index": snapshot.next_node_index,
                    }),
                    variable_snapshot: Value::Object(snapshot.variable_pool.clone()),
                    external_ref_payload: Some(wait.request_payload.clone()),
                })
                .await?;
            repository
                .create_callback_task(&CreateCallbackTaskInput {
                    flow_run_id: flow_run.id,
                    node_run_id: waiting_node_run.id,
                    callback_kind: wait.callback_kind.clone(),
                    request_payload: wait.request_payload.clone(),
                    external_ref_payload: Some(wait.request_payload.clone()),
                })
                .await?;
            repository
                .update_flow_run(&UpdateFlowRunInput {
                    flow_run_id: flow_run.id,
                    status: {
                        ensure_flow_run_transition(
                            flow_run.status,
                            domain::FlowRunStatus::WaitingCallback,
                            "persist_flow_waiting_callback",
                        )?;
                        domain::FlowRunStatus::WaitingCallback
                    },
                    output_payload: json!({}),
                    error_payload: None,
                    finished_at: None,
                })
                .await?;
        }
        orchestration_runtime::execution_state::ExecutionStopReason::Completed => {
            ensure_flow_run_transition(
                flow_run.status,
                domain::FlowRunStatus::Succeeded,
                "persist_flow_completed",
            )?;
            repository
                .update_flow_run(&UpdateFlowRunInput {
                    flow_run_id: flow_run.id,
                    status: domain::FlowRunStatus::Succeeded,
                    output_payload: final_flow_output_payload(outcome),
                    error_payload: None,
                    finished_at: Some(OffsetDateTime::now_utc()),
                })
                .await?;
            repository
                .append_run_event(&AppendRunEventInput {
                    flow_run_id: flow_run.id,
                    node_run_id: None,
                    event_type: "flow_run_completed".to_string(),
                    payload: final_flow_output_payload(outcome),
                })
                .await?;
        }
        orchestration_runtime::execution_state::ExecutionStopReason::Failed(failure) => {
            ensure_flow_run_transition(
                flow_run.status,
                domain::FlowRunStatus::Failed,
                "persist_flow_failed",
            )?;
            repository
                .update_flow_run(&UpdateFlowRunInput {
                    flow_run_id: flow_run.id,
                    status: domain::FlowRunStatus::Failed,
                    output_payload: final_flow_output_payload(outcome),
                    error_payload: Some(failure.error_payload.clone()),
                    finished_at: Some(OffsetDateTime::now_utc()),
                })
                .await?;
            repository
                .append_run_event(&AppendRunEventInput {
                    flow_run_id: flow_run.id,
                    node_run_id: None,
                    event_type: "flow_run_failed".to_string(),
                    payload: failure.error_payload.clone(),
                })
                .await?;
        }
    }

    repository
        .get_application_run_detail(application_id, flow_run.id)
        .await?
        .ok_or_else(|| anyhow!("persisted flow run detail not found"))
}

pub(super) async fn persist_preview_events<R>(
    repository: &R,
    flow_run: &domain::FlowRunRecord,
    node_run: &domain::NodeRunRecord,
    preview: &orchestration_runtime::preview_executor::NodePreviewOutcome,
) -> Result<Vec<domain::RunEventRecord>>
where
    R: OrchestrationRuntimeRepository,
{
    let mut events = Vec::new();
    let started = repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: Some(node_run.id),
            event_type: "node_preview_started".to_string(),
            payload: json!({
                "target_node_id": preview.target_node_id,
                "input_payload": flow_run.input_payload,
            }),
        })
        .await?;
    events.push(started);
    events.extend(
        append_provider_stream_events(
            repository,
            flow_run.id,
            Some(node_run.id),
            None,
            &preview.provider_events,
        )
        .await?,
    );
    let completed = repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: Some(node_run.id),
            event_type: if preview.is_failed() {
                "node_preview_failed".to_string()
            } else {
                "node_preview_completed".to_string()
            },
            payload: preview.as_payload(),
        })
        .await?;
    events.push(completed);

    Ok(events)
}

pub(super) fn checkpoint_snapshot_from_record(
    checkpoint: &domain::CheckpointRecord,
) -> Result<orchestration_runtime::execution_state::CheckpointSnapshot> {
    Ok(orchestration_runtime::execution_state::CheckpointSnapshot {
        next_node_index: checkpoint
            .locator_payload
            .get("next_node_index")
            .and_then(Value::as_u64)
            .ok_or_else(|| anyhow!("checkpoint is missing next_node_index"))?
            as usize,
        variable_pool: checkpoint
            .variable_snapshot
            .as_object()
            .cloned()
            .ok_or_else(|| anyhow!("checkpoint variable_snapshot must be an object"))?,
    })
}

pub(super) fn checkpoint_node_id(checkpoint: &domain::CheckpointRecord) -> Result<String> {
    checkpoint
        .locator_payload
        .get("node_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| anyhow!("checkpoint is missing node_id"))
}

pub(super) fn next_node_started_at(detail: &domain::ApplicationRunDetail) -> OffsetDateTime {
    detail
        .node_runs
        .iter()
        .map(|record| record.started_at)
        .max()
        .map(|value| value + Duration::seconds(1))
        .unwrap_or_else(OffsetDateTime::now_utc)
}

fn final_flow_output_payload(
    outcome: &orchestration_runtime::execution_state::FlowDebugExecutionOutcome,
) -> Value {
    outcome
        .node_traces
        .last()
        .map(|trace| trace.output_payload.clone())
        .unwrap_or_else(|| json!({}))
}

async fn append_provider_stream_events<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    span_id: Option<Uuid>,
    events: &[ProviderStreamEvent],
) -> Result<Vec<domain::RunEventRecord>>
where
    R: OrchestrationRuntimeRepository,
{
    let runtime_bus = RuntimeEventBus::new((events.len() + 4).max(16));
    let events =
        coalesce_provider_stream_events(&runtime_bus, events, PROVIDER_DELTA_COALESCE_MAX_BYTES)?;
    let mut records = Vec::with_capacity(events.len());
    for event in &events {
        let event_type = provider_stream_event_type(event);
        let payload = serde_json::to_value(event)?;
        records.push(
            repository
                .append_run_event(&AppendRunEventInput {
                    flow_run_id,
                    node_run_id,
                    event_type: event_type.to_string(),
                    payload: payload.clone(),
                })
                .await?,
        );
        append_host_event(
            repository,
            flow_run_id,
            node_run_id,
            span_id,
            event_type,
            domain::RuntimeEventLayer::ProviderRaw,
            payload,
        )
        .await?;
        append_provider_capability_intent(repository, flow_run_id, node_run_id, span_id, event)
            .await?;
    }
    Ok(records)
}

async fn append_provider_capability_intent<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    span_id: Option<Uuid>,
    event: &ProviderStreamEvent,
) -> Result<()>
where
    R: OrchestrationRuntimeRepository,
{
    let (capability_id, call) = match event {
        ProviderStreamEvent::ToolCallCommit { call } => (
            host_tool_capability_id(&call.name),
            serde_json::to_value(call)?,
        ),
        ProviderStreamEvent::McpCallCommit { call } => (
            mcp_tool_capability_id(&call.server, &call.method),
            serde_json::to_value(call)?,
        ),
        _ => return Ok(()),
    };

    let event = append_host_event(
        repository,
        flow_run_id,
        node_run_id,
        span_id,
        "capability_call_requested",
        domain::RuntimeEventLayer::Capability,
        json!({
            "provider_only_intent": true,
            "capability_id": capability_id,
            "requested_by": "model",
            "call": call,
        }),
    )
    .await?;
    repository
        .append_capability_invocation(&AppendCapabilityInvocationInput {
            flow_run_id,
            span_id,
            capability_id,
            requested_by_span_id: span_id,
            requester_kind: "model".to_string(),
            arguments_ref: Some(format!("runtime_artifact:inline:{}", event.id)),
            authorization_status: "requested".to_string(),
            authorization_reason: None,
            result_ref: None,
            normalized_result: None,
            started_at: None,
            finished_at: None,
            error_payload: None,
        })
        .await?;

    Ok(())
}

async fn persist_llm_context_observability<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Uuid,
    span_id: Uuid,
    trace: &orchestration_runtime::execution_state::NodeExecutionTrace,
) -> Result<()>
where
    R: OrchestrationRuntimeRepository,
{
    let model_input = json!({
        "node_input": trace.input_payload,
        "provider": trace.metrics_payload.get("provider_code").cloned().unwrap_or(Value::Null),
        "model": trace.metrics_payload.get("model").cloned().unwrap_or(Value::Null),
    });
    let model_input_hash = model_input_hash(&model_input);
    repository
        .append_context_projection(&AppendContextProjectionInput {
            flow_run_id,
            node_run_id: Some(node_run_id),
            llm_turn_span_id: Some(span_id),
            projection_kind: "managed_full".to_string(),
            merge_stage_ref: None,
            source_transcript_ref: None,
            source_item_refs: json!([]),
            compaction_event_id: None,
            summary_version: None,
            model_input_ref: format!("runtime_artifact:inline:{model_input_hash}"),
            model_input_hash,
            compacted_summary_ref: None,
            previous_projection_id: None,
            token_estimate: Some(estimate_tokens_for_text(&model_input.to_string())),
            provider_continuation_metadata: json!({}),
        })
        .await?;

    let usage = trace.metrics_payload.get("usage").cloned();
    let raw_usage = usage.clone().unwrap_or_else(|| json!({}));
    let usage_status = if usage.is_some() && trace.error_payload.is_none() {
        domain::UsageLedgerStatus::Recorded
    } else {
        domain::UsageLedgerStatus::UnavailableError
    };

    repository
        .append_usage_ledger(&AppendUsageLedgerInput {
            flow_run_id,
            node_run_id: Some(node_run_id),
            span_id: Some(span_id),
            failover_attempt_id: None,
            provider_instance_id: trace
                .metrics_payload
                .get("provider_instance_id")
                .and_then(Value::as_str)
                .and_then(|value| Uuid::parse_str(value).ok()),
            gateway_route_id: None,
            model_id: trace
                .metrics_payload
                .get("model")
                .and_then(Value::as_str)
                .map(str::to_string),
            upstream_model_id: None,
            upstream_request_id: None,
            input_tokens: usage_i64(&raw_usage, "input_tokens"),
            cached_input_tokens: usage_i64(&raw_usage, "cached_input_tokens"),
            output_tokens: usage_i64(&raw_usage, "output_tokens"),
            reasoning_output_tokens: usage_i64(&raw_usage, "reasoning_tokens"),
            total_tokens: usage_i64(&raw_usage, "total_tokens"),
            cache_read_tokens: usage_i64(&raw_usage, "cache_read_tokens"),
            cache_write_tokens: usage_i64(&raw_usage, "cache_write_tokens"),
            price_snapshot: None,
            cost_snapshot: None,
            usage_status,
            raw_usage: raw_usage.clone(),
            normalized_usage: raw_usage,
        })
        .await?;

    Ok(())
}

fn usage_i64(usage: &Value, field: &str) -> Option<i64> {
    usage.get(field).and_then(Value::as_i64)
}

async fn persist_flow_debug_node_traces<R>(
    repository: &R,
    flow_run_id: Uuid,
    flow_span_id: Option<Uuid>,
    outcome: &orchestration_runtime::execution_state::FlowDebugExecutionOutcome,
    base_started_at: OffsetDateTime,
) -> Result<Option<domain::NodeRunRecord>>
where
    R: OrchestrationRuntimeRepository,
{
    let waiting_node_id = match &outcome.stop_reason {
        orchestration_runtime::execution_state::ExecutionStopReason::WaitingHuman(wait) => {
            Some((wait.node_id.as_str(), domain::NodeRunStatus::WaitingHuman))
        }
        orchestration_runtime::execution_state::ExecutionStopReason::WaitingCallback(wait) => {
            Some((
                wait.node_id.as_str(),
                domain::NodeRunStatus::WaitingCallback,
            ))
        }
        orchestration_runtime::execution_state::ExecutionStopReason::Failed(failure) => {
            Some((failure.node_id.as_str(), domain::NodeRunStatus::Failed))
        }
        orchestration_runtime::execution_state::ExecutionStopReason::Completed => None,
    };
    let mut waiting_node_run = None;

    for (index, trace) in outcome.node_traces.iter().enumerate() {
        let started_at = base_started_at + Duration::seconds(index as i64);
        let node_run = repository
            .create_node_run(&CreateNodeRunInput {
                flow_run_id,
                node_id: trace.node_id.clone(),
                node_type: trace.node_type.clone(),
                node_alias: trace.node_alias.clone(),
                status: domain::NodeRunStatus::Running,
                input_payload: trace.input_payload.clone(),
                started_at,
            })
            .await?;
        let span_kind = if trace.node_type == "llm" {
            domain::RuntimeSpanKind::LlmTurn
        } else {
            domain::RuntimeSpanKind::Node
        };
        let node_span = append_host_span(
            repository,
            flow_run_id,
            Some(node_run.id),
            flow_span_id,
            span_kind,
            trace.node_alias.clone(),
            started_at,
            json!({
                "node_id": trace.node_id,
                "node_type": trace.node_type,
            }),
        )
        .await?;
        let (status, finished_at) = match waiting_node_id {
            Some((waiting_id, waiting_status)) if waiting_id == trace.node_id => {
                if waiting_status == domain::NodeRunStatus::Failed {
                    (waiting_status, Some(started_at))
                } else {
                    (waiting_status, None)
                }
            }
            _ => (domain::NodeRunStatus::Succeeded, Some(started_at)),
        };
        ensure_node_run_transition(
            domain::NodeRunStatus::Running,
            status,
            "persist_flow_debug_node_trace",
        )?;
        let node_run = repository
            .update_node_run(&UpdateNodeRunInput {
                node_run_id: node_run.id,
                status,
                output_payload: trace.output_payload.clone(),
                error_payload: trace.error_payload.clone(),
                metrics_payload: trace.metrics_payload.clone(),
                finished_at,
            })
            .await?;
        if trace.node_type == "llm" {
            persist_llm_context_observability(
                repository,
                flow_run_id,
                node_run.id,
                node_span.id,
                trace,
            )
            .await?;
        }
        append_provider_stream_events(
            repository,
            flow_run_id,
            Some(node_run.id),
            Some(node_span.id),
            &trace.provider_events,
        )
        .await?;

        if finished_at.is_none() && status != domain::NodeRunStatus::Failed {
            waiting_node_run = Some(node_run);
        }
    }

    Ok(waiting_node_run)
}
