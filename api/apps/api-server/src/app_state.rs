use std::sync::Arc;

use control_plane::ports::{OfficialPluginSourcePort, SessionStore};
use runtime_core::runtime_engine::RuntimeEngine;
use storage_durable::MainDurableStore;
use time::OffsetDateTime;

use crate::host_infrastructure::HostInfrastructureRegistry;
use crate::openapi_docs::ApiDocsRegistry;
use crate::{
    provider_runtime::ApiRuntimeServices,
    runtime_profile_client::{ApiRuntimeProfilePort, PluginRunnerSystemPort},
};

#[derive(Clone)]
pub struct ApiState {
    pub store: MainDurableStore,
    pub infrastructure: Arc<HostInfrastructureRegistry>,
    pub file_storage_registry: Arc<storage_object::FileStorageDriverRegistry>,
    pub runtime_engine: Arc<RuntimeEngine>,
    pub provider_runtime: Arc<ApiRuntimeServices>,
    pub process_started_at: OffsetDateTime,
    pub api_runtime_profile: Arc<dyn ApiRuntimeProfilePort>,
    pub plugin_runner_system: Arc<dyn PluginRunnerSystemPort>,
    pub official_plugin_source: Arc<dyn OfficialPluginSourcePort>,
    pub provider_install_root: String,
    pub provider_secret_master_key: String,
    pub host_extension_dropin_root: String,
    pub allow_unverified_filesystem_dropins: bool,
    pub allow_uploaded_host_extensions: bool,
    pub session_store: Arc<dyn SessionStore>,
    pub api_docs: Arc<ApiDocsRegistry>,
    pub cookie_name: String,
    pub session_ttl_days: i64,
    pub bootstrap_workspace_name: String,
}
