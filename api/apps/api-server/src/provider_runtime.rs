use std::sync::Arc;

use async_trait::async_trait;
use control_plane::{
    errors::ControlPlaneError,
    ports::{ProviderRuntimeInvocationOutput, ProviderRuntimePort},
};
use plugin_framework::{
    error::PluginFrameworkError,
    provider_contract::{ProviderInvocationInput, ProviderModelDescriptor},
};
use plugin_runner::provider_host::ProviderHost;
use serde_json::Value;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct ApiProviderRuntime {
    host: Arc<RwLock<ProviderHost>>,
}

impl ApiProviderRuntime {
    pub fn new(host: Arc<RwLock<ProviderHost>>) -> Self {
        Self { host }
    }
}

#[async_trait]
impl ProviderRuntimePort for ApiProviderRuntime {
    async fn ensure_loaded(
        &self,
        installation: &domain::PluginInstallationRecord,
    ) -> anyhow::Result<()> {
        let mut host = self.host.write().await;
        match host.reload(&installation.plugin_id) {
            Ok(_) => Ok(()),
            Err(_) => host
                .load(&installation.install_path)
                .map(|_| ())
                .map_err(map_framework_error),
        }
    }

    async fn validate_provider(
        &self,
        installation: &domain::PluginInstallationRecord,
        provider_config: Value,
    ) -> anyhow::Result<Value> {
        self.ensure_loaded(installation).await?;
        let host = self.host.read().await;
        host.validate(&installation.plugin_id, provider_config)
            .await
            .map(|output| output.output)
            .map_err(map_framework_error)
    }

    async fn list_models(
        &self,
        installation: &domain::PluginInstallationRecord,
        provider_config: Value,
    ) -> anyhow::Result<Vec<ProviderModelDescriptor>> {
        self.ensure_loaded(installation).await?;
        let host = self.host.read().await;
        host.list_models(&installation.plugin_id, provider_config)
            .await
            .map(|output| output.models)
            .map_err(map_framework_error)
    }

    async fn invoke_stream(
        &self,
        installation: &domain::PluginInstallationRecord,
        input: ProviderInvocationInput,
    ) -> anyhow::Result<ProviderRuntimeInvocationOutput> {
        self.ensure_loaded(installation).await?;
        let host = self.host.read().await;
        host.invoke_stream(&installation.plugin_id, input)
            .await
            .map(|output| ProviderRuntimeInvocationOutput {
                events: output.events,
                result: output.result,
            })
            .map_err(map_framework_error)
    }
}

fn map_framework_error(error: PluginFrameworkError) -> anyhow::Error {
    match error {
        PluginFrameworkError::InvalidAssignment { .. }
        | PluginFrameworkError::InvalidProviderPackage { .. }
        | PluginFrameworkError::InvalidProviderContract { .. }
        | PluginFrameworkError::Serialization { .. } => {
            ControlPlaneError::InvalidInput("provider_package").into()
        }
        PluginFrameworkError::Io { .. } => {
            ControlPlaneError::UpstreamUnavailable("provider_runtime").into()
        }
        runtime_error @ PluginFrameworkError::RuntimeContract { .. } => runtime_error.into(),
    }
}
