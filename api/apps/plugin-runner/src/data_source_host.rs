use std::collections::HashMap;

use plugin_framework::{
    data_source_contract::{
        DataSourceCatalogEntry, DataSourceConfigInput, DataSourceDescribeResourceInput,
        DataSourceImportSnapshotInput, DataSourceImportSnapshotOutput, DataSourcePreviewReadInput,
        DataSourcePreviewReadOutput, DataSourceResourceDescriptor, DataSourceStdioMethod,
        DataSourceStdioRequest,
    },
    error::{FrameworkResult, PluginFrameworkError},
};
use serde::Serialize;
use serde_json::Value;

use crate::{
    data_source_stdio::call_executable,
    package_loader::{LoadedDataSourcePackage, PackageLoader},
};

#[derive(Debug, Clone, Serialize)]
pub struct LoadedDataSourceSummary {
    pub plugin_id: String,
    pub source_code: String,
    pub plugin_version: String,
    pub execution_mode: String,
}

impl LoadedDataSourceSummary {
    fn from_loaded(loaded: &LoadedDataSourcePackage) -> Self {
        Self {
            plugin_id: loaded.package.identifier(),
            source_code: loaded.package.definition.source_code.clone(),
            plugin_version: loaded.package.manifest.version.clone(),
            execution_mode: loaded.package.manifest.execution_mode.as_str().to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DataSourceValueOutput {
    pub output: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct DataSourceCatalogOutput {
    pub entries: Vec<DataSourceCatalogEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DataSourceDescriptorOutput {
    pub descriptor: DataSourceResourceDescriptor,
}

#[derive(Debug, Default)]
pub struct DataSourceHost {
    loaded_packages: HashMap<String, LoadedDataSourcePackage>,
}

impl DataSourceHost {
    pub fn load(
        &mut self,
        package_root: impl AsRef<std::path::Path>,
    ) -> FrameworkResult<LoadedDataSourceSummary> {
        let loaded = PackageLoader::load_data_source(package_root)?;
        let summary = LoadedDataSourceSummary::from_loaded(&loaded);
        self.loaded_packages
            .insert(summary.plugin_id.clone(), loaded);
        Ok(summary)
    }

    pub fn reload(&mut self, plugin_id: &str) -> FrameworkResult<LoadedDataSourceSummary> {
        let package_root = self.loaded_package(plugin_id)?.package_root.clone();
        let loaded = PackageLoader::load_data_source(&package_root)?;
        let summary = LoadedDataSourceSummary::from_loaded(&loaded);
        self.loaded_packages.remove(plugin_id);
        self.loaded_packages
            .insert(summary.plugin_id.clone(), loaded);
        Ok(summary)
    }

    pub async fn validate_config(
        &self,
        plugin_id: &str,
        input: DataSourceConfigInput,
    ) -> FrameworkResult<DataSourceValueOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let output = self
            .call_runtime(
                loaded,
                DataSourceStdioMethod::ValidateConfig,
                serde_json::to_value(input).unwrap(),
            )
            .await?;
        Ok(DataSourceValueOutput { output })
    }

    pub async fn test_connection(
        &self,
        plugin_id: &str,
        input: DataSourceConfigInput,
    ) -> FrameworkResult<DataSourceValueOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let output = self
            .call_runtime(
                loaded,
                DataSourceStdioMethod::TestConnection,
                serde_json::to_value(input).unwrap(),
            )
            .await?;
        Ok(DataSourceValueOutput { output })
    }

    pub async fn discover_catalog(
        &self,
        plugin_id: &str,
        input: DataSourceConfigInput,
    ) -> FrameworkResult<DataSourceCatalogOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let output = self
            .call_runtime(
                loaded,
                DataSourceStdioMethod::DiscoverCatalog,
                serde_json::to_value(input).unwrap(),
            )
            .await?;
        Ok(DataSourceCatalogOutput {
            entries: normalize_catalog(output)?,
        })
    }

    pub async fn describe_resource(
        &self,
        plugin_id: &str,
        connection: DataSourceConfigInput,
        resource_key: String,
    ) -> FrameworkResult<DataSourceDescriptorOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let output = self
            .call_runtime(
                loaded,
                DataSourceStdioMethod::DescribeResource,
                serde_json::to_value(DataSourceDescribeResourceInput {
                    connection,
                    resource_key,
                })
                .unwrap(),
            )
            .await?;
        Ok(DataSourceDescriptorOutput {
            descriptor: normalize_descriptor(output)?,
        })
    }

    pub async fn preview_read(
        &self,
        plugin_id: &str,
        input: DataSourcePreviewReadInput,
    ) -> FrameworkResult<DataSourcePreviewReadOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let output = self
            .call_runtime(
                loaded,
                DataSourceStdioMethod::PreviewRead,
                serde_json::to_value(input).unwrap(),
            )
            .await?;
        normalize_preview_read(output)
    }

    pub async fn import_snapshot(
        &self,
        plugin_id: &str,
        input: DataSourceImportSnapshotInput,
    ) -> FrameworkResult<DataSourceImportSnapshotOutput> {
        let loaded = self.loaded_package(plugin_id)?;
        let output = self
            .call_runtime(
                loaded,
                DataSourceStdioMethod::ImportSnapshot,
                serde_json::to_value(input).unwrap(),
            )
            .await?;
        normalize_import_snapshot(output)
    }

    fn loaded_package(&self, plugin_id: &str) -> FrameworkResult<&LoadedDataSourcePackage> {
        self.loaded_packages.get(plugin_id).ok_or_else(|| {
            PluginFrameworkError::invalid_provider_package(format!(
                "data source package is not loaded: {plugin_id}"
            ))
        })
    }

    async fn call_runtime(
        &self,
        loaded: &LoadedDataSourcePackage,
        method: DataSourceStdioMethod,
        input: Value,
    ) -> FrameworkResult<Value> {
        let request = DataSourceStdioRequest { method, input };
        call_executable(
            &loaded.runtime_executable,
            &request,
            &loaded.package.manifest.runtime.limits,
        )
        .await
    }
}

fn normalize_catalog(raw: Value) -> FrameworkResult<Vec<DataSourceCatalogEntry>> {
    serde_json::from_value(raw)
        .map_err(|error| PluginFrameworkError::invalid_provider_contract(error.to_string()))
}

fn normalize_descriptor(raw: Value) -> FrameworkResult<DataSourceResourceDescriptor> {
    serde_json::from_value(raw)
        .map_err(|error| PluginFrameworkError::invalid_provider_contract(error.to_string()))
}

fn normalize_preview_read(raw: Value) -> FrameworkResult<DataSourcePreviewReadOutput> {
    serde_json::from_value(raw)
        .map_err(|error| PluginFrameworkError::invalid_provider_contract(error.to_string()))
}

fn normalize_import_snapshot(raw: Value) -> FrameworkResult<DataSourceImportSnapshotOutput> {
    serde_json::from_value(raw)
        .map_err(|error| PluginFrameworkError::invalid_provider_contract(error.to_string()))
}
