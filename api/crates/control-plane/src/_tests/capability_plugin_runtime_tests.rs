use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use control_plane::capability_plugin_runtime::{
    CapabilityExecutionOutput, CapabilityPluginRuntimePort, ExecuteCapabilityNodeInput,
    ResolveCapabilityOptionsInput, ResolveCapabilityOutputSchemaInput,
    ValidateCapabilityConfigInput,
};
use domain::{
    PluginArtifactStatus, PluginAvailabilityStatus, PluginDesiredState, PluginRuntimeStatus,
};
use domain::{PluginInstallationRecord, PluginVerificationStatus};
use serde_json::{json, Value};
use time::OffsetDateTime;
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
    let installation = PluginInstallationRecord {
        id: installation_id,
        provider_code: "fixture_provider".to_string(),
        plugin_id: "fixture_capability@0.1.0".to_string(),
        plugin_version: "0.1.0".to_string(),
        contract_version: "1flowbase.capability/v1".to_string(),
        protocol: "stdio_json".to_string(),
        display_name: "Fixture Capability".to_string(),
        source_kind: "uploaded".to_string(),
        trust_level: "unverified".to_string(),
        verification_status: PluginVerificationStatus::Valid,
        desired_state: PluginDesiredState::ActiveRequested,
        artifact_status: PluginArtifactStatus::Ready,
        runtime_status: PluginRuntimeStatus::Inactive,
        availability_status: PluginAvailabilityStatus::InstallIncomplete,
        package_path: None,
        installed_path: "/tmp/fixture-capability".to_string(),
        checksum: None,
        manifest_fingerprint: None,
        signature_status: None,
        signature_algorithm: None,
        signing_key_id: None,
        last_load_error: None,
        metadata_json: json!({}),
        created_by: Uuid::now_v7(),
        created_at: OffsetDateTime::now_utc(),
        updated_at: OffsetDateTime::now_utc(),
    };

    let result = runtime
        .execute_node(ExecuteCapabilityNodeInput {
            installation: installation.clone(),
            contribution_code: "openai_prompt".into(),
            config_payload: json!({ "prompt": "hello" }),
            input_payload: json!({ "query": "hi" }),
        })
        .await
        .unwrap();

    assert_eq!(result.output_payload["answer"], "hi");
    let captured = runtime.captured_execute.lock().unwrap().clone().unwrap();
    assert_eq!(captured.installation.id, installation_id);
    assert_eq!(captured.contribution_code, "openai_prompt");
}
