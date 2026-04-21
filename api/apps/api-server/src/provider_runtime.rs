use std::sync::Arc;

use async_trait::async_trait;
use control_plane::{
    capability_plugin_runtime::{
        CapabilityExecutionOutput, CapabilityPluginRuntimePort, ExecuteCapabilityNodeInput,
        ResolveCapabilityOptionsInput, ResolveCapabilityOutputSchemaInput,
        ValidateCapabilityConfigInput,
    },
    errors::ControlPlaneError,
    ports::{ProviderRuntimeInvocationOutput, ProviderRuntimePort},
};
use plugin_framework::{
    error::PluginFrameworkError,
    provider_contract::{ProviderInvocationInput, ProviderModelDescriptor},
};
use plugin_runner::{capability_host::CapabilityHost, provider_host::ProviderHost};
use serde_json::Value;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct ApiRuntimeServices {
    provider_host: Arc<RwLock<ProviderHost>>,
    capability_host: Arc<RwLock<CapabilityHost>>,
}

impl ApiRuntimeServices {
    pub fn new(
        provider_host: Arc<RwLock<ProviderHost>>,
        capability_host: Arc<RwLock<CapabilityHost>>,
    ) -> Self {
        Self {
            provider_host,
            capability_host,
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
        self.ensure_loaded(installation).await?;
        let host = self.services.provider_host.read().await;
        host.validate(&installation.plugin_id, provider_config)
            .await
            .map(|output| output.output)
            .map_err(|error| map_framework_error(error, "provider_runtime"))
    }

    async fn list_models(
        &self,
        installation: &domain::PluginInstallationRecord,
        provider_config: Value,
    ) -> anyhow::Result<Vec<ProviderModelDescriptor>> {
        self.ensure_loaded(installation).await?;
        let host = self.services.provider_host.read().await;
        host.list_models(&installation.plugin_id, provider_config)
            .await
            .map(|output| output.models)
            .map_err(|error| map_framework_error(error, "provider_runtime"))
    }

    async fn invoke_stream(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: ProviderInvocationInput,
    ) -> anyhow::Result<ProviderRuntimeInvocationOutput> {
        self.ensure_loaded(installation).await?;
        let host = self.services.provider_host.read().await;
        host.invoke_stream(&installation.plugin_id, input)
            .await
            .map(|output| ProviderRuntimeInvocationOutput {
                events: output.events,
                result: output.result,
            })
            .map_err(|error| map_framework_error(error, "provider_runtime"))
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

impl ApiProviderRuntime {
    async fn ensure_capability_loaded(
        &self,
        installation: &domain::PluginInstallationRecord,
    ) -> anyhow::Result<()> {
        let mut host = self.services.capability_host.write().await;
        host.load(&installation.installed_path)
            .map(|_| ())
            .map_err(|error| map_framework_error(error, "capability_runtime"))
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
        PluginFrameworkError::Io { .. } => {
            ControlPlaneError::UpstreamUnavailable(service_name).into()
        }
        runtime_error @ PluginFrameworkError::RuntimeContract { .. } => runtime_error.into(),
    }
}
