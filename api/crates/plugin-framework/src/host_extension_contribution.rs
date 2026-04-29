use serde::Deserialize;

use crate::error::{FrameworkResult, PluginFrameworkError};

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
pub struct HostExtensionRouteActionManifest {
    pub resource: String,
    pub action: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionRouteManifest {
    pub route_id: String,
    pub method: String,
    pub path: String,
    pub action: HostExtensionRouteActionManifest,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionWorkerManifest {
    pub worker_id: String,
    pub queue: String,
    pub handler: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionMigrationManifest {
    pub id: String,
    pub path: String,
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
    pub routes: Vec<HostExtensionRouteManifest>,
    pub workers: Vec<HostExtensionWorkerManifest>,
    pub migrations: Vec<HostExtensionMigrationManifest>,
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
        validate_non_empty(&provider.contract, "infrastructure_providers[].contract")?;
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
    for route in &manifest.routes {
        validate_non_empty(&route.route_id, "routes[].route_id")?;
        validate_route_method(&route.method)?;
        if !is_controlled_host_route_path(&route.path) {
            return Err(PluginFrameworkError::invalid_provider_package(
                "routes[].path must start with /api/system/ or /api/callbacks/",
            ));
        }
        validate_non_empty(&route.action.resource, "routes[].action.resource")?;
        validate_non_empty(&route.action.action, "routes[].action.action")?;
    }
    for worker in &manifest.workers {
        validate_non_empty(&worker.worker_id, "workers[].worker_id")?;
        if !is_extension_owned_id(&manifest.extension_id, &worker.worker_id) {
            return Err(PluginFrameworkError::invalid_provider_package(
                "workers[].worker_id must equal extension_id or start with <extension_id>.",
            ));
        }
        validate_non_empty(&worker.queue, "workers[].queue")?;
        validate_non_empty(&worker.handler, "workers[].handler")?;
    }
    for migration in &manifest.migrations {
        validate_non_empty(&migration.id, "migrations[].id")?;
        if !migration.path.starts_with("migrations/postgres/") || !migration.path.ends_with(".sql")
        {
            return Err(PluginFrameworkError::invalid_provider_package(
                "migrations[].path must start with migrations/postgres/ and end with .sql",
            ));
        }
    }

    Ok(())
}

fn validate_route_method(method: &str) -> FrameworkResult<()> {
    match method {
        "GET" | "POST" | "PUT" | "PATCH" | "DELETE" => Ok(()),
        _ => Err(PluginFrameworkError::invalid_provider_package(
            "routes[].method must be GET, POST, PUT, PATCH, or DELETE",
        )),
    }
}

fn is_controlled_host_route_path(path: &str) -> bool {
    path.starts_with("/api/system/") || path.starts_with("/api/callbacks/")
}

fn is_extension_owned_id(extension_id: &str, candidate: &str) -> bool {
    candidate == extension_id
        || candidate
            .strip_prefix(extension_id)
            .is_some_and(|suffix| suffix.starts_with('.'))
}

fn validate_non_empty(value: &str, field: &str) -> FrameworkResult<()> {
    if value.trim().is_empty() {
        return Err(PluginFrameworkError::invalid_provider_package(format!(
            "{field} must not be empty"
        )));
    }
    Ok(())
}
