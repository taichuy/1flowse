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
    pub last_validation_status: Option<domain::ModelProviderValidationStatus>,
    pub last_validation_message: Option<String>,
    pub created_by: Uuid,
}

#[derive(Debug, Clone)]
pub struct UpdateModelProviderInstanceInput {
    pub instance_id: Uuid,
    pub workspace_id: Uuid,
    pub display_name: String,
    pub status: domain::ModelProviderInstanceStatus,
    pub config_json: serde_json::Value,
    pub last_validated_at: Option<OffsetDateTime>,
    pub last_validation_status: Option<domain::ModelProviderValidationStatus>,
    pub last_validation_message: Option<String>,
    pub updated_by: Uuid,
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
