use serde::Deserialize;

use crate::{
    error::{FrameworkResult, PluginFrameworkError},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostExtensionBootstrapPhase {
    PreState,
    Boot,
}

impl HostExtensionBootstrapPhase {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PreState => "pre_state",
            Self::Boot => "boot",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionNativeEntrypointManifest {
    pub abi_version: String,
    pub library: String,
    pub entry_symbol: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostInfrastructureProviderManifest {
    pub contract: String,
    pub provider_code: String,
    pub config_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionContributionManifest {
    pub schema_version: String,
    pub extension_id: String,
    pub version: String,
    pub bootstrap_phase: HostExtensionBootstrapPhase,
    pub native: HostExtensionNativeEntrypointManifest,
    pub owned_resources: Vec<String>,
    pub extends_resources: Vec<String>,
    pub infrastructure_providers: Vec<HostInfrastructureProviderManifest>,
    pub routes: Vec<String>,
    pub workers: Vec<String>,
    pub migrations: Vec<String>,
}

pub fn parse_host_extension_contribution_manifest(
    raw: &str,
) -> FrameworkResult<HostExtensionContributionManifest> {
    let manifest: HostExtensionContributionManifest = serde_yaml::from_str(raw)
        .map_err(|error| PluginFrameworkError::invalid_provider_package(error.to_string()))?;
    validate_host_extension_contribution_manifest(&manifest)?;
    Ok(manifest)
}

fn validate_host_extension_contribution_manifest(
    manifest: &HostExtensionContributionManifest,
) -> FrameworkResult<()> {
    if manifest.schema_version != "1flowbase.host-extension/v1" {
        return Err(PluginFrameworkError::invalid_provider_package(
            "schema_version must be 1flowbase.host-extension/v1",
        ));
    }
    validate_non_empty(&manifest.extension_id, "extension_id")?;
    validate_non_empty(&manifest.version, "version")?;
    if manifest.native.abi_version != "1flowbase.host.native/v1" {
        return Err(PluginFrameworkError::invalid_provider_package(
            "native.abi_version must be 1flowbase.host.native/v1",
        ));
    }
    validate_non_empty(&manifest.native.library, "native.library")?;
    validate_non_empty(&manifest.native.entry_symbol, "native.entry_symbol")?;

    for provider in &manifest.infrastructure_providers {
        validate_non_empty(
            &provider.contract,
            "infrastructure_providers[].contract",
        )?;
        validate_non_empty(
            &provider.provider_code,
            "infrastructure_providers[].provider_code",
        )?;
        if !provider.config_ref.starts_with("secret://system/") {
            return Err(PluginFrameworkError::invalid_provider_package(
                "infrastructure_providers[].config_ref must start with secret://system/",
            ));
        }
    }

    Ok(())
}

fn validate_non_empty(value: &str, field: &str) -> FrameworkResult<()> {
    if value.trim().is_empty() {
        return Err(PluginFrameworkError::invalid_provider_package(format!(
            "{field} must not be empty"
        )));
    }
    Ok(())
}
