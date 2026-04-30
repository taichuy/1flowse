use std::sync::Arc;

use async_trait::async_trait;
use control_plane::{
    capability_plugin_runtime::{
        CapabilityExecutionOutput, CapabilityPluginRuntimePort, ExecuteCapabilityNodeInput,
        ResolveCapabilityOptionsInput, ResolveCapabilityOutputSchemaInput,
        ValidateCapabilityConfigInput,
    },
    data_source::{collect_secret_strings, redact_value},
    errors::ControlPlaneError,
    plugin_lifecycle::reconcile_installation_snapshot,
    ports::{
        DataSourceCrudRuntimePort, DataSourceRepository, DataSourceRuntimePort, PluginRepository,
        ProviderRuntimeInvocationOutput, ProviderRuntimePort,
    },
};
use plugin_framework::{
    data_source_contract::{
        DataSourceConfigInput, DataSourceCreateRecordInput, DataSourceCreateRecordOutput,
        DataSourceDeleteRecordInput, DataSourceDeleteRecordOutput, DataSourceDescribeResourceInput,
        DataSourceGetRecordInput, DataSourceGetRecordOutput, DataSourceListRecordsInput,
        DataSourceListRecordsOutput, DataSourcePreviewReadInput, DataSourcePreviewReadOutput,
        DataSourceResourceDescriptor, DataSourceUpdateRecordInput, DataSourceUpdateRecordOutput,
    },
    error::PluginFrameworkError,
    provider_contract::{ProviderInvocationInput, ProviderModelDescriptor},
};
use plugin_runner::{
    capability_host::CapabilityHost, data_source_host::DataSourceHost, provider_host::ProviderHost,
};
use runtime_core::runtime_engine::DataSourceRuntimeRecordBackend;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use storage_durable::MainDurableStore;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct ApiRuntimeServices {
    provider_host: Arc<RwLock<ProviderHost>>,
    capability_host: Arc<RwLock<CapabilityHost>>,
    data_source_host: Arc<RwLock<DataSourceHost>>,
}

impl ApiRuntimeServices {
    pub fn new(
        provider_host: Arc<RwLock<ProviderHost>>,
        capability_host: Arc<RwLock<CapabilityHost>>,
        data_source_host: Arc<RwLock<DataSourceHost>>,
    ) -> Self {
        Self {
            provider_host,
            capability_host,
            data_source_host,
        }
    }
}

#[derive(Clone)]
pub struct ApiProviderRuntime {
    services: Arc<ApiRuntimeServices>,
}

impl ApiProviderRuntime {
    pub fn new(services: Arc<ApiRuntimeServices>) -> Self {
        Self { services }
    }
}

#[derive(Clone)]
pub struct ApiDataSourceRuntimeRecordBackend {
    repository: MainDurableStore,
    runtime: ApiProviderRuntime,
}

impl ApiDataSourceRuntimeRecordBackend {
    pub fn new(repository: MainDurableStore, runtime: ApiProviderRuntime) -> Self {
        Self {
            repository,
            runtime,
        }
    }

    async fn load_target(
        &self,
        workspace_id: Uuid,
        data_source_instance_id: Uuid,
    ) -> anyhow::Result<DataSourceRuntimeTarget> {
        let instance = DataSourceRepository::get_instance(
            &self.repository,
            workspace_id,
            data_source_instance_id,
        )
        .await?
        .ok_or(ControlPlaneError::NotFound("data_source_instance"))?;
        if instance.status != domain::DataSourceInstanceStatus::Ready {
            return Err(ControlPlaneError::Conflict("data_source_instance_not_ready").into());
        }

        let installation =
            reconcile_installation_snapshot(&self.repository, instance.installation_id).await?;
        let assigned = PluginRepository::list_assignments(&self.repository, workspace_id)
            .await?
            .into_iter()
            .any(|assignment| assignment.installation_id == installation.id);
        if !assigned {
            return Err(ControlPlaneError::Conflict("plugin_assignment_required").into());
        }
        if installation.desired_state == domain::PluginDesiredState::Disabled
            || installation.availability_status != domain::PluginAvailabilityStatus::Available
        {
            return Err(ControlPlaneError::Conflict("plugin_installation_unavailable").into());
        }
        if installation.contract_version != "1flowbase.data_source/v1" {
            return Err(ControlPlaneError::InvalidInput("plugin_installation").into());
        }
        if installation.provider_code != instance.source_code {
            return Err(ControlPlaneError::InvalidInput("source_code").into());
        }
        let secret_json = DataSourceRepository::get_secret_json(&self.repository, instance.id)
            .await?
            .unwrap_or_else(|| serde_json::json!({}));
        let secret_values = collect_secret_strings(&secret_json);

        Ok(DataSourceRuntimeTarget {
            installation,
            connection: DataSourceConfigInput {
                config_json: instance.config_json,
                secret_json,
            },
            secret_values,
        })
    }
}

struct DataSourceRuntimeTarget {
    installation: domain::PluginInstallationRecord,
    connection: DataSourceConfigInput,
    secret_values: HashSet<String>,
}

#[async_trait]
impl ProviderRuntimePort for ApiProviderRuntime {
    async fn ensure_loaded(
        &self,
        installation: &domain::PluginInstallationRecord,
    ) -> anyhow::Result<()> {
        let mut host = self.services.provider_host.write().await;
        match host.reload(&installation.plugin_id) {
            Ok(_) => Ok(()),
            Err(_) => host
                .load(&installation.installed_path)
                .map(|_| ())
                .map_err(|error| map_framework_error(error, "provider_runtime")),
        }
    }

    async fn validate_provider(
        &self,
        installation: &domain::PluginInstallationRecord,
        provider_config: Value,
    ) -> anyhow::Result<Value> {
        self.ensure_provider_loaded(installation).await?;
        let host = self.services.provider_host.read().await;
        host.validate(&installation.plugin_id, provider_config)
            .await
            .map(|output| output.output)
            .map_err(map_provider_framework_error)
    }

    async fn list_models(
        &self,
        installation: &domain::PluginInstallationRecord,
        provider_config: Value,
    ) -> anyhow::Result<Vec<ProviderModelDescriptor>> {
        self.ensure_provider_loaded(installation).await?;
        let host = self.services.provider_host.read().await;
        host.list_models(&installation.plugin_id, provider_config)
            .await
            .map(|output| output.models)
            .map_err(map_provider_framework_error)
    }

    async fn invoke_stream(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: ProviderInvocationInput,
    ) -> anyhow::Result<ProviderRuntimeInvocationOutput> {
        self.ensure_provider_loaded(installation).await?;
        let host = self.services.provider_host.read().await;
        host.invoke_stream(&installation.plugin_id, input)
            .await
            .map(|output| ProviderRuntimeInvocationOutput {
                events: output.events,
                result: output.result,
            })
            .map_err(map_provider_framework_error)
    }

    async fn invoke_stream_with_live_events(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: ProviderInvocationInput,
        live_events: Option<
            tokio::sync::mpsc::UnboundedSender<
                plugin_framework::provider_contract::ProviderStreamEvent,
            >,
        >,
    ) -> anyhow::Result<ProviderRuntimeInvocationOutput> {
        self.ensure_provider_loaded(installation).await?;
        let host = self.services.provider_host.read().await;
        host.invoke_stream_with_live_events(&installation.plugin_id, input, live_events)
            .await
            .map(|output| ProviderRuntimeInvocationOutput {
                events: output.events,
                result: output.result,
            })
            .map_err(map_provider_framework_error)
    }
}

#[async_trait]
impl DataSourceRuntimePort for ApiProviderRuntime {
    async fn ensure_loaded(
        &self,
        installation: &domain::PluginInstallationRecord,
    ) -> anyhow::Result<()> {
        let mut host = self.services.data_source_host.write().await;
        match host.reload(&installation.plugin_id) {
            Ok(_) => Ok(()),
            Err(_) => host
                .load(&installation.installed_path)
                .map(|_| ())
                .map_err(|error| map_framework_error(error, "data_source_runtime")),
        }
    }

    async fn validate_config(
        &self,
        installation: &domain::PluginInstallationRecord,
        config_json: Value,
        secret_json: Value,
    ) -> anyhow::Result<Value> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.validate_config(
            &installation.plugin_id,
            DataSourceConfigInput {
                config_json,
                secret_json,
            },
        )
        .await
        .map(|output| output.output)
        .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }

    async fn test_connection(
        &self,
        installation: &domain::PluginInstallationRecord,
        config_json: Value,
        secret_json: Value,
    ) -> anyhow::Result<Value> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.test_connection(
            &installation.plugin_id,
            DataSourceConfigInput {
                config_json,
                secret_json,
            },
        )
        .await
        .map(|output| output.output)
        .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }

    async fn discover_catalog(
        &self,
        installation: &domain::PluginInstallationRecord,
        config_json: Value,
        secret_json: Value,
    ) -> anyhow::Result<Value> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        let output = host
            .discover_catalog(
                &installation.plugin_id,
                DataSourceConfigInput {
                    config_json,
                    secret_json,
                },
            )
            .await
            .map_err(|error| map_framework_error(error, "data_source_runtime"))?;
        Ok(serde_json::to_value(output.entries)?)
    }

    async fn describe_resource(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: DataSourceDescribeResourceInput,
    ) -> anyhow::Result<DataSourceResourceDescriptor> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.describe_resource(
            &installation.plugin_id,
            input.connection,
            input.resource_key,
        )
        .await
        .map(|output| output.descriptor)
        .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }

    async fn preview_read(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: DataSourcePreviewReadInput,
    ) -> anyhow::Result<DataSourcePreviewReadOutput> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.preview_read(&installation.plugin_id, input)
            .await
            .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }
}

#[async_trait]
impl DataSourceCrudRuntimePort for ApiProviderRuntime {
    async fn list_records(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: DataSourceListRecordsInput,
    ) -> anyhow::Result<DataSourceListRecordsOutput> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.list_records(&installation.plugin_id, input)
            .await
            .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }

    async fn get_record(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: DataSourceGetRecordInput,
    ) -> anyhow::Result<DataSourceGetRecordOutput> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.get_record(&installation.plugin_id, input)
            .await
            .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }

    async fn create_record(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: DataSourceCreateRecordInput,
    ) -> anyhow::Result<DataSourceCreateRecordOutput> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.create_record(&installation.plugin_id, input)
            .await
            .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }

    async fn update_record(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: DataSourceUpdateRecordInput,
    ) -> anyhow::Result<DataSourceUpdateRecordOutput> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.update_record(&installation.plugin_id, input)
            .await
            .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }

    async fn delete_record(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: DataSourceDeleteRecordInput,
    ) -> anyhow::Result<DataSourceDeleteRecordOutput> {
        self.ensure_data_source_loaded(installation).await?;
        let host = self.services.data_source_host.read().await;
        host.delete_record(&installation.plugin_id, input)
            .await
            .map_err(|error| map_framework_error(error, "data_source_runtime"))
    }
}

#[async_trait]
impl DataSourceRuntimeRecordBackend for ApiDataSourceRuntimeRecordBackend {
    async fn list_records(
        &self,
        workspace_id: Uuid,
        data_source_instance_id: Uuid,
        mut input: DataSourceListRecordsInput,
    ) -> anyhow::Result<DataSourceListRecordsOutput> {
        let target = self
            .load_target(workspace_id, data_source_instance_id)
            .await?;
        input.connection = target.connection;
        let output =
            DataSourceCrudRuntimePort::list_records(&self.runtime, &target.installation, input)
                .await?;
        redact_data_source_output(output, &target.secret_values)
    }

    async fn get_record(
        &self,
        workspace_id: Uuid,
        data_source_instance_id: Uuid,
        mut input: DataSourceGetRecordInput,
    ) -> anyhow::Result<DataSourceGetRecordOutput> {
        let target = self
            .load_target(workspace_id, data_source_instance_id)
            .await?;
        input.connection = target.connection;
        let output =
            DataSourceCrudRuntimePort::get_record(&self.runtime, &target.installation, input)
                .await?;
        redact_data_source_output(output, &target.secret_values)
    }

    async fn create_record(
        &self,
        workspace_id: Uuid,
        data_source_instance_id: Uuid,
        mut input: DataSourceCreateRecordInput,
    ) -> anyhow::Result<DataSourceCreateRecordOutput> {
        let target = self
            .load_target(workspace_id, data_source_instance_id)
            .await?;
        input.connection = target.connection;
        input.transaction_id = None;
        let output =
            DataSourceCrudRuntimePort::create_record(&self.runtime, &target.installation, input)
                .await?;
        redact_data_source_output(output, &target.secret_values)
    }

    async fn update_record(
        &self,
        workspace_id: Uuid,
        data_source_instance_id: Uuid,
        mut input: DataSourceUpdateRecordInput,
    ) -> anyhow::Result<DataSourceUpdateRecordOutput> {
        let target = self
            .load_target(workspace_id, data_source_instance_id)
            .await?;
        input.connection = target.connection;
        input.transaction_id = None;
        let output =
            DataSourceCrudRuntimePort::update_record(&self.runtime, &target.installation, input)
                .await?;
        redact_data_source_output(output, &target.secret_values)
    }

    async fn delete_record(
        &self,
        workspace_id: Uuid,
        data_source_instance_id: Uuid,
        mut input: DataSourceDeleteRecordInput,
    ) -> anyhow::Result<DataSourceDeleteRecordOutput> {
        let target = self
            .load_target(workspace_id, data_source_instance_id)
            .await?;
        input.connection = target.connection;
        input.transaction_id = None;
        let output =
            DataSourceCrudRuntimePort::delete_record(&self.runtime, &target.installation, input)
                .await?;
        redact_data_source_output(output, &target.secret_values)
    }
}

#[async_trait]
impl CapabilityPluginRuntimePort for ApiProviderRuntime {
    async fn validate_config(&self, input: ValidateCapabilityConfigInput) -> anyhow::Result<Value> {
        self.ensure_capability_loaded(&input.installation).await?;
        let host = self.services.capability_host.read().await;
        host.validate_config(
            &input.installation.plugin_id,
            &input.contribution_code,
            input.config_payload,
        )
        .await
        .map(|output| output.output)
        .map_err(|error| map_framework_error(error, "capability_runtime"))
    }

    async fn resolve_dynamic_options(
        &self,
        input: ResolveCapabilityOptionsInput,
    ) -> anyhow::Result<Value> {
        self.ensure_capability_loaded(&input.installation).await?;
        let host = self.services.capability_host.read().await;
        host.resolve_dynamic_options(
            &input.installation.plugin_id,
            &input.contribution_code,
            input.config_payload,
        )
        .await
        .map(|output| output.output)
        .map_err(|error| map_framework_error(error, "capability_runtime"))
    }

    async fn resolve_output_schema(
        &self,
        input: ResolveCapabilityOutputSchemaInput,
    ) -> anyhow::Result<Value> {
        self.ensure_capability_loaded(&input.installation).await?;
        let host = self.services.capability_host.read().await;
        host.resolve_output_schema(
            &input.installation.plugin_id,
            &input.contribution_code,
            input.config_payload,
        )
        .await
        .map(|output| output.output)
        .map_err(|error| map_framework_error(error, "capability_runtime"))
    }

    async fn execute_node(
        &self,
        input: ExecuteCapabilityNodeInput,
    ) -> anyhow::Result<CapabilityExecutionOutput> {
        self.ensure_capability_loaded(&input.installation).await?;
        let host = self.services.capability_host.read().await;
        host.execute(
            &input.installation.plugin_id,
            &input.contribution_code,
            input.config_payload,
            input.input_payload,
        )
        .await
        .map(|output| CapabilityExecutionOutput {
            output_payload: output.output_payload,
        })
        .map_err(|error| map_framework_error(error, "capability_runtime"))
    }
}

fn redact_data_source_output<T>(output: T, secrets: &HashSet<String>) -> anyhow::Result<T>
where
    T: Serialize + DeserializeOwned,
{
    let value = serde_json::to_value(output)?;
    Ok(serde_json::from_value(redact_value(&value, secrets))?)
}

impl ApiProviderRuntime {
    async fn ensure_provider_loaded(
        &self,
        installation: &domain::PluginInstallationRecord,
    ) -> anyhow::Result<()> {
        let mut host = self.services.provider_host.write().await;
        match host.reload(&installation.plugin_id) {
            Ok(_) => Ok(()),
            Err(_) => host
                .load(&installation.installed_path)
                .map(|_| ())
                .map_err(|error| map_framework_error(error, "provider_runtime")),
        }
    }

    async fn ensure_capability_loaded(
        &self,
        installation: &domain::PluginInstallationRecord,
    ) -> anyhow::Result<()> {
        let mut host = self.services.capability_host.write().await;
        host.load(&installation.installed_path)
            .map(|_| ())
            .map_err(|error| map_framework_error(error, "capability_runtime"))
    }

    async fn ensure_data_source_loaded(
        &self,
        installation: &domain::PluginInstallationRecord,
    ) -> anyhow::Result<()> {
        let mut host = self.services.data_source_host.write().await;
        match host.reload(&installation.plugin_id) {
            Ok(_) => Ok(()),
            Err(_) => host
                .load(&installation.installed_path)
                .map(|_| ())
                .map_err(|error| map_framework_error(error, "data_source_runtime")),
        }
    }
}

fn map_provider_framework_error(error: PluginFrameworkError) -> anyhow::Error {
    match error {
        runtime_error @ PluginFrameworkError::RuntimeContract { .. } => runtime_error.into(),
        other => map_framework_error(other, "provider_runtime"),
    }
}

fn map_framework_error(error: PluginFrameworkError, service_name: &'static str) -> anyhow::Error {
    match error {
        PluginFrameworkError::InvalidAssignment { .. }
        | PluginFrameworkError::InvalidProviderPackage { .. }
        | PluginFrameworkError::InvalidProviderContract { .. }
        | PluginFrameworkError::Serialization { .. } => {
            ControlPlaneError::InvalidInput(service_name).into()
        }
        PluginFrameworkError::Io { .. } | PluginFrameworkError::RuntimeContract { .. } => {
            ControlPlaneError::UpstreamUnavailable(service_name).into()
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
        sync::Arc,
        time::{SystemTime, UNIX_EPOCH},
    };

    use control_plane::ports::ProviderRuntimePort;
    use domain::{
        PluginArtifactStatus, PluginAvailabilityStatus, PluginDesiredState,
        PluginInstallationRecord, PluginRuntimeStatus, PluginVerificationStatus,
    };
    use plugin_framework::{
        error::PluginFrameworkError,
        provider_contract::{ProviderInvocationInput, ProviderRuntimeErrorKind},
    };
    use plugin_runner::{
        capability_host::CapabilityHost, data_source_host::DataSourceHost,
        provider_host::ProviderHost,
    };
    use serde_json::json;
    use time::OffsetDateTime;
    use tokio::sync::RwLock;
    use uuid::Uuid;

    use super::{ApiProviderRuntime, ApiRuntimeServices};

    struct TempProviderPackage {
        root: PathBuf,
    }

    impl TempProviderPackage {
        fn new() -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let root = std::env::temp_dir().join(format!("api-provider-runtime-test-{nonce}"));
            fs::create_dir_all(&root).unwrap();
            Self { root }
        }

        fn path(&self) -> &Path {
            &self.root
        }

        fn write(&self, relative_path: &str, content: &str) {
            let path = self.root.join(relative_path);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(path, content).unwrap();
        }
    }

    impl Drop for TempProviderPackage {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn write_failing_provider_package(package: &TempProviderPackage) {
        package.write(
            "manifest.yaml",
            r#"manifest_version: 1
plugin_id: fixture_provider
version: 0.1.0
vendor: 1flowbase
display_name: Fixture Provider
description: Fixture provider
source_kind: uploaded
trust_level: checksum_only
consumption_kind: runtime_extension
execution_mode: process_per_call
slot_codes:
  - model_provider
binding_targets:
  - workspace
selection_mode: assignment_then_select
minimum_host_version: 0.1.0
contract_version: 1flowbase.provider/v1
schema_version: 1flowbase.plugin.manifest/v1
permissions:
  network: none
  secrets: provider_instance_only
  storage: none
  mcp: none
  subprocess: deny
runtime:
  protocol: stdio_json
  entry: bin/fixture_provider
  limits:
    timeout_ms: 30000
node_contributions: []
"#,
        );
        package.write(
            "provider/fixture_provider.yaml",
            r#"provider_code: fixture_provider
display_name: Fixture Provider
protocol: openai_compatible
model_discovery: static
config_schema:
  - key: base_url
    type: string
    required: true
  - key: api_key
    type: secret
    required: true
"#,
        );
        package.write(
            "i18n/en_US.json",
            r#"{ "plugin": { "label": "Fixture Provider" } }"#,
        );
        package.write(
            "bin/fixture_provider",
            r#"#!/usr/bin/env bash
printf '%s' 'invalid api_key' >&2
exit 1
"#,
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let path = package.path().join("bin/fixture_provider");
            let mut permissions = fs::metadata(&path).unwrap().permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(path, permissions).unwrap();
        }
    }

    fn fixture_installation(package: &TempProviderPackage) -> PluginInstallationRecord {
        let now = OffsetDateTime::now_utc();
        PluginInstallationRecord {
            id: Uuid::now_v7(),
            provider_code: "fixture_provider".to_string(),
            plugin_id: "fixture_provider@0.1.0".to_string(),
            plugin_version: "0.1.0".to_string(),
            contract_version: "1flowbase.provider/v1".to_string(),
            protocol: "openai_compatible".to_string(),
            display_name: "Fixture Provider".to_string(),
            source_kind: "uploaded".to_string(),
            trust_level: "checksum_only".to_string(),
            verification_status: PluginVerificationStatus::Valid,
            desired_state: PluginDesiredState::ActiveRequested,
            artifact_status: PluginArtifactStatus::Ready,
            runtime_status: PluginRuntimeStatus::Active,
            availability_status: PluginAvailabilityStatus::Available,
            package_path: None,
            installed_path: package.path().display().to_string(),
            checksum: None,
            manifest_fingerprint: None,
            signature_status: None,
            signature_algorithm: None,
            signing_key_id: None,
            last_load_error: None,
            metadata_json: json!({}),
            created_by: Uuid::now_v7(),
            created_at: now,
            updated_at: now,
        }
    }

    #[tokio::test]
    async fn provider_runtime_preserves_contract_error_for_llm_invocation() {
        let package = TempProviderPackage::new();
        write_failing_provider_package(&package);
        let runtime = ApiProviderRuntime::new(Arc::new(ApiRuntimeServices::new(
            Arc::new(RwLock::new(ProviderHost::default())),
            Arc::new(RwLock::new(CapabilityHost::default())),
            Arc::new(RwLock::new(DataSourceHost::default())),
        )));

        let error = runtime
            .invoke_stream(
                &fixture_installation(&package),
                ProviderInvocationInput {
                    provider_instance_id: "provider-1".to_string(),
                    provider_code: "fixture_provider".to_string(),
                    protocol: "openai_compatible".to_string(),
                    model: "fixture_chat".to_string(),
                    provider_config: json!({
                        "base_url": "https://api.example.test",
                        "api_key": "bad-key"
                    }),
                    ..ProviderInvocationInput::default()
                },
            )
            .await
            .expect_err("runtime contract errors should propagate to orchestration");

        let framework_error = error
            .downcast_ref::<PluginFrameworkError>()
            .expect("provider runtime error should keep framework error type");
        match framework_error {
            PluginFrameworkError::RuntimeContract { error } => {
                assert_eq!(error.kind, ProviderRuntimeErrorKind::AuthFailed);
                assert_eq!(error.message, "invalid api_key");
            }
            other => panic!("expected runtime contract error, got {other:?}"),
        }
    }
}
