use super::*;

#[derive(Debug, Clone)]
pub struct CreateModelProviderInstanceInput {
    pub instance_id: Uuid,
    pub workspace_id: Uuid,
    pub installation_id: Uuid,
    pub provider_code: String,
    pub protocol: String,
    pub display_name: String,
    pub status: domain::ModelProviderInstanceStatus,
    pub config_json: serde_json::Value,
    pub configured_models: Vec<domain::ModelProviderConfiguredModel>,
    pub enabled_model_ids: Vec<String>,
    pub included_in_main: Option<bool>,
    pub created_by: Uuid,
}

#[derive(Debug, Clone)]
pub struct UpdateModelProviderInstanceInput {
    pub instance_id: Uuid,
    pub workspace_id: Uuid,
    pub display_name: String,
    pub status: domain::ModelProviderInstanceStatus,
    pub config_json: serde_json::Value,
    pub configured_models: Vec<domain::ModelProviderConfiguredModel>,
    pub enabled_model_ids: Vec<String>,
    pub included_in_main: bool,
    pub updated_by: Uuid,
}

#[derive(Debug, Clone)]
pub struct CreateModelProviderPreviewSessionInput {
    pub session_id: Uuid,
    pub workspace_id: Uuid,
    pub actor_user_id: Uuid,
    pub installation_id: Option<Uuid>,
    pub instance_id: Option<Uuid>,
    pub config_fingerprint: String,
    pub models_json: serde_json::Value,
    pub expires_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct UpsertModelProviderCatalogCacheInput {
    pub provider_instance_id: Uuid,
    pub model_discovery_mode: domain::ModelProviderDiscoveryMode,
    pub refresh_status: domain::ModelProviderCatalogRefreshStatus,
    pub source: domain::ModelProviderCatalogSource,
    pub models_json: serde_json::Value,
    pub last_error_message: Option<String>,
    pub refreshed_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone)]
pub struct ReassignModelProviderInstancesInput {
    pub workspace_id: Uuid,
    pub provider_code: String,
    pub target_installation_id: Uuid,
    pub target_protocol: String,
    pub updated_by: Uuid,
}

#[derive(Debug, Clone)]
pub struct UpsertModelProviderSecretInput {
    pub provider_instance_id: Uuid,
    pub plaintext_secret_json: serde_json::Value,
    pub secret_version: i32,
    pub master_key: String,
}

#[derive(Debug, Clone)]
pub struct UpsertModelProviderRoutingInput {
    pub workspace_id: Uuid,
    pub provider_code: String,
    pub routing_mode: domain::ModelProviderRoutingMode,
    pub primary_instance_id: Uuid,
    pub updated_by: Uuid,
}

#[derive(Debug, Clone)]
pub struct UpsertModelProviderMainInstanceInput {
    pub workspace_id: Uuid,
    pub provider_code: String,
    pub auto_include_new_instances: bool,
    pub updated_by: Uuid,
}

#[async_trait]
pub trait ModelProviderRepository: Send + Sync {
    async fn create_instance(
        &self,
        input: &CreateModelProviderInstanceInput,
    ) -> anyhow::Result<domain::ModelProviderInstanceRecord>;
    async fn update_instance(
        &self,
        input: &UpdateModelProviderInstanceInput,
    ) -> anyhow::Result<domain::ModelProviderInstanceRecord>;
    async fn get_instance(
        &self,
        workspace_id: Uuid,
        instance_id: Uuid,
    ) -> anyhow::Result<Option<domain::ModelProviderInstanceRecord>>;
    async fn list_instances(
        &self,
        workspace_id: Uuid,
    ) -> anyhow::Result<Vec<domain::ModelProviderInstanceRecord>>;
    async fn list_instances_by_provider_code(
        &self,
        provider_code: &str,
    ) -> anyhow::Result<Vec<domain::ModelProviderInstanceRecord>>;
    async fn reassign_instances_to_installation(
        &self,
        input: &ReassignModelProviderInstancesInput,
    ) -> anyhow::Result<Vec<domain::ModelProviderInstanceRecord>>;
    async fn upsert_catalog_cache(
        &self,
        input: &UpsertModelProviderCatalogCacheInput,
    ) -> anyhow::Result<domain::ModelProviderCatalogCacheRecord>;
    async fn get_catalog_cache(
        &self,
        provider_instance_id: Uuid,
    ) -> anyhow::Result<Option<domain::ModelProviderCatalogCacheRecord>>;
    async fn upsert_secret(
        &self,
        input: &UpsertModelProviderSecretInput,
    ) -> anyhow::Result<domain::ModelProviderSecretRecord>;
    async fn upsert_main_instance(
        &self,
        input: &UpsertModelProviderMainInstanceInput,
    ) -> anyhow::Result<domain::ModelProviderMainInstanceRecord>;
    async fn get_main_instance(
        &self,
        workspace_id: Uuid,
        provider_code: &str,
    ) -> anyhow::Result<Option<domain::ModelProviderMainInstanceRecord>>;
    async fn upsert_routing(
        &self,
        input: &UpsertModelProviderRoutingInput,
    ) -> anyhow::Result<domain::ModelProviderRoutingRecord>;
    async fn get_routing(
        &self,
        workspace_id: Uuid,
        provider_code: &str,
    ) -> anyhow::Result<Option<domain::ModelProviderRoutingRecord>>;
    async fn list_routings(
        &self,
        workspace_id: Uuid,
    ) -> anyhow::Result<Vec<domain::ModelProviderRoutingRecord>>;
    async fn delete_routing(&self, workspace_id: Uuid, provider_code: &str) -> anyhow::Result<()>;
    async fn create_preview_session(
        &self,
        input: &CreateModelProviderPreviewSessionInput,
    ) -> anyhow::Result<domain::ModelProviderPreviewSessionRecord>;
    async fn get_preview_session(
        &self,
        workspace_id: Uuid,
        session_id: Uuid,
    ) -> anyhow::Result<Option<domain::ModelProviderPreviewSessionRecord>>;
    async fn delete_preview_session(
        &self,
        workspace_id: Uuid,
        session_id: Uuid,
    ) -> anyhow::Result<()>;
    async fn get_secret_json(
        &self,
        provider_instance_id: Uuid,
        master_key: &str,
    ) -> anyhow::Result<Option<serde_json::Value>>;
    async fn get_secret_record(
        &self,
        provider_instance_id: Uuid,
    ) -> anyhow::Result<Option<domain::ModelProviderSecretRecord>>;
    async fn delete_instance(&self, workspace_id: Uuid, instance_id: Uuid) -> anyhow::Result<()>;
    async fn count_instance_references(
        &self,
        workspace_id: Uuid,
        instance_id: Uuid,
    ) -> anyhow::Result<u64>;
}
