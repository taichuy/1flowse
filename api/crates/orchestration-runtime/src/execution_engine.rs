use std::collections::BTreeMap;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use plugin_framework::{
    error::PluginFrameworkError,
    provider_contract::{
        ProviderFinishReason, ProviderInvocationInput, ProviderInvocationResult, ProviderMessage,
        ProviderMessageRole, ProviderRuntimeError, ProviderRuntimeErrorKind, ProviderStreamEvent,
        ProviderUsage,
    },
};
use serde_json::{json, Map, Value};

use crate::{
    binding_runtime::{render_templated_bindings, resolve_node_inputs},
    compiled_plan::{
        CompiledLlmRuntime, CompiledNode, CompiledPlan, CompiledPluginRuntime, LlmRoutingMode,
    },
    execution_state::{
        CheckpointSnapshot, ExecutionStopReason, FlowDebugExecutionOutcome, NodeExecutionFailure,
        NodeExecutionTrace, PendingCallbackTask, PendingHumanInput,
    },
};

#[derive(Debug, Clone, PartialEq)]
pub struct ProviderInvocationOutput {
    pub events: Vec<ProviderStreamEvent>,
    pub result: ProviderInvocationResult,
}

#[async_trait]
pub trait ProviderInvoker: Send + Sync {
    async fn invoke_llm(
        &self,
        runtime: &CompiledLlmRuntime,
        input: ProviderInvocationInput,
    ) -> Result<ProviderInvocationOutput>;
}

#[derive(Debug, Clone, PartialEq)]
pub struct CapabilityInvocationOutput {
    pub output_payload: Value,
}

#[async_trait]
pub trait CapabilityInvoker: Send + Sync {
    async fn invoke_capability_node(
        &self,
        runtime: &CompiledPluginRuntime,
        config_payload: Value,
        input_payload: Value,
    ) -> Result<CapabilityInvocationOutput>;
}

#[derive(Debug, Clone, PartialEq)]
pub struct LlmNodeExecution {
    pub output_payload: Value,
    pub error_payload: Option<Value>,
    pub metrics_payload: Value,
    pub provider_events: Vec<ProviderStreamEvent>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CapabilityNodeExecution {
    pub output_payload: Value,
    pub error_payload: Option<Value>,
    pub metrics_payload: Value,
}

pub async fn start_flow_debug_run<I>(
    plan: &CompiledPlan,
    input_payload: &Value,
    invoker: &I,
) -> Result<FlowDebugExecutionOutcome>
where
    I: ProviderInvoker + CapabilityInvoker + ?Sized,
{
    let variable_pool = input_payload
        .as_object()
        .cloned()
        .ok_or_else(|| anyhow!("input payload must be an object"))?;

    execute_from(plan, 0, variable_pool, invoker).await
}

pub async fn resume_flow_debug_run<I>(
    plan: &CompiledPlan,
    checkpoint: &CheckpointSnapshot,
    resume_payload: &Value,
    invoker: &I,
) -> Result<FlowDebugExecutionOutcome>
where
    I: ProviderInvoker + CapabilityInvoker + ?Sized,
{
    let patch = resume_payload
        .as_object()
        .ok_or_else(|| anyhow!("resume payload must be an object"))?;
    let mut variable_pool = checkpoint.variable_pool.clone();

    for (node_id, payload) in patch {
        variable_pool.insert(node_id.clone(), payload.clone());
    }

    execute_from(plan, checkpoint.next_node_index, variable_pool, invoker).await
}

async fn execute_from<I>(
    plan: &CompiledPlan,
    next_node_index: usize,
    mut variable_pool: Map<String, Value>,
    invoker: &I,
) -> Result<FlowDebugExecutionOutcome>
where
    I: ProviderInvoker + CapabilityInvoker + ?Sized,
{
    let mut node_traces = Vec::new();

    for (index, node_id) in plan
        .topological_order
        .iter()
        .enumerate()
        .skip(next_node_index)
    {
        let node = plan
            .nodes
            .get(node_id)
            .ok_or_else(|| anyhow!("compiled node missing: {node_id}"))?;
        let resolved_inputs = resolve_node_inputs(node, &variable_pool)?;
        let rendered_templates = render_templated_bindings(node, &resolved_inputs);

        match node.node_type.as_str() {
            "start" => {
                let payload = variable_pool
                    .get(node_id)
                    .cloned()
                    .unwrap_or_else(|| json!({}));
                node_traces.push(NodeExecutionTrace {
                    node_id: node.node_id.clone(),
                    node_type: node.node_type.clone(),
                    node_alias: node.alias.clone(),
                    input_payload: json!({}),
                    output_payload: payload,
                    error_payload: None,
                    metrics_payload: json!({ "preview_mode": true }),
                    provider_events: Vec::new(),
                });
            }
            "llm" => {
                let execution =
                    execute_llm_node(node, &resolved_inputs, &rendered_templates, invoker).await?;
                let trace = NodeExecutionTrace {
                    node_id: node.node_id.clone(),
                    node_type: node.node_type.clone(),
                    node_alias: node.alias.clone(),
                    input_payload: Value::Object(resolved_inputs),
                    output_payload: execution.output_payload.clone(),
                    error_payload: execution.error_payload.clone(),
                    metrics_payload: execution.metrics_payload.clone(),
                    provider_events: execution.provider_events.clone(),
                };
                node_traces.push(trace);

                if let Some(error_payload) = execution.error_payload {
                    return Ok(FlowDebugExecutionOutcome {
                        stop_reason: ExecutionStopReason::Failed(NodeExecutionFailure {
                            node_id: node.node_id.clone(),
                            node_alias: node.alias.clone(),
                            error_payload,
                        }),
                        variable_pool,
                        checkpoint_snapshot: None,
                        node_traces,
                    });
                }

                variable_pool.insert(node.node_id.clone(), execution.output_payload);
            }
            "plugin_node" => {
                let execution = execute_capability_plugin_node(
                    node,
                    &resolved_inputs,
                    &rendered_templates,
                    invoker,
                )
                .await?;
                let trace = NodeExecutionTrace {
                    node_id: node.node_id.clone(),
                    node_type: node.node_type.clone(),
                    node_alias: node.alias.clone(),
                    input_payload: Value::Object(resolved_inputs),
                    output_payload: execution.output_payload.clone(),
                    error_payload: execution.error_payload.clone(),
                    metrics_payload: execution.metrics_payload.clone(),
                    provider_events: Vec::new(),
                };
                node_traces.push(trace);

                if let Some(error_payload) = execution.error_payload {
                    return Ok(FlowDebugExecutionOutcome {
                        stop_reason: ExecutionStopReason::Failed(NodeExecutionFailure {
                            node_id: node.node_id.clone(),
                            node_alias: node.alias.clone(),
                            error_payload,
                        }),
                        variable_pool,
                        checkpoint_snapshot: None,
                        node_traces,
                    });
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
                variable_pool.insert(node.node_id.clone(), output_payload.clone());
                node_traces.push(NodeExecutionTrace {
                    node_id: node.node_id.clone(),
                    node_type: node.node_type.clone(),
                    node_alias: node.alias.clone(),
                    input_payload: Value::Object(resolved_inputs),
                    output_payload,
                    error_payload: None,
                    metrics_payload: json!({ "preview_mode": true }),
                    provider_events: Vec::new(),
                });
            }
            "human_input" => {
                let prompt = rendered_templates
                    .get("prompt")
                    .and_then(Value::as_str)
                    .unwrap_or("请提供人工输入")
                    .to_string();
                node_traces.push(NodeExecutionTrace {
                    node_id: node.node_id.clone(),
                    node_type: node.node_type.clone(),
                    node_alias: node.alias.clone(),
                    input_payload: Value::Object(resolved_inputs),
                    output_payload: json!({}),
                    error_payload: None,
                    metrics_payload: json!({ "preview_mode": true, "waiting": "human_input" }),
                    provider_events: Vec::new(),
                });
                return Ok(FlowDebugExecutionOutcome {
                    stop_reason: ExecutionStopReason::WaitingHuman(PendingHumanInput {
                        node_id: node.node_id.clone(),
                        node_alias: node.alias.clone(),
                        prompt,
                    }),
                    variable_pool: variable_pool.clone(),
                    checkpoint_snapshot: Some(CheckpointSnapshot {
                        next_node_index: index + 1,
                        variable_pool,
                    }),
                    node_traces,
                });
            }
            "tool" | "http_request" => {
                node_traces.push(NodeExecutionTrace {
                    node_id: node.node_id.clone(),
                    node_type: node.node_type.clone(),
                    node_alias: node.alias.clone(),
                    input_payload: Value::Object(resolved_inputs.clone()),
                    output_payload: json!({}),
                    error_payload: None,
                    metrics_payload: json!({ "preview_mode": true, "waiting": node.node_type }),
                    provider_events: Vec::new(),
                });
                return Ok(FlowDebugExecutionOutcome {
                    stop_reason: ExecutionStopReason::WaitingCallback(PendingCallbackTask {
                        node_id: node.node_id.clone(),
                        node_alias: node.alias.clone(),
                        callback_kind: node.node_type.clone(),
                        request_payload: Value::Object(resolved_inputs),
                    }),
                    variable_pool: variable_pool.clone(),
                    checkpoint_snapshot: Some(CheckpointSnapshot {
                        next_node_index: index + 1,
                        variable_pool,
                    }),
                    node_traces,
                });
            }
            other => return Err(anyhow!("unsupported debug node type: {other}")),
        }
    }

    Ok(FlowDebugExecutionOutcome {
        stop_reason: ExecutionStopReason::Completed,
        variable_pool,
        checkpoint_snapshot: None,
        node_traces,
    })
}

pub async fn execute_llm_node<I>(
    node: &CompiledNode,
    resolved_inputs: &Map<String, Value>,
    rendered_templates: &Map<String, Value>,
    invoker: &I,
) -> Result<LlmNodeExecution>
where
    I: ProviderInvoker + ?Sized,
{
    let runtime = node.llm_runtime.as_ref().ok_or_else(|| {
        anyhow!(
            "compiled llm node is missing runtime metadata: {}",
            node.node_id
        )
    })?;
    let attempt_runtimes = llm_attempt_runtimes(runtime);
    let failover_enabled = runtime
        .routing
        .as_ref()
        .is_some_and(|routing| routing.routing_mode == LlmRoutingMode::FailoverQueue);
    let mut attempt_metrics = Vec::new();
    let mut failed_attempts = Vec::new();

    for (attempt_index, attempt_runtime) in attempt_runtimes.iter().enumerate() {
        let invocation_input = build_provider_invocation_input(
            node,
            attempt_runtime,
            resolved_inputs,
            rendered_templates,
        );
        if invocation_input.messages.is_empty() {
            let error_payload = build_empty_prompt_messages_error_payload(attempt_runtime);
            let attempt = build_attempt_metric(
                attempt_index,
                attempt_runtime,
                "failed",
                false,
                Some(&error_payload),
                &ProviderUsage::default(),
                0,
            );
            attempt_metrics.push(attempt);

            return Ok(LlmNodeExecution {
                output_payload: build_failed_llm_output_payload(
                    node,
                    attempt_runtime,
                    &error_payload,
                ),
                error_payload: Some(error_payload),
                metrics_payload: build_llm_metrics_payload(
                    attempt_runtime,
                    ProviderUsage::default(),
                    Some(ProviderFinishReason::Error),
                    0,
                    attempt_metrics,
                ),
                provider_events: Vec::new(),
            });
        }
        let output = match invoker.invoke_llm(attempt_runtime, invocation_input).await {
            Ok(output) => output,
            Err(error) => {
                let provider_error = provider_runtime_error_from_anyhow(&error);
                let error_payload = build_provider_error_payload(attempt_runtime, &provider_error);
                let attempt = build_attempt_metric(
                    attempt_index,
                    attempt_runtime,
                    "failed",
                    false,
                    Some(&error_payload),
                    &ProviderUsage::default(),
                    0,
                );
                attempt_metrics.push(attempt.clone());
                failed_attempts.push(attempt);
                if failover_enabled && attempt_index + 1 < attempt_runtimes.len() {
                    continue;
                }

                return Ok(LlmNodeExecution {
                    output_payload: build_failed_llm_output_payload(
                        node,
                        attempt_runtime,
                        &error_payload,
                    ),
                    error_payload: Some(error_payload),
                    metrics_payload: build_llm_metrics_payload(
                        attempt_runtime,
                        ProviderUsage::default(),
                        Some(ProviderFinishReason::Error),
                        0,
                        attempt_metrics,
                    ),
                    provider_events: Vec::new(),
                });
            }
        };

        let usage = collect_usage(&output.events, &output.result.usage);
        let finish_reason = output
            .result
            .finish_reason
            .clone()
            .or_else(|| finish_reason_from_events(&output.events));
        let final_content = output
            .result
            .final_content
            .clone()
            .or_else(|| collect_text_deltas(&output.events));
        let provider_error = first_provider_error(&output.events).cloned().or_else(|| {
            matches!(finish_reason, Some(ProviderFinishReason::Error)).then(|| {
                ProviderRuntimeError::normalize(
                    "invoke",
                    "provider invocation finished with error",
                    None,
                )
            })
        });
        let failed_after_first_token =
            provider_error.is_some() && text_delta_seen_before_error(&output.events);
        let error_payload = provider_error
            .as_ref()
            .map(|error| build_provider_error_payload(attempt_runtime, error));
        let attempt_status = if error_payload.is_some() {
            "failed"
        } else {
            "succeeded"
        };
        let attempt = build_attempt_metric(
            attempt_index,
            attempt_runtime,
            attempt_status,
            failed_after_first_token,
            error_payload.as_ref(),
            &usage,
            output.events.len(),
        );
        attempt_metrics.push(attempt.clone());

        if let Some(error_payload) = &error_payload {
            failed_attempts.push(attempt);
            if failover_enabled
                && !failed_after_first_token
                && attempt_index + 1 < attempt_runtimes.len()
            {
                continue;
            }
            let mut output_payload = build_llm_output_payload(
                node,
                attempt_runtime,
                &output.result,
                &usage,
                final_content,
                finish_reason.clone(),
            );
            append_llm_error_to_output(&mut output_payload, error_payload);
            return Ok(LlmNodeExecution {
                output_payload,
                error_payload: Some(error_payload.clone()),
                metrics_payload: build_llm_metrics_payload(
                    attempt_runtime,
                    usage,
                    finish_reason,
                    output.events.len(),
                    attempt_metrics,
                ),
                provider_events: output.events,
            });
        }

        return Ok(LlmNodeExecution {
            output_payload: build_llm_output_payload(
                node,
                attempt_runtime,
                &output.result,
                &usage,
                final_content,
                finish_reason.clone(),
            ),
            error_payload: None,
            metrics_payload: build_llm_metrics_payload(
                attempt_runtime,
                usage,
                finish_reason,
                output.events.len(),
                attempt_metrics,
            ),
            provider_events: output.events,
        });
    }

    let error_payload = json!({
        "error_kind": "provider_unavailable",
        "message": "all failover queue attempts failed",
        "attempts": failed_attempts,
    });
    Ok(LlmNodeExecution {
        output_payload: build_failed_llm_output_payload(node, runtime, &error_payload),
        error_payload: Some(error_payload),
        metrics_payload: build_llm_metrics_payload(
            runtime,
            ProviderUsage::default(),
            Some(ProviderFinishReason::Error),
            0,
            attempt_metrics,
        ),
        provider_events: Vec::new(),
    })
}

pub async fn execute_capability_plugin_node<I>(
    node: &CompiledNode,
    resolved_inputs: &Map<String, Value>,
    _rendered_templates: &Map<String, Value>,
    invoker: &I,
) -> Result<CapabilityNodeExecution>
where
    I: CapabilityInvoker + ?Sized,
{
    let runtime = node.plugin_runtime.as_ref().ok_or_else(|| {
        anyhow!(
            "compiled plugin node is missing runtime metadata: {}",
            node.node_id
        )
    })?;
    let config_payload = node.config.clone();
    let input_payload = Value::Object(resolved_inputs.clone());

    match invoker
        .invoke_capability_node(runtime, config_payload, input_payload)
        .await
    {
        Ok(output) => Ok(CapabilityNodeExecution {
            output_payload: output.output_payload,
            error_payload: None,
            metrics_payload: json!({
                "plugin_id": runtime.plugin_id,
                "plugin_version": runtime.plugin_version,
                "contribution_code": runtime.contribution_code,
                "node_shell": runtime.node_shell,
                "schema_version": runtime.schema_version,
            }),
        }),
        Err(error) => Ok(CapabilityNodeExecution {
            output_payload: json!({ first_output_key(node): Value::Null }),
            error_payload: Some(json!({
                "message": error.to_string(),
            })),
            metrics_payload: json!({
                "plugin_id": runtime.plugin_id,
                "plugin_version": runtime.plugin_version,
                "contribution_code": runtime.contribution_code,
                "node_shell": runtime.node_shell,
                "schema_version": runtime.schema_version,
                "error": true,
            }),
        }),
    }
}

fn llm_attempt_runtimes(runtime: &CompiledLlmRuntime) -> Vec<CompiledLlmRuntime> {
    let Some(routing) = runtime.routing.as_ref() else {
        return vec![runtime.clone()];
    };
    if routing.routing_mode != LlmRoutingMode::FailoverQueue || routing.queue_targets.is_empty() {
        return vec![runtime.clone()];
    }

    routing
        .queue_targets
        .iter()
        .map(|target| {
            let mut attempt = runtime.clone();
            attempt.provider_instance_id = target.provider_instance_id.clone();
            attempt.provider_code = target.provider_code.clone();
            attempt.protocol = target.protocol.clone();
            attempt.model = target.upstream_model_id.clone();
            attempt
        })
        .collect()
}

fn build_attempt_metric(
    attempt_index: usize,
    runtime: &CompiledLlmRuntime,
    status: &str,
    failed_after_first_token: bool,
    error_payload: Option<&Value>,
    usage: &ProviderUsage,
    event_count: usize,
) -> Value {
    json!({
        "attempt_index": attempt_index,
        "provider_instance_id": runtime.provider_instance_id,
        "provider_code": runtime.provider_code,
        "protocol": runtime.protocol,
        "upstream_model_id": runtime.model,
        "model": runtime.model,
        "status": status,
        "failed_after_first_token": failed_after_first_token,
        "event_count": event_count,
        "usage": serde_json::to_value(usage).unwrap_or(Value::Null),
        "error_code": error_payload
            .and_then(|payload| payload.get("error_kind"))
            .cloned()
            .unwrap_or(Value::Null),
        "error_message_ref": error_payload
            .and_then(|payload| payload.get("message"))
            .and_then(Value::as_str)
            .map(|message| format!("runtime_artifact:inline:error:{message}"))
            .map(Value::String)
            .unwrap_or(Value::Null),
    })
}

fn build_llm_metrics_payload(
    runtime: &CompiledLlmRuntime,
    usage: ProviderUsage,
    finish_reason: Option<ProviderFinishReason>,
    event_count: usize,
    attempts: Vec<Value>,
) -> Value {
    json!({
        "provider_instance_id": runtime.provider_instance_id,
        "provider_code": runtime.provider_code,
        "protocol": runtime.protocol,
        "model": runtime.model,
        "event_count": event_count,
        "usage": serde_json::to_value(&usage).unwrap_or(Value::Null),
        "finish_reason": finish_reason
            .as_ref()
            .map(|reason| serde_json::to_value(reason).unwrap_or(Value::Null))
            .unwrap_or(Value::Null),
        "queue_snapshot_id": runtime
            .routing
            .as_ref()
            .and_then(|routing| routing.queue_snapshot_id.clone())
            .map(Value::String)
            .unwrap_or(Value::Null),
        "attempts": attempts,
    })
}

fn build_provider_invocation_input(
    node: &CompiledNode,
    runtime: &CompiledLlmRuntime,
    resolved_inputs: &Map<String, Value>,
    rendered_templates: &Map<String, Value>,
) -> ProviderInvocationInput {
    let (system, messages) = binding_prompt_messages(rendered_templates, resolved_inputs)
        .map(provider_messages_from_prompt_messages)
        .unwrap_or_else(|| legacy_provider_messages(rendered_templates, resolved_inputs));

    let trace_context = BTreeMap::from([
        ("node_id".to_string(), node.node_id.clone()),
        ("node_alias".to_string(), node.alias.clone()),
    ]);

    ProviderInvocationInput {
        provider_instance_id: runtime.provider_instance_id.clone(),
        provider_code: runtime.provider_code.clone(),
        protocol: runtime.protocol.clone(),
        model: runtime.model.clone(),
        provider_config: Value::Null,
        messages,
        system,
        tools: Vec::new(),
        mcp_bindings: Vec::new(),
        response_format: build_response_format(&node.config),
        model_parameters: build_model_parameters(&node.config),
        trace_context,
        run_context: BTreeMap::from([(
            "resolved_inputs".to_string(),
            Value::Object(resolved_inputs.clone()),
        )]),
    }
}

fn build_empty_prompt_messages_error_payload(runtime: &CompiledLlmRuntime) -> Value {
    json!({
        "provider_instance_id": runtime.provider_instance_id,
        "provider_code": runtime.provider_code,
        "protocol": runtime.protocol,
        "error_kind": "prompt_messages_empty",
        "message": "LLM node requires at least one non-empty user or assistant prompt message",
    })
}

fn legacy_provider_messages(
    rendered_templates: &Map<String, Value>,
    resolved_inputs: &Map<String, Value>,
) -> (Option<String>, Vec<ProviderMessage>) {
    let system = binding_text(rendered_templates, resolved_inputs, "system_prompt");
    let messages = binding_text(rendered_templates, resolved_inputs, "user_prompt")
        .map(|content| {
            vec![ProviderMessage {
                role: ProviderMessageRole::User,
                content,
            }]
        })
        .unwrap_or_default();

    (system, messages)
}

fn build_response_format(config: &Value) -> Option<Value> {
    let response_format = config.get("response_format")?;

    if response_format
        .get("mode")
        .and_then(Value::as_str)
        .is_some_and(|mode| mode == "text")
    {
        return None;
    }

    Some(response_format.clone())
}

fn binding_prompt_messages<'a>(
    rendered_templates: &'a Map<String, Value>,
    resolved_inputs: &'a Map<String, Value>,
) -> Option<&'a [Value]> {
    rendered_templates
        .get("prompt_messages")
        .or_else(|| resolved_inputs.get("prompt_messages"))
        .and_then(Value::as_array)
        .map(Vec::as_slice)
}

fn provider_messages_from_prompt_messages(
    prompt_messages: &[Value],
) -> (Option<String>, Vec<ProviderMessage>) {
    let mut system_parts = Vec::new();
    let mut messages = Vec::new();

    for message in prompt_messages {
        let content = message
            .get("content")
            .and_then(value_to_text)
            .unwrap_or_default();

        if content.trim().is_empty() {
            continue;
        }

        let role = message
            .get("role")
            .and_then(Value::as_str)
            .map(provider_message_role)
            .unwrap_or(ProviderMessageRole::User);

        if role == ProviderMessageRole::System {
            system_parts.push(content);
        } else {
            messages.push(ProviderMessage { role, content });
        }
    }

    let system = (!system_parts.is_empty()).then(|| system_parts.join("\n\n"));

    (system, messages)
}

fn provider_message_role(role: &str) -> ProviderMessageRole {
    match role {
        "system" => ProviderMessageRole::System,
        "assistant" => ProviderMessageRole::Assistant,
        _ => ProviderMessageRole::User,
    }
}

fn binding_text(
    rendered_templates: &Map<String, Value>,
    resolved_inputs: &Map<String, Value>,
    key: &str,
) -> Option<String> {
    rendered_templates
        .get(key)
        .or_else(|| resolved_inputs.get(key))
        .and_then(value_to_text)
}

fn value_to_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => Some(text.clone()),
        other => Some(other.to_string()),
    }
}

fn build_model_parameters(config: &Value) -> BTreeMap<String, Value> {
    if let Some(items) = config
        .get("llm_parameters")
        .and_then(Value::as_object)
        .and_then(|value| value.get("items"))
        .and_then(Value::as_object)
    {
        return items
            .iter()
            .filter_map(|(key, item)| {
                let enabled = item
                    .get("enabled")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                let value = item.get("value").cloned().unwrap_or(Value::Null);
                enabled.then_some((key.clone(), value))
            })
            .collect();
    }

    [
        "temperature",
        "top_p",
        "presence_penalty",
        "frequency_penalty",
        "max_tokens",
        "seed",
    ]
    .into_iter()
    .filter_map(|key| {
        config
            .get(key)
            .cloned()
            .map(|value| (key.to_string(), value))
    })
    .collect()
}

fn first_output_key(node: &CompiledNode) -> String {
    node.outputs
        .first()
        .map(|output| output.key.clone())
        .unwrap_or_else(|| "result".to_string())
}

fn build_failed_llm_output_payload(
    node: &CompiledNode,
    runtime: &CompiledLlmRuntime,
    error_payload: &Value,
) -> Value {
    let mut output = standard_llm_output_payload(
        node,
        runtime,
        "",
        Value::Null,
        Vec::new(),
        Value::Null,
        Some(error_payload.clone()),
    );
    if let Some(object) = output.as_object_mut() {
        object.insert(first_output_key(node), Value::Null);
    }
    output
}

fn append_llm_error_to_output(output_payload: &mut Value, error_payload: &Value) {
    if let Some(output) = output_payload.as_object_mut() {
        output.insert("error".to_string(), error_payload.clone());
        return;
    }

    *output_payload = json!({ "error": error_payload });
}

fn build_llm_output_payload(
    node: &CompiledNode,
    runtime: &CompiledLlmRuntime,
    result: &ProviderInvocationResult,
    usage: &ProviderUsage,
    final_content: Option<String>,
    finish_reason: Option<ProviderFinishReason>,
) -> Value {
    let text = final_content.unwrap_or_default();
    let finish_reason = finish_reason
        .map(|reason| serde_json::to_value(reason).unwrap_or(Value::Null))
        .unwrap_or(Value::Null);
    let tool_calls = serde_json::to_value(&result.tool_calls).unwrap_or(Value::Null);
    let text_parts = split_llm_think_tags(&text);
    let mut output = standard_llm_output_payload(
        node,
        runtime,
        &text_parts.text,
        finish_reason,
        result.tool_calls.clone(),
        serde_json::to_value(usage).unwrap_or(Value::Null),
        None,
    );

    if let Some(object) = output.as_object_mut() {
        object.insert("tool_calls".to_string(), tool_calls);
        if let Some(reasoning_content) = text_parts.reasoning_content {
            object.insert(
                "reasoning_content".to_string(),
                Value::String(reasoning_content),
            );
        }
    }
    if !result.mcp_calls.is_empty() {
        output
            .as_object_mut()
            .expect("standard output is object")
            .insert(
                "mcp_calls".to_string(),
                serde_json::to_value(&result.mcp_calls).unwrap_or(Value::Null),
            );
    }
    if !result.provider_metadata.is_null() {
        output
            .as_object_mut()
            .expect("standard output is object")
            .insert(
                "provider_metadata".to_string(),
                result.provider_metadata.clone(),
            );
    }
    output
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LlmTextParts {
    text: String,
    reasoning_content: Option<String>,
}

fn split_llm_think_tags(text: &str) -> LlmTextParts {
    let mut answer = String::new();
    let mut reasoning = String::new();
    let mut remaining = text;

    while let Some(start) = remaining.find("<think>") {
        answer.push_str(&remaining[..start]);
        let after_start = &remaining[start + "<think>".len()..];
        if let Some(end) = after_start.find("</think>") {
            reasoning.push_str(&after_start[..end]);
            remaining = &after_start[end + "</think>".len()..];
        } else {
            reasoning.push_str(after_start);
            remaining = "";
            break;
        }
    }
    answer.push_str(remaining);

    LlmTextParts {
        text: answer,
        reasoning_content: (!reasoning.is_empty()).then_some(reasoning),
    }
}

fn standard_llm_output_payload(
    node: &CompiledNode,
    runtime: &CompiledLlmRuntime,
    text: &str,
    finish_reason: Value,
    tool_calls: Vec<plugin_framework::provider_contract::ProviderToolCall>,
    usage: Value,
    error: Option<Value>,
) -> Value {
    let attempt_id = format!("pending_attempt_id:{}", node.node_id);
    let route = match runtime.routing.as_ref() {
        Some(routing) => json!({
            "routing_mode": routing.routing_mode,
            "fixed_model_target": routing.fixed_model_target,
            "queue_template_id": routing.queue_template_id,
            "provider_instance_id": runtime.provider_instance_id,
            "provider_code": runtime.provider_code,
            "upstream_model_id": runtime.model,
            "protocol": runtime.protocol,
        }),
        None => json!({
            "routing_mode": "fixed_model",
            "provider_instance_id": runtime.provider_instance_id,
            "provider_code": runtime.provider_code,
            "upstream_model_id": runtime.model,
            "protocol": runtime.protocol,
        }),
    };

    let mut output = Map::new();
    output.insert(first_output_key(node), Value::String(text.to_string()));
    output.insert("text".to_string(), Value::String(text.to_string()));
    output.insert(
        "message".to_string(),
        json!({
            "role": "assistant",
            "content": text,
        }),
    );
    output.insert(
        "tool_calls".to_string(),
        serde_json::to_value(tool_calls).unwrap_or(Value::Null),
    );
    output.insert("finish_reason".to_string(), finish_reason);
    output.insert("route".to_string(), route);
    output.insert("usage".to_string(), usage);
    output.insert("error".to_string(), error.unwrap_or(Value::Null));
    output.insert("__raw_response_ref".to_string(), Value::Null);
    output.insert(
        "__context_projection_id".to_string(),
        Value::String(format!("pending_projection_id:{}", node.node_id)),
    );
    output.insert(
        "__attempt_ids".to_string(),
        Value::Array(vec![Value::String(attempt_id.clone())]),
    );
    output.insert("__winner_attempt_id".to_string(), Value::String(attempt_id));
    Value::Object(output)
}

fn collect_text_deltas(events: &[ProviderStreamEvent]) -> Option<String> {
    let mut content = String::new();
    for event in events {
        if let ProviderStreamEvent::TextDelta { delta } = event {
            content.push_str(delta);
        }
    }
    (!content.is_empty()).then_some(content)
}

fn collect_usage(events: &[ProviderStreamEvent], result_usage: &ProviderUsage) -> ProviderUsage {
    let mut usage = result_usage.clone();
    for event in events {
        match event {
            ProviderStreamEvent::UsageSnapshot { usage: snapshot } => {
                usage = snapshot.clone();
            }
            ProviderStreamEvent::UsageDelta { usage: delta } => {
                apply_usage_delta(&mut usage, delta)
            }
            _ => {}
        }
    }
    usage
}

fn apply_usage_delta(target: &mut ProviderUsage, delta: &ProviderUsage) {
    add_usage_value(&mut target.input_tokens, delta.input_tokens);
    add_usage_value(&mut target.output_tokens, delta.output_tokens);
    add_usage_value(&mut target.reasoning_tokens, delta.reasoning_tokens);
    add_usage_value(&mut target.cache_read_tokens, delta.cache_read_tokens);
    add_usage_value(&mut target.cache_write_tokens, delta.cache_write_tokens);
    add_usage_value(&mut target.total_tokens, delta.total_tokens);
}

fn add_usage_value(target: &mut Option<u64>, delta: Option<u64>) {
    if let Some(delta) = delta {
        *target = Some(target.unwrap_or_default() + delta);
    }
}

fn finish_reason_from_events(events: &[ProviderStreamEvent]) -> Option<ProviderFinishReason> {
    events.iter().rev().find_map(|event| match event {
        ProviderStreamEvent::Finish { reason } => Some(reason.clone()),
        _ => None,
    })
}

fn first_provider_error(events: &[ProviderStreamEvent]) -> Option<&ProviderRuntimeError> {
    events.iter().find_map(|event| match event {
        ProviderStreamEvent::Error { error } => Some(error),
        _ => None,
    })
}

fn text_delta_seen_before_error(events: &[ProviderStreamEvent]) -> bool {
    let mut saw_text_delta = false;
    for event in events {
        match event {
            ProviderStreamEvent::TextDelta { .. } => saw_text_delta = true,
            ProviderStreamEvent::Error { .. } => return saw_text_delta,
            _ => {}
        }
    }
    false
}

fn build_provider_error_payload(
    runtime: &CompiledLlmRuntime,
    error: &ProviderRuntimeError,
) -> Value {
    json!({
        "provider_instance_id": runtime.provider_instance_id,
        "provider_code": runtime.provider_code,
        "protocol": runtime.protocol,
        "error_kind": serde_json::to_value(error.kind).unwrap_or(Value::Null),
        "message": sanitize_diagnostic_text(&error.message),
        "provider_summary": error
            .provider_summary
            .as_deref()
            .map(sanitize_diagnostic_text),
    })
}

fn provider_runtime_error_from_anyhow(error: &anyhow::Error) -> ProviderRuntimeError {
    if let Some(PluginFrameworkError::RuntimeContract { error }) =
        error.downcast_ref::<PluginFrameworkError>()
    {
        return normalize_runtime_contract_error(error);
    }

    ProviderRuntimeError::normalize("invoke", error.to_string(), None)
}

fn normalize_runtime_contract_error(error: &ProviderRuntimeError) -> ProviderRuntimeError {
    if error.kind != ProviderRuntimeErrorKind::ProviderInvalidResponse {
        return error.clone();
    }

    let normalized = ProviderRuntimeError::normalize(
        "invoke",
        &error.message,
        error.provider_summary.as_deref(),
    );
    if normalized.kind == ProviderRuntimeErrorKind::ProviderInvalidResponse {
        error.clone()
    } else {
        normalized
    }
}

fn sanitize_diagnostic_text(text: &str) -> String {
    let mut sanitized = text.to_string();
    for marker in [
        "bearer ",
        "authorization:",
        "\"authorization\":\"",
        "api_key=",
        "api_key:",
        "\"api_key\":\"",
        "token=",
        "secret=",
        "\"secret\":\"",
    ] {
        sanitized = redact_marker_value(&sanitized, marker);
    }
    sanitized = redact_prefixed_token(&sanitized, "sk-");
    let sanitized = sanitized.trim();
    if sanitized.chars().count() <= 240 {
        sanitized.to_string()
    } else {
        format!("{}...", sanitized.chars().take(240).collect::<String>())
    }
}

fn redact_marker_value(text: &str, marker: &str) -> String {
    let haystack = text.to_ascii_lowercase();
    let needle = marker.to_ascii_lowercase();
    let mut result = String::with_capacity(text.len());
    let mut cursor = 0;

    while let Some(offset) = haystack[cursor..].find(&needle) {
        let start = cursor + offset;
        let value_start = start + marker.len();
        result.push_str(&text[cursor..value_start]);
        let mut value_end = value_start;
        for ch in text[value_start..].chars() {
            if ch.is_whitespace() || matches!(ch, '"' | '\'' | ',' | '}' | ']' | '\n' | '\r') {
                break;
            }
            value_end += ch.len_utf8();
        }
        if value_end > value_start {
            result.push_str("[REDACTED]");
        }
        cursor = value_end;
    }

    result.push_str(&text[cursor..]);
    result
}

fn redact_prefixed_token(text: &str, prefix: &str) -> String {
    let haystack = text.to_ascii_lowercase();
    let needle = prefix.to_ascii_lowercase();
    let mut result = String::with_capacity(text.len());
    let mut cursor = 0;

    while let Some(offset) = haystack[cursor..].find(&needle) {
        let start = cursor + offset;
        result.push_str(&text[cursor..start]);
        result.push_str(prefix);
        result.push_str("[REDACTED]");
        let mut token_end = start + prefix.len();
        for ch in text[token_end..].chars() {
            if !(ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.')) {
                break;
            }
            token_end += ch.len_utf8();
        }
        cursor = token_end;
    }

    result.push_str(&text[cursor..]);
    result
}
