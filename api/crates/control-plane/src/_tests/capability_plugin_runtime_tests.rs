use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use control_plane::{
    capability_plugin_runtime::{
        CapabilityExecutionOutput, CapabilityPluginRuntimePort, ExecuteCapabilityNodeInput,
        ResolveCapabilityOptionsInput, ResolveCapabilityOutputSchemaInput,
        ValidateCapabilityConfigInput,
    },
};
use serde_json::{json, Value};
use uuid::Uuid;

struct EchoCapabilityRuntime {
    captured_execute: Arc<Mutex<Option<ExecuteCapabilityNodeInput>>>,
}

#[async_trait]
impl CapabilityPluginRuntimePort for EchoCapabilityRuntime {
    async fn validate_config(&self, input: ValidateCapabilityConfigInput) -> anyhow::Result<Value> {
        Ok(input.config_payload)
    }

    async fn resolve_dynamic_options(
        &self,
        input: ResolveCapabilityOptionsInput,
    ) -> anyhow::Result<Value> {
        Ok(input.config_payload)
    }

    async fn resolve_output_schema(
        &self,
        input: ResolveCapabilityOutputSchemaInput,
    ) -> anyhow::Result<Value> {
        Ok(input.config_payload)
    }

    async fn execute_node(
        &self,
        input: ExecuteCapabilityNodeInput,
    ) -> anyhow::Result<CapabilityExecutionOutput> {
        *self.captured_execute.lock().unwrap() = Some(input.clone());
        Ok(CapabilityExecutionOutput {
            output_payload: json!({
                "answer": input.input_payload["query"],
            }),
        })
    }
}

#[tokio::test]
async fn capability_runtime_port_returns_execute_payload() {
    let runtime = EchoCapabilityRuntime {
        captured_execute: Arc::new(Mutex::new(None)),
    };
    let installation_id = Uuid::now_v7();

    let result = runtime
        .execute_node(ExecuteCapabilityNodeInput {
            installation_id,
            contribution_code: "openai_prompt".into(),
            config_payload: json!({ "prompt": "hello" }),
            input_payload: json!({ "query": "hi" }),
        })
        .await
        .unwrap();

    assert_eq!(result.output_payload["answer"], "hi");
    let captured = runtime.captured_execute.lock().unwrap().clone().unwrap();
    assert_eq!(captured.installation_id, installation_id);
    assert_eq!(captured.contribution_code, "openai_prompt");
}
