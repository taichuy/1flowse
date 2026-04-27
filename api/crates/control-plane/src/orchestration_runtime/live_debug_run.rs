use anyhow::{anyhow, Result};
use observability::RuntimeEventBus;
use plugin_framework::provider_contract::ProviderStreamEvent;
use serde_json::{json, Value};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    capability_runtime::{host_tool_capability_id, mcp_tool_capability_id},
    errors::ControlPlaneError,
    flow::FlowService,
    ports::{
        AppendCapabilityInvocationInput, AppendContextProjectionInput,
        AppendModelFailoverAttemptLedgerInput, AppendRunEventInput, AppendUsageLedgerInput,
        CreateCallbackTaskInput, CreateCheckpointInput, CreateFlowRunInput, CreateNodeRunInput,
        LinkUsageLedgerToModelFailoverAttemptInput, OrchestrationRuntimeRepository,
        UpdateFlowRunInput, UpdateNodeRunInput,
    },
    runtime_observability::{
        append_host_event, append_host_span, coalesce_provider_stream_events,
        projection::{estimate_tokens_for_text, model_input_hash},
        provider_stream_event_type, PROVIDER_DELTA_COALESCE_MAX_BYTES,
    },
    state_transition::{ensure_flow_run_transition, ensure_node_run_transition},
};

use super::{
    compile_context::ensure_compiled_plan_runnable, inputs::build_compiled_plan_input,
    CancelFlowRunCommand, ContinueFlowDebugRunCommand, OrchestrationRuntimeService,
    StartFlowDebugRunCommand,
};

pub(super) async fn start_flow_debug_run<R, H>(
    service: &OrchestrationRuntimeService<R, H>,
    command: StartFlowDebugRunCommand,
) -> Result<domain::ApplicationRunDetail>
where
    R: crate::ports::ApplicationRepository
        + crate::ports::FlowRepository
        + OrchestrationRuntimeRepository
        + crate::ports::ModelProviderRepository
        + crate::ports::NodeContributionRepository
        + crate::ports::PluginRepository
        + Clone,
    H: crate::ports::ProviderRuntimePort
        + crate::capability_plugin_runtime::CapabilityPluginRuntimePort
        + Clone,
{
    let actor = service
        .repository
        .load_actor_context_for_user(command.actor_user_id)
        .await?;
    let editor_state = FlowService::new(service.repository.clone())
        .get_or_create_editor_state(command.actor_user_id, command.application_id)
        .await?;
    let application = service
        .repository
        .get_application(actor.current_workspace_id, command.application_id)
        .await?
        .ok_or(ControlPlaneError::NotFound("application"))?;
    let compile_context = service
        .build_compile_context(application.workspace_id)
        .await?;
    let debug_document = command
        .document_snapshot
        .as_ref()
        .unwrap_or(&editor_state.draft.document);

    let mut compiled_plan = orchestration_runtime::compiler::FlowCompiler::compile(
        editor_state.flow.id,
        &editor_state.draft.id.to_string(),
        debug_document,
        &compile_context,
    )?;
    super::freeze_failover_queue_routes(&service.repository, &mut compiled_plan).await?;
    ensure_compiled_plan_runnable(&compiled_plan)?;
    let compiled_record = service
        .repository
        .upsert_compiled_plan(&build_compiled_plan_input(
            command.actor_user_id,
            &editor_state,
            &compiled_plan,
        )?)
        .await?;
    let flow_run = service
        .repository
        .create_flow_run(&CreateFlowRunInput {
            actor_user_id: command.actor_user_id,
            application_id: command.application_id,
            flow_id: editor_state.flow.id,
            flow_draft_id: editor_state.draft.id,
            compiled_plan_id: compiled_record.id,
            run_mode: domain::FlowRunMode::DebugFlowRun,
            target_node_id: None,
            status: domain::FlowRunStatus::Running,
            input_payload: command.input_payload.clone(),
            started_at: OffsetDateTime::now_utc(),
        })
        .await?;

    service
        .repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: None,
            event_type: "flow_run_started".to_string(),
            payload: json!({
                "run_mode": domain::FlowRunMode::DebugFlowRun.as_str(),
                "input_payload": command.input_payload,
            }),
        })
        .await?;

    load_run_detail(&service.repository, command.application_id, flow_run.id).await
}

pub(super) async fn continue_flow_debug_run<R, H>(
    service: &OrchestrationRuntimeService<R, H>,
    command: ContinueFlowDebugRunCommand,
) -> Result<domain::ApplicationRunDetail>
where
    R: crate::ports::ApplicationRepository
        + crate::ports::FlowRepository
        + OrchestrationRuntimeRepository
        + crate::ports::ModelProviderRepository
        + crate::ports::NodeContributionRepository
        + crate::ports::PluginRepository
        + Clone,
    H: crate::ports::ProviderRuntimePort
        + crate::capability_plugin_runtime::CapabilityPluginRuntimePort
        + Clone,
{
    let result = continue_flow_debug_run_inner(service, &command).await;

    match result {
        Ok(detail) => Ok(detail),
        Err(error) => fail_flow_run(service, command.application_id, command.flow_run_id, &error)
            .await
            .or(Err(error)),
    }
}

pub(super) async fn cancel_flow_run<R, H>(
    service: &OrchestrationRuntimeService<R, H>,
    command: CancelFlowRunCommand,
) -> Result<domain::ApplicationRunDetail>
where
    R: crate::ports::ApplicationRepository
        + crate::ports::FlowRepository
        + OrchestrationRuntimeRepository
        + crate::ports::ModelProviderRepository
        + crate::ports::NodeContributionRepository
        + crate::ports::PluginRepository
        + Clone,
    H: crate::ports::ProviderRuntimePort
        + crate::capability_plugin_runtime::CapabilityPluginRuntimePort
        + Clone,
{
    let actor = service
        .repository
        .load_actor_context_for_user(command.actor_user_id)
        .await?;
    service
        .repository
        .get_application(actor.current_workspace_id, command.application_id)
        .await?
        .ok_or(ControlPlaneError::NotFound("application"))?;
    let flow_run = service
        .repository
        .get_flow_run(command.application_id, command.flow_run_id)
        .await?
        .ok_or_else(|| anyhow!("flow run not found"))?;
    ensure_flow_run_transition(
        flow_run.status,
        domain::FlowRunStatus::Cancelled,
        "cancel_flow_run",
    )?;
    service
        .repository
        .update_flow_run(&UpdateFlowRunInput {
            flow_run_id: flow_run.id,
            status: domain::FlowRunStatus::Cancelled,
            output_payload: flow_run.output_payload,
            error_payload: flow_run.error_payload,
            finished_at: Some(OffsetDateTime::now_utc()),
        })
        .await?;
    service
        .repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: None,
            event_type: "flow_run_cancelled".to_string(),
            payload: json!({
                "reason": "manual_stop",
            }),
        })
        .await?;

    load_run_detail(&service.repository, command.application_id, flow_run.id).await
}

async fn continue_flow_debug_run_inner<R, H>(
    service: &OrchestrationRuntimeService<R, H>,
    command: &ContinueFlowDebugRunCommand,
) -> Result<domain::ApplicationRunDetail>
where
    R: crate::ports::ApplicationRepository
        + crate::ports::FlowRepository
        + OrchestrationRuntimeRepository
        + crate::ports::ModelProviderRepository
        + crate::ports::NodeContributionRepository
        + crate::ports::PluginRepository
        + Clone,
    H: crate::ports::ProviderRuntimePort
        + crate::capability_plugin_runtime::CapabilityPluginRuntimePort
        + Clone,
{
    let flow_run = service
        .repository
        .get_flow_run(command.application_id, command.flow_run_id)
        .await?
        .ok_or_else(|| anyhow!("flow run not found"))?;
    if flow_run.status != domain::FlowRunStatus::Running {
        return load_run_detail(&service.repository, command.application_id, flow_run.id).await;
    }
    let application = service
        .repository
        .get_application(command.workspace_id, command.application_id)
        .await?
        .ok_or(ControlPlaneError::NotFound("application"))?;
    let compiled_record = service
        .repository
        .get_compiled_plan(flow_run.compiled_plan_id)
        .await?
        .ok_or_else(|| anyhow!("compiled plan not found"))?;
    let compiled_plan: orchestration_runtime::compiled_plan::CompiledPlan =
        serde_json::from_value(compiled_record.plan)?;
    let invoker = service.runtime_invoker(application.workspace_id);
    let mut variable_pool = flow_run
        .input_payload
        .as_object()
        .cloned()
        .ok_or_else(|| anyhow!("input payload must be an object"))?;
    let mut last_output_payload = json!({});
    let flow_span = append_host_span(
        &service.repository,
        flow_run.id,
        None,
        None,
        domain::RuntimeSpanKind::Flow,
        "debug flow",
        flow_run.started_at,
        json!({
            "application_id": command.application_id,
            "run_mode": flow_run.run_mode.as_str(),
            "trigger_event_type": "flow_run_continued",
        }),
    )
    .await?;

    for node_id in &compiled_plan.topological_order {
        if is_run_cancelled(&service.repository, command.application_id, flow_run.id).await? {
            return load_run_detail(&service.repository, command.application_id, flow_run.id).await;
        }

        let node = compiled_plan
            .nodes
            .get(node_id)
            .ok_or_else(|| anyhow!("compiled node missing: {node_id}"))?;
        let resolved_inputs =
            orchestration_runtime::binding_runtime::resolve_node_inputs(node, &variable_pool)?;
        let rendered_templates = orchestration_runtime::binding_runtime::render_templated_bindings(
            node,
            &resolved_inputs,
        );
        let node_started_at = OffsetDateTime::now_utc();
        let node_run = service
            .repository
            .create_node_run(&CreateNodeRunInput {
                flow_run_id: flow_run.id,
                node_id: node.node_id.clone(),
                node_type: node.node_type.clone(),
                node_alias: node.alias.clone(),
                status: domain::NodeRunStatus::Running,
                input_payload: Value::Object(resolved_inputs.clone()),
                started_at: node_started_at,
            })
            .await?;
        let node_span = append_host_span(
            &service.repository,
            flow_run.id,
            Some(node_run.id),
            Some(flow_span.id),
            if node.node_type == "llm" {
                domain::RuntimeSpanKind::LlmTurn
            } else {
                domain::RuntimeSpanKind::Node
            },
            node.alias.clone(),
            node_started_at,
            json!({
                "node_id": node.node_id,
                "node_type": node.node_type,
            }),
        )
        .await?;

        match node.node_type.as_str() {
            "start" => {
                let output_payload = variable_pool
                    .get(node_id)
                    .cloned()
                    .unwrap_or_else(|| json!({}));
                last_output_payload = output_payload.clone();
                service
                    .repository
                    .update_node_run(&UpdateNodeRunInput {
                        node_run_id: node_run.id,
                        status: domain::NodeRunStatus::Succeeded,
                        output_payload,
                        error_payload: None,
                        metrics_payload: json!({ "preview_mode": true }),
                        finished_at: Some(OffsetDateTime::now_utc()),
                    })
                    .await?;
            }
            "llm" => {
                let execution = orchestration_runtime::execution_engine::execute_llm_node(
                    node,
                    &resolved_inputs,
                    &rendered_templates,
                    &invoker,
                )
                .await?;
                last_output_payload = execution.output_payload.clone();
                let node_status = if execution.error_payload.is_some() {
                    domain::NodeRunStatus::Failed
                } else {
                    domain::NodeRunStatus::Succeeded
                };
                ensure_node_run_transition(
                    domain::NodeRunStatus::Running,
                    node_status,
                    "continue_flow_debug_run",
                )?;
                service
                    .repository
                    .update_node_run(&UpdateNodeRunInput {
                        node_run_id: node_run.id,
                        status: node_status,
                        output_payload: execution.output_payload.clone(),
                        error_payload: execution.error_payload.clone(),
                        metrics_payload: execution.metrics_payload.clone(),
                        finished_at: Some(OffsetDateTime::now_utc()),
                    })
                    .await?;
                persist_llm_context_observability(
                    &service.repository,
                    flow_run.id,
                    node_run.id,
                    node_span.id,
                    Value::Object(resolved_inputs.clone()),
                    &execution.metrics_payload,
                    execution.error_payload.as_ref(),
                )
                .await?;
                append_provider_stream_events(
                    &service.repository,
                    flow_run.id,
                    Some(node_run.id),
                    Some(node_span.id),
                    &execution.provider_events,
                )
                .await?;

                if is_run_cancelled(&service.repository, command.application_id, flow_run.id)
                    .await?
                {
                    return load_run_detail(
                        &service.repository,
                        command.application_id,
                        flow_run.id,
                    )
                    .await;
                }

                if let Some(error_payload) = execution.error_payload {
                    ensure_flow_run_transition(
                        domain::FlowRunStatus::Running,
                        domain::FlowRunStatus::Failed,
                        "continue_flow_debug_run",
                    )?;
                    service
                        .repository
                        .update_flow_run(&UpdateFlowRunInput {
                            flow_run_id: flow_run.id,
                            status: domain::FlowRunStatus::Failed,
                            output_payload: last_output_payload.clone(),
                            error_payload: Some(error_payload.clone()),
                            finished_at: Some(OffsetDateTime::now_utc()),
                        })
                        .await?;
                    service
                        .repository
                        .append_run_event(&AppendRunEventInput {
                            flow_run_id: flow_run.id,
                            node_run_id: Some(node_run.id),
                            event_type: "flow_run_failed".to_string(),
                            payload: error_payload,
                        })
                        .await?;
                    return load_run_detail(
                        &service.repository,
                        command.application_id,
                        flow_run.id,
                    )
                    .await;
                }

                variable_pool.insert(node.node_id.clone(), execution.output_payload);
            }
            "plugin_node" => {
                let execution =
                    orchestration_runtime::execution_engine::execute_capability_plugin_node(
                        node,
                        &resolved_inputs,
                        &rendered_templates,
                        &invoker,
                    )
                    .await?;
                last_output_payload = execution.output_payload.clone();
                let node_status = if execution.error_payload.is_some() {
                    domain::NodeRunStatus::Failed
                } else {
                    domain::NodeRunStatus::Succeeded
                };
                ensure_node_run_transition(
                    domain::NodeRunStatus::Running,
                    node_status,
                    "continue_flow_debug_run",
                )?;
                service
                    .repository
                    .update_node_run(&UpdateNodeRunInput {
                        node_run_id: node_run.id,
                        status: node_status,
                        output_payload: execution.output_payload.clone(),
                        error_payload: execution.error_payload.clone(),
                        metrics_payload: execution.metrics_payload.clone(),
                        finished_at: Some(OffsetDateTime::now_utc()),
                    })
                    .await?;

                if is_run_cancelled(&service.repository, command.application_id, flow_run.id)
                    .await?
                {
                    return load_run_detail(
                        &service.repository,
                        command.application_id,
                        flow_run.id,
                    )
                    .await;
                }

                if let Some(error_payload) = execution.error_payload {
                    ensure_flow_run_transition(
                        domain::FlowRunStatus::Running,
                        domain::FlowRunStatus::Failed,
                        "continue_flow_debug_run",
                    )?;
                    service
                        .repository
                        .update_flow_run(&UpdateFlowRunInput {
                            flow_run_id: flow_run.id,
                            status: domain::FlowRunStatus::Failed,
                            output_payload: last_output_payload.clone(),
                            error_payload: Some(error_payload.clone()),
                            finished_at: Some(OffsetDateTime::now_utc()),
                        })
                        .await?;
                    service
                        .repository
                        .append_run_event(&AppendRunEventInput {
                            flow_run_id: flow_run.id,
                            node_run_id: Some(node_run.id),
                            event_type: "flow_run_failed".to_string(),
                            payload: error_payload,
                        })
                        .await?;
                    return load_run_detail(
                        &service.repository,
                        command.application_id,
                        flow_run.id,
                    )
                    .await;
                }

                variable_pool.insert(node.node_id.clone(), execution.output_payload);
            }
            "template_transform" | "answer" => {
                let output_key = first_output_key(node);
                let output_value =
                    rendered_templates
                        .values()
                        .next()
                        .cloned()
                        .unwrap_or_else(|| {
                            resolved_inputs
                                .values()
                                .next()
                                .cloned()
                                .unwrap_or(Value::Null)
                        });
                let output_payload = json!({ output_key: output_value });
                last_output_payload = output_payload.clone();
                variable_pool.insert(node.node_id.clone(), output_payload.clone());
                service
                    .repository
                    .update_node_run(&UpdateNodeRunInput {
                        node_run_id: node_run.id,
                        status: domain::NodeRunStatus::Succeeded,
                        output_payload,
                        error_payload: None,
                        metrics_payload: json!({ "preview_mode": true }),
                        finished_at: Some(OffsetDateTime::now_utc()),
                    })
                    .await?;
            }
            "human_input" => {
                service
                    .repository
                    .update_node_run(&UpdateNodeRunInput {
                        node_run_id: node_run.id,
                        status: domain::NodeRunStatus::WaitingHuman,
                        output_payload: json!({}),
                        error_payload: None,
                        metrics_payload: json!({ "preview_mode": true, "waiting": "human_input" }),
                        finished_at: None,
                    })
                    .await?;

                if is_run_cancelled(&service.repository, command.application_id, flow_run.id)
                    .await?
                {
                    return load_run_detail(
                        &service.repository,
                        command.application_id,
                        flow_run.id,
                    )
                    .await;
                }

                let prompt = rendered_templates
                    .get("prompt")
                    .and_then(Value::as_str)
                    .unwrap_or("请提供人工输入");
                ensure_flow_run_transition(
                    domain::FlowRunStatus::Running,
                    domain::FlowRunStatus::WaitingHuman,
                    "continue_flow_debug_run",
                )?;
                service
                    .repository
                    .create_checkpoint(&CreateCheckpointInput {
                        flow_run_id: flow_run.id,
                        node_run_id: Some(node_run.id),
                        status: "waiting_human".to_string(),
                        reason: "等待人工输入".to_string(),
                        locator_payload: json!({
                            "node_id": node.node_id,
                            "next_node_index": next_node_index(&compiled_plan, node_id)?,
                        }),
                        variable_snapshot: Value::Object(variable_pool.clone()),
                        external_ref_payload: Some(json!({ "prompt": prompt })),
                    })
                    .await?;
                service
                    .repository
                    .update_flow_run(&UpdateFlowRunInput {
                        flow_run_id: flow_run.id,
                        status: domain::FlowRunStatus::WaitingHuman,
                        output_payload: last_output_payload.clone(),
                        error_payload: None,
                        finished_at: None,
                    })
                    .await?;
                return load_run_detail(&service.repository, command.application_id, flow_run.id)
                    .await;
            }
            "tool" | "http_request" => {
                let request_payload = Value::Object(resolved_inputs.clone());
                service
                    .repository
                    .update_node_run(&UpdateNodeRunInput {
                        node_run_id: node_run.id,
                        status: domain::NodeRunStatus::WaitingCallback,
                        output_payload: json!({}),
                        error_payload: None,
                        metrics_payload: json!({ "preview_mode": true, "waiting": node.node_type }),
                        finished_at: None,
                    })
                    .await?;

                if is_run_cancelled(&service.repository, command.application_id, flow_run.id)
                    .await?
                {
                    return load_run_detail(
                        &service.repository,
                        command.application_id,
                        flow_run.id,
                    )
                    .await;
                }

                ensure_flow_run_transition(
                    domain::FlowRunStatus::Running,
                    domain::FlowRunStatus::WaitingCallback,
                    "continue_flow_debug_run",
                )?;
                service
                    .repository
                    .create_checkpoint(&CreateCheckpointInput {
                        flow_run_id: flow_run.id,
                        node_run_id: Some(node_run.id),
                        status: "waiting_callback".to_string(),
                        reason: "等待 callback 回填".to_string(),
                        locator_payload: json!({
                            "node_id": node.node_id,
                            "next_node_index": next_node_index(&compiled_plan, node_id)?,
                        }),
                        variable_snapshot: Value::Object(variable_pool.clone()),
                        external_ref_payload: Some(request_payload.clone()),
                    })
                    .await?;
                service
                    .repository
                    .create_callback_task(&CreateCallbackTaskInput {
                        flow_run_id: flow_run.id,
                        node_run_id: node_run.id,
                        callback_kind: node.node_type.clone(),
                        request_payload: request_payload.clone(),
                        external_ref_payload: Some(request_payload),
                    })
                    .await?;
                service
                    .repository
                    .update_flow_run(&UpdateFlowRunInput {
                        flow_run_id: flow_run.id,
                        status: domain::FlowRunStatus::WaitingCallback,
                        output_payload: last_output_payload.clone(),
                        error_payload: None,
                        finished_at: None,
                    })
                    .await?;
                return load_run_detail(&service.repository, command.application_id, flow_run.id)
                    .await;
            }
            other => return Err(anyhow!("unsupported debug node type: {other}")),
        }
    }

    if is_run_cancelled(&service.repository, command.application_id, flow_run.id).await? {
        return load_run_detail(&service.repository, command.application_id, flow_run.id).await;
    }

    ensure_flow_run_transition(
        domain::FlowRunStatus::Running,
        domain::FlowRunStatus::Succeeded,
        "continue_flow_debug_run",
    )?;
    service
        .repository
        .update_flow_run(&UpdateFlowRunInput {
            flow_run_id: flow_run.id,
            status: domain::FlowRunStatus::Succeeded,
            output_payload: last_output_payload.clone(),
            error_payload: None,
            finished_at: Some(OffsetDateTime::now_utc()),
        })
        .await?;
    service
        .repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: None,
            event_type: "flow_run_completed".to_string(),
            payload: last_output_payload,
        })
        .await?;

    load_run_detail(&service.repository, command.application_id, flow_run.id).await
}

async fn load_run_detail<R>(
    repository: &R,
    application_id: Uuid,
    flow_run_id: Uuid,
) -> Result<domain::ApplicationRunDetail>
where
    R: OrchestrationRuntimeRepository,
{
    repository
        .get_application_run_detail(application_id, flow_run_id)
        .await?
        .ok_or_else(|| anyhow!("flow run detail not found"))
}

async fn fail_flow_run<R, H>(
    service: &OrchestrationRuntimeService<R, H>,
    application_id: Uuid,
    flow_run_id: Uuid,
    error: &anyhow::Error,
) -> Result<domain::ApplicationRunDetail>
where
    R: crate::ports::ApplicationRepository
        + crate::ports::FlowRepository
        + OrchestrationRuntimeRepository
        + crate::ports::ModelProviderRepository
        + crate::ports::NodeContributionRepository
        + crate::ports::PluginRepository
        + Clone,
    H: crate::ports::ProviderRuntimePort
        + crate::capability_plugin_runtime::CapabilityPluginRuntimePort
        + Clone,
{
    let Some(flow_run) = service
        .repository
        .get_flow_run(application_id, flow_run_id)
        .await?
    else {
        return Err(anyhow!("flow run not found"));
    };
    if matches!(
        flow_run.status,
        domain::FlowRunStatus::Cancelled
            | domain::FlowRunStatus::Succeeded
            | domain::FlowRunStatus::Failed
    ) {
        return load_run_detail(&service.repository, application_id, flow_run_id).await;
    }
    ensure_flow_run_transition(
        flow_run.status,
        domain::FlowRunStatus::Failed,
        "fail_flow_run",
    )?;
    let error_payload = json!({ "message": error.to_string() });
    service
        .repository
        .update_flow_run(&UpdateFlowRunInput {
            flow_run_id,
            status: domain::FlowRunStatus::Failed,
            output_payload: flow_run.output_payload,
            error_payload: Some(error_payload.clone()),
            finished_at: Some(OffsetDateTime::now_utc()),
        })
        .await?;
    service
        .repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id,
            node_run_id: None,
            event_type: "flow_run_failed".to_string(),
            payload: error_payload,
        })
        .await?;

    load_run_detail(&service.repository, application_id, flow_run_id).await
}

async fn is_run_cancelled<R>(
    repository: &R,
    application_id: Uuid,
    flow_run_id: Uuid,
) -> Result<bool>
where
    R: OrchestrationRuntimeRepository,
{
    Ok(repository
        .get_flow_run(application_id, flow_run_id)
        .await?
        .map(|run| run.status == domain::FlowRunStatus::Cancelled)
        .unwrap_or(false))
}

async fn append_provider_stream_events<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    span_id: Option<Uuid>,
    events: &[ProviderStreamEvent],
) -> Result<()>
where
    R: OrchestrationRuntimeRepository,
{
    let runtime_bus = RuntimeEventBus::new((events.len() + 4).max(16));
    let events =
        coalesce_provider_stream_events(&runtime_bus, events, PROVIDER_DELTA_COALESCE_MAX_BYTES)?;
    for event in &events {
        let event_type = provider_stream_event_type(event);
        let payload = serde_json::to_value(event)?;
        repository
            .append_run_event(&AppendRunEventInput {
                flow_run_id,
                node_run_id,
                event_type: event_type.to_string(),
                payload: payload.clone(),
            })
            .await?;
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

    Ok(())
}

async fn persist_llm_context_observability<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Uuid,
    span_id: Uuid,
    node_input: Value,
    metrics_payload: &Value,
    error_payload: Option<&Value>,
) -> Result<()>
where
    R: OrchestrationRuntimeRepository,
{
    let model_input = json!({
        "node_input": node_input,
        "provider": metrics_payload.get("provider_code").cloned().unwrap_or(Value::Null),
        "model": metrics_payload.get("model").cloned().unwrap_or(Value::Null),
    });
    let model_input_hash = model_input_hash(&model_input);
    let projection = repository
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

    let usage = metrics_payload.get("usage").cloned();
    let raw_usage = usage.clone().unwrap_or_else(|| json!({}));
    let usage_status = if usage.is_some() && error_payload.is_none() {
        domain::UsageLedgerStatus::Recorded
    } else {
        domain::UsageLedgerStatus::UnavailableError
    };

    let attempts = append_model_attempts_from_metrics(
        repository,
        flow_run_id,
        node_run_id,
        span_id,
        &projection,
        metrics_payload,
        error_payload,
    )
    .await?;
    let usage_attempt_id = winner_attempt_id(&attempts);

    let usage_ledger = repository
        .append_usage_ledger(&AppendUsageLedgerInput {
            flow_run_id,
            node_run_id: Some(node_run_id),
            span_id: Some(span_id),
            failover_attempt_id: usage_attempt_id,
            provider_instance_id: metrics_payload
                .get("provider_instance_id")
                .and_then(Value::as_str)
                .and_then(|value| Uuid::parse_str(value).ok()),
            gateway_route_id: None,
            model_id: metrics_payload
                .get("model")
                .and_then(Value::as_str)
                .map(str::to_string),
            upstream_model_id: metrics_payload
                .get("model")
                .and_then(Value::as_str)
                .map(str::to_string),
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
    if let Some(failover_attempt_id) = usage_attempt_id {
        repository
            .link_usage_ledger_to_model_failover_attempt(
                &LinkUsageLedgerToModelFailoverAttemptInput {
                    failover_attempt_id,
                    usage_ledger_id: usage_ledger.id,
                },
            )
            .await?;
    }

    Ok(())
}

async fn append_model_attempts_from_metrics<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Uuid,
    span_id: Uuid,
    projection: &domain::ContextProjectionRecord,
    metrics_payload: &Value,
    error_payload: Option<&Value>,
) -> Result<Vec<domain::ModelFailoverAttemptLedgerRecord>>
where
    R: OrchestrationRuntimeRepository,
{
    let mut attempt_payloads = metrics_payload
        .get("attempts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    if attempt_payloads.is_empty() {
        attempt_payloads.push(json!({
            "attempt_index": 0,
            "provider_instance_id": metrics_payload.get("provider_instance_id").cloned().unwrap_or(Value::Null),
            "provider_code": metrics_payload.get("provider_code").cloned().unwrap_or(Value::Null),
            "protocol": metrics_payload.get("protocol").cloned().unwrap_or(Value::Null),
            "upstream_model_id": metrics_payload.get("model").cloned().unwrap_or(Value::Null),
            "status": if error_payload.is_some() { "failed" } else { "succeeded" },
            "failed_after_first_token": false,
        }));
    }

    let mut records = Vec::with_capacity(attempt_payloads.len());
    for selected_attempt in attempt_payloads {
        let status = selected_attempt
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or(if error_payload.is_some() {
                "failed"
            } else {
                "succeeded"
            });

        let record = repository
            .append_model_failover_attempt_ledger(&AppendModelFailoverAttemptLedgerInput {
                flow_run_id,
                node_run_id: Some(node_run_id),
                llm_turn_span_id: Some(span_id),
                queue_snapshot_id: metrics_payload
                    .get("queue_snapshot_id")
                    .and_then(Value::as_str)
                    .and_then(|value| Uuid::parse_str(value).ok()),
                attempt_index: selected_attempt
                    .get("attempt_index")
                    .and_then(Value::as_i64)
                    .unwrap_or(records.len() as i64) as i32,
                provider_instance_id: selected_attempt
                    .get("provider_instance_id")
                    .and_then(Value::as_str)
                    .and_then(|value| Uuid::parse_str(value).ok()),
                provider_code: selected_attempt
                    .get("provider_code")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_string(),
                upstream_model_id: selected_attempt
                    .get("upstream_model_id")
                    .or_else(|| selected_attempt.get("model"))
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_string(),
                protocol: selected_attempt
                    .get("protocol")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_string(),
                request_ref: Some(projection.model_input_ref.clone()),
                request_hash: Some(projection.model_input_hash.clone()),
                started_at: OffsetDateTime::now_utc(),
                first_token_at: None,
                finished_at: Some(OffsetDateTime::now_utc()),
                status: status.to_string(),
                failed_after_first_token: selected_attempt
                    .get("failed_after_first_token")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                upstream_request_id: selected_attempt
                    .get("upstream_request_id")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                error_code: selected_attempt
                    .get("error_code")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .or_else(|| {
                        (status != "succeeded").then(|| {
                            error_payload
                                .and_then(|payload| payload.get("error_kind"))
                                .and_then(Value::as_str)
                                .unwrap_or("provider_error")
                                .to_string()
                        })
                    }),
                error_message_ref: selected_attempt
                    .get("error_message_ref")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                usage_ledger_id: None,
                cost_ledger_id: None,
                response_ref: selected_attempt
                    .get("response_ref")
                    .and_then(Value::as_str)
                    .map(str::to_string),
            })
            .await?;
        records.push(record);
    }

    Ok(records)
}

fn winner_attempt_id(attempts: &[domain::ModelFailoverAttemptLedgerRecord]) -> Option<Uuid> {
    attempts
        .iter()
        .find(|attempt| attempt.status == "succeeded")
        .map(|attempt| attempt.id)
}

fn usage_i64(usage: &Value, field: &str) -> Option<i64> {
    usage.get(field).and_then(Value::as_i64)
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

fn next_node_index(
    compiled_plan: &orchestration_runtime::compiled_plan::CompiledPlan,
    node_id: &str,
) -> Result<usize> {
    let index = compiled_plan
        .topological_order
        .iter()
        .position(|value| value == node_id)
        .ok_or_else(|| anyhow!("compiled node missing from topological order: {node_id}"))?;

    Ok(index + 1)
}

fn first_output_key(node: &orchestration_runtime::compiled_plan::CompiledNode) -> String {
    node.outputs
        .first()
        .map(|output| output.key.clone())
        .unwrap_or_else(|| "output".to_string())
}
