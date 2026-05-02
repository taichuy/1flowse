use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::PathBuf,
};

use plugin_framework::{
    error::{FrameworkResult, PluginFrameworkError},
    provider_contract::{
        ModelDiscoveryMode, ProviderInvocationInput, ProviderInvocationResult,
        ProviderModelDescriptor, ProviderStdioMethod, ProviderStdioRequest, ProviderStreamEvent,
    },
};
use serde::Serialize;
use serde_json::Value;

use crate::package_loader::{LoadedProviderPackage, PackageLoader};
use crate::stdio_runtime::{call_executable, call_executable_streaming};

#[derive(Debug, Clone, Serialize)]
pub struct LoadedProviderSummary {
    pub plugin_id: String,
    pub provider_code: String,
    pub plugin_version: String,
    pub protocol: String,
    pub model_discovery_mode: ModelDiscoveryMode,
}

impl LoadedProviderSummary {
    fn from_loaded(loaded: &LoadedProviderPackage) -> Self {
        Self {
            plugin_id: loaded.package.identifier(),
            provider_code: loaded.package.provider.provider_code.clone(),
            plugin_version: loaded.package.manifest.version.clone(),
            protocol: loaded.package.provider.protocol.clone(),
            model_discovery_mode: loaded.package.provider.model_discovery_mode,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LoadedProviderSource {
    package_root: PathBuf,
    source_identity: Option<String>,
}

impl LoadedProviderSource {
    fn resolve(package_root: &str, source_identity: Option<&str>) -> FrameworkResult<Self> {
        let package_root = fs::canonicalize(package_root).map_err(|error| {
            PluginFrameworkError::invalid_provider_package(format!(
                "cannot resolve package root: {error}"
            ))
        })?;
        Ok(Self {
            package_root,
            source_identity: source_identity.map(ToOwned::to_owned),
        })
    }

    fn can_skip_reload(&self, requested: &Self) -> bool {
        self.source_identity.is_some() && self == requested
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderValidationOutput {
    pub output: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderModelsOutput {
    pub models: Vec<ProviderModelDescriptor>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderInvokeStreamOutput {
    pub events: Vec<ProviderStreamEvent>,
    pub result: ProviderInvocationResult,
}

#[derive(Debug, Default)]
pub struct ProviderHost {
    loaded_packages: HashMap<String, LoadedProviderPackage>,
    loaded_sources: HashMap<String, LoadedProviderSource>,
}

impl ProviderHost {
    pub fn load(&mut self, package_root: &str) -> FrameworkResult<LoadedProviderSummary> {
        self.load_with_source_identity(package_root, None)
    }

    fn load_with_source_identity(
        &mut self,
        package_root: &str,
        source_identity: Option<&str>,
    ) -> FrameworkResult<LoadedProviderSummary> {
        let source = LoadedProviderSource::resolve(package_root, source_identity)?;
        self.load_source(source, None)
    }

    fn load_source(
        &mut self,
        source: LoadedProviderSource,
        expected_plugin_id: Option<&str>,
    ) -> FrameworkResult<LoadedProviderSummary> {
        let loaded = PackageLoader::load(&source.package_root)?;
        let summary = LoadedProviderSummary::from_loaded(&loaded);
        if let Some(expected_plugin_id) = expected_plugin_id {
            if summary.plugin_id != expected_plugin_id {
                return Err(PluginFrameworkError::invalid_provider_package(format!(
                    "loaded provider package id {} does not match requested {expected_plugin_id}",
                    summary.plugin_id
                )));
            }
        }
        self.loaded_packages
            .insert(summary.plugin_id.clone(), loaded);
        self.loaded_sources
            .insert(summary.plugin_id.clone(), source);
        Ok(summary)
    }

    pub fn is_loaded(&self, plugin_id: &str) -> bool {
        self.loaded_packages.contains_key(plugin_id)
    }

    pub fn load_if_needed(
        &mut self,
        plugin_id: &str,
        package_root: &str,
        source_identity: Option<&str>,
    ) -> FrameworkResult<()> {
        let requested_source = LoadedProviderSource::resolve(package_root, source_identity)?;
        if self
            .loaded_sources
            .get(plugin_id)
            .is_some_and(|loaded_source| loaded_source.can_skip_reload(&requested_source))
        {
            return Ok(());
        }
        self.load_source(requested_source, Some(plugin_id))
            .map(|_| ())
    }

    pub fn reload(&mut self, plugin_id: &str) -> FrameworkResult<LoadedProviderSummary> {
        let source = match self.loaded_sources.get(plugin_id).cloned() {
            Some(source) => source,
            None => {
                let package_root = self
                    .loaded_packages
                    .get(plugin_id)
                    .ok_or_else(|| {
                        PluginFrameworkError::invalid_provider_package(format!(
                            "provider package is not loaded: {plugin_id}"
                        ))
                    })?
                    .package_root
                    .clone();
                LoadedProviderSource {
                    package_root,
                    source_identity: None,
                }
            }
        };
        if !self.loaded_packages.contains_key(plugin_id) {
            return Err(PluginFrameworkError::invalid_provider_package(format!(
                "provider package is not loaded: {plugin_id}"
            )));
        }
        self.load_source(source, Some(plugin_id))
    }

    pub async fn validate(
        &self,
        plugin_id: &str,
        provider_config: Value,
    ) -> FrameworkResult<ProviderValidationOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let output = self
            .call_runtime(loaded, ProviderStdioMethod::Validate, provider_config)
            .await?;
        Ok(ProviderValidationOutput { output })
    }

    pub async fn list_models(
        &self,
        plugin_id: &str,
        provider_config: Value,
    ) -> FrameworkResult<ProviderModelsOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let models = match loaded.package.provider.model_discovery_mode {
            ModelDiscoveryMode::Static => loaded.package.predefined_models.clone(),
            ModelDiscoveryMode::Dynamic => {
                let dynamic = self
                    .call_runtime(loaded, ProviderStdioMethod::ListModels, provider_config)
                    .await?;
                normalize_models(dynamic)?
            }
            ModelDiscoveryMode::Hybrid => {
                let dynamic = self
                    .call_runtime(loaded, ProviderStdioMethod::ListModels, provider_config)
                    .await?;
                merge_models(
                    &loaded.package.predefined_models,
                    normalize_models(dynamic)?,
                )
            }
        };
        Ok(ProviderModelsOutput { models })
    }

    pub async fn invoke_stream(
        &self,
        plugin_id: &str,
        input: ProviderInvocationInput,
    ) -> FrameworkResult<ProviderInvokeStreamOutput> {
        self.invoke_stream_with_live_events(plugin_id, input, None)
            .await
    }

    pub async fn invoke_stream_with_live_events(
        &self,
        plugin_id: &str,
        input: ProviderInvocationInput,
        live_events: Option<tokio::sync::mpsc::UnboundedSender<ProviderStreamEvent>>,
    ) -> FrameworkResult<ProviderInvokeStreamOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let request = ProviderStdioRequest {
            method: ProviderStdioMethod::Invoke,
            input: serde_json::to_value(input).unwrap(),
        };
        let output = call_executable_streaming(
            &loaded.runtime_executable,
            &request,
            &loaded.package.manifest.runtime.limits,
            live_events,
        )
        .await?;
        Ok(ProviderInvokeStreamOutput {
            events: output.events,
            result: output.result,
        })
    }

    fn loaded_package(&self, plugin_id: &str) -> FrameworkResult<&LoadedProviderPackage> {
        self.loaded_packages.get(plugin_id).ok_or_else(|| {
            PluginFrameworkError::invalid_provider_package(format!(
                "provider package is not loaded: {plugin_id}"
            ))
        })
    }

    async fn call_runtime(
        &self,
        loaded: &LoadedProviderPackage,
        method: ProviderStdioMethod,
        input: Value,
    ) -> FrameworkResult<Value> {
        let request = ProviderStdioRequest { method, input };
        call_executable(
            &loaded.runtime_executable,
            &request,
            &loaded.package.manifest.runtime.limits,
        )
        .await
    }
}

fn normalize_models(raw: Value) -> FrameworkResult<Vec<ProviderModelDescriptor>> {
    serde_json::from_value(raw)
        .map_err(|error| PluginFrameworkError::invalid_provider_contract(error.to_string()))
}

fn merge_models(
    static_models: &[ProviderModelDescriptor],
    dynamic_models: Vec<ProviderModelDescriptor>,
) -> Vec<ProviderModelDescriptor> {
    let mut merged = BTreeMap::new();
    for model in static_models {
        merged.insert(model.model_id.clone(), model.clone());
    }
    for model in dynamic_models {
        merged.insert(model.model_id.clone(), model);
    }
    merged.into_values().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::json;

    struct TempProviderPackage {
        root: PathBuf,
    }

    impl TempProviderPackage {
        fn new() -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let root = std::env::temp_dir().join(format!("provider-host-test-{nonce}"));
            fs::create_dir_all(&root).unwrap();
            let package = Self { root };
            package.write_provider_package("Fixture Provider");
            package
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

        fn write_provider_package(&self, display_name: &str) {
            self.write(
                "manifest.yaml",
                &format!(
                    r#"manifest_version: 1
plugin_id: fixture_provider
version: 0.1.0
vendor: 1flowbase
display_name: {display_name}
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
"#
                ),
            );
            self.write(
                "provider/fixture_provider.yaml",
                r#"provider_code: fixture_provider
display_name: Fixture Provider
protocol: openai_compatible
model_discovery: static
config_schema: []
"#,
            );
            self.write(
                "i18n/en_US.json",
                r#"{ "plugin": { "label": "Fixture Provider" } }"#,
            );
            self.write("bin/fixture_provider", "#!/usr/bin/env bash\n");
        }
    }

    impl Drop for TempProviderPackage {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn normalize_models_accepts_current_provider_descriptor_shape() {
        let models = normalize_models(json!([{
            "model_id": "gpt-4o-mini",
            "display_name": "GPT-4o mini",
            "source": "dynamic",
            "supports_streaming": true,
            "supports_tool_call": false,
            "supports_multimodal": false,
            "context_window": null,
            "max_output_tokens": null,
            "parameter_form": null,
            "provider_metadata": {}
        }]))
        .expect("current provider descriptor shape should stay supported");

        assert_eq!(models.len(), 1);
        assert_eq!(models[0].model_id, "gpt-4o-mini");
    }

    #[test]
    fn normalize_models_rejects_legacy_provider_descriptor_shape() {
        assert!(
            normalize_models(json!([{
                "code": "gpt-4o-mini",
                "label": "GPT-4o mini",
                "family": "llm",
                "mode": "chat"
            }]))
            .is_err(),
            "legacy code/label model descriptors should be rejected once current contract is the only supported shape"
        );
    }

    #[test]
    fn load_if_needed_skips_reloading_matching_loaded_provider_source() {
        let package = TempProviderPackage::new();
        let mut host = ProviderHost::default();
        let summary = host
            .load_with_source_identity(package.path().to_str().unwrap(), Some("gen-1"))
            .unwrap();
        assert!(host.is_loaded(&summary.plugin_id));

        package.write_provider_package("Mutated Provider");
        host.load_if_needed(
            &summary.plugin_id,
            package.path().to_str().unwrap(),
            Some("gen-1"),
        )
        .unwrap();

        let loaded = host.loaded_packages.get(&summary.plugin_id).unwrap();
        assert_eq!(loaded.package.manifest.display_name, "Fixture Provider");
    }

    #[test]
    fn load_if_needed_reloads_when_provider_source_identity_changes() {
        let package = TempProviderPackage::new();
        let mut host = ProviderHost::default();
        let summary = host
            .load_with_source_identity(package.path().to_str().unwrap(), Some("gen-1"))
            .unwrap();
        assert!(host.is_loaded(&summary.plugin_id));

        package.write_provider_package("Mutated Provider");
        host.load_if_needed(
            &summary.plugin_id,
            package.path().to_str().unwrap(),
            Some("gen-2"),
        )
        .unwrap();

        let loaded = host.loaded_packages.get(&summary.plugin_id).unwrap();
        assert_eq!(loaded.package.manifest.display_name, "Mutated Provider");
    }
}
