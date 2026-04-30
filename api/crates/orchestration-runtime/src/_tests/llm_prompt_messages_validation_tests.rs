use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use anyhow::Result;
use async_trait::async_trait;
use plugin_framework::provider_contract::{
    ProviderFinishReason, ProviderInvocationInput, ProviderInvocationResult, ProviderStreamEvent,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    compiled_plan::{
        CompiledBinding, CompiledLlmRuntime, CompiledNode, CompiledOutput, CompiledPlan,
    },
    execution_engine::{
        start_flow_debug_run, CapabilityInvocationOutput, CapabilityInvoker,
        ProviderInvocationOutput, ProviderInvoker,
    },
    execution_state::ExecutionStopReason,
};

struct CapturingProviderInvoker {
    captured_input: Arc<Mutex<Option<ProviderInvocationInput>>>,
}

#[async_trait]
impl ProviderInvoker for CapturingProviderInvoker {
    async fn invoke_llm(
        &self,
        _runtime: &CompiledLlmRuntime,
        input: ProviderInvocationInput,
    ) -> Result<ProviderInvocationOutput> {
        *self
            .captured_input
            .lock()
            .expect("captured input mutex poisoned") = Some(input);

        Ok(ProviderInvocationOutput {
            events: vec![
                ProviderStreamEvent::TextDelta {
                    delta: "ok".to_string(),
                },
                ProviderStreamEvent::Finish {
                    reason: ProviderFinishReason::Stop,
                },
            ],
            result: ProviderInvocationResult {
                final_content: Some("ok".to_string()),
                finish_reason: Some(ProviderFinishReason::Stop),
                ..ProviderInvocationResult::default()
            },
        })
    }
}

#[async_trait]
impl CapabilityInvoker for CapturingProviderInvoker {
    async fn invoke_capability_node(
        &self,
        _runtime: &crate::compiled_plan::CompiledPluginRuntime,
        _config_payload: serde_json::Value,
        input_payload: serde_json::Value,
    ) -> Result<CapabilityInvocationOutput> {
        Ok(CapabilityInvocationOutput {
            output_payload: input_payload,
        })
    }
}

fn plan_with_empty_prompt_messages_and_legacy_user_prompt() -> CompiledPlan {
    let mut nodes = BTreeMap::new();
    nodes.insert(
        "node-start".to_string(),
        CompiledNode {
            node_id: "node-start".to_string(),
            node_type: "start".to_string(),
            alias: "Start".to_string(),
            container_id: None,
            dependency_node_ids: vec![],
            downstream_node_ids: vec!["node-llm".to_string()],
            bindings: BTreeMap::new(),
            outputs: vec![CompiledOutput {
                key: "query".to_string(),
                title: "用户输入".to_string(),
                value_type: "string".to_string(),
            }],
            config: json!({}),
            plugin_runtime: None,
            llm_runtime: None,
        },
    );
    nodes.insert(
        "node-llm".to_string(),
        CompiledNode {
            node_id: "node-llm".to_string(),
            node_type: "llm".to_string(),
            alias: "LLM".to_string(),
            container_id: None,
            dependency_node_ids: vec!["node-start".to_string()],
            downstream_node_ids: vec![],
            bindings: BTreeMap::from([
                (
                    "prompt_messages".to_string(),
                    CompiledBinding {
                        kind: "prompt_messages".to_string(),
                        selector_paths: vec![],
                        raw_value: json!([
                            {
                                "id": "system-1",
                                "role": "system",
                                "content": {
                                    "kind": "templated_text",
                                    "value": ""
                                }
                            },
                            {
                                "id": "user-2",
                                "role": "assistant",
                                "content": {
                                    "kind": "templated_text",
                                    "value": ""
                                }
                            }
                        ]),
                    },
                ),
                (
                    "user_prompt".to_string(),
                    CompiledBinding {
                        kind: "templated_text".to_string(),
                        selector_paths: vec![],
                        raw_value: json!("nihao ?试你好？"),
                    },
                ),
            ]),
            outputs: vec![CompiledOutput {
                key: "text".to_string(),
                title: "模型输出".to_string(),
                value_type: "string".to_string(),
            }],
            config: json!({}),
            plugin_runtime: None,
            llm_runtime: Some(CompiledLlmRuntime {
                provider_instance_id: "provider-ready".to_string(),
                provider_code: "fixture_provider".to_string(),
                protocol: "openai_compatible".to_string(),
                model: "gpt-5.4-mini".to_string(),
                routing: None,
            }),
        },
    );

    CompiledPlan {
        flow_id: Uuid::nil(),
        source_draft_id: "draft-1".to_string(),
        schema_version: "1flowbase.flow/v1".to_string(),
        topological_order: vec!["node-start".to_string(), "node-llm".to_string()],
        nodes,
        compile_issues: Vec::new(),
    }
}

#[tokio::test]
async fn llm_runtime_fails_before_provider_when_prompt_messages_are_empty() {
    let plan = plan_with_empty_prompt_messages_and_legacy_user_prompt();
    let captured_input = Arc::new(Mutex::new(None));
    let invoker = CapturingProviderInvoker {
        captured_input: captured_input.clone(),
    };

    let outcome = start_flow_debug_run(
        &plan,
        &json!({ "node-start": { "query": "hello" } }),
        &invoker,
    )
    .await
    .unwrap();

    assert!(captured_input
        .lock()
        .expect("captured input mutex poisoned")
        .is_none());

    match outcome.stop_reason {
        ExecutionStopReason::Failed(ref failure) => {
            assert_eq!(failure.node_id, "node-llm");
            assert_eq!(
                failure.error_payload["error_kind"],
                json!("prompt_messages_empty")
            );
            assert_eq!(
                outcome.node_traces[1].output_payload["error"]["error_kind"],
                json!("prompt_messages_empty")
            );
        }
        other => panic!("expected failed stop reason, got {other:?}"),
    }
}
