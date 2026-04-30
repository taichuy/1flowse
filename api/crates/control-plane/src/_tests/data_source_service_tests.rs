use std::{collections::HashMap, sync::Arc};

use anyhow::Result;
use async_trait::async_trait;
use plugin_framework::data_source_contract::{
    DataSourceCatalogEntry, DataSourceConfigInput, DataSourcePreviewReadInput,
    DataSourcePreviewReadOutput,
};
use serde_json::{json, Value};
use time::OffsetDateTime;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{
    data_source::{
        CreateDataSourceInstanceCommand, DataSourceService, PreviewDataSourceReadCommand,
        RotateDataSourceSecretCommand, UpdateDataSourceDefaultsCommand,
        ValidateDataSourceInstanceCommand,
    },
    ports::{
        AuthRepository, CreateDataSourceInstanceInput, CreateDataSourcePreviewSessionInput,
        CreatePluginAssignmentInput, CreatePluginTaskInput, DataSourceRepository,
        DataSourceRuntimePort, RotateDataSourceSecretInput, RotateDataSourceSecretOutput,
        UpdateDataSourceDefaultsInput, UpdateDataSourceInstanceConfigInput,
        UpdateDataSourceInstanceStatusInput, UpdatePluginArtifactSnapshotInput,
        UpdatePluginDesiredStateInput, UpdatePluginRuntimeSnapshotInput,
        UpdatePluginTaskStatusInput, UpdateProfileInput, UpsertDataSourceCatalogCacheInput,
        UpsertDataSourceSecretInput, UpsertPluginInstallationInput,
    },
};
use domain::{
    ActorContext, AuditLogRecord, AuthenticatorRecord, DataSourceCatalogCacheRecord,
    DataSourceCatalogRefreshStatus, DataSourceDefaults, DataSourceInstanceRecord,
    DataSourceInstanceStatus, DataSourcePreviewSessionRecord, DataSourceSecretRecord,
    PermissionDefinition, PluginArtifactStatus, PluginAssignmentRecord, PluginAvailabilityStatus,
    PluginDesiredState, PluginInstallationRecord, PluginRuntimeStatus, PluginTaskRecord,
    PluginVerificationStatus, ScopeContext, UserRecord,
};

fn tenant_id() -> Uuid {
    Uuid::from_u128(0x100)
}

fn workspace_id() -> Uuid {
    Uuid::from_u128(0x200)
}

fn user_id() -> Uuid {
    Uuid::from_u128(0x300)
}

fn installation_id() -> Uuid {
    Uuid::from_u128(0x400)
}

fn actor() -> ActorContext {
    ActorContext::root_in_scope(user_id(), tenant_id(), workspace_id(), "root")
}

fn seeded_installation() -> PluginInstallationRecord {
    PluginInstallationRecord {
        id: installation_id(),
        provider_code: "acme_hubspot_source".to_string(),
        plugin_id: "acme_hubspot_source@0.1.0".to_string(),
        plugin_version: "0.1.0".to_string(),
        contract_version: "1flowbase.data_source/v1".to_string(),
        protocol: "stdio_json".to_string(),
        display_name: "Acme HubSpot Source".to_string(),
        source_kind: "uploaded".to_string(),
        trust_level: "unverified".to_string(),
        verification_status: PluginVerificationStatus::Valid,
        desired_state: PluginDesiredState::ActiveRequested,
        artifact_status: PluginArtifactStatus::Ready,
        runtime_status: PluginRuntimeStatus::Active,
        availability_status: PluginAvailabilityStatus::Available,
        package_path: None,
        installed_path: "/tmp/fixture-data-source".to_string(),
        checksum: None,
        manifest_fingerprint: None,
        signature_status: None,
        signature_algorithm: None,
        signing_key_id: None,
        last_load_error: None,
        metadata_json: json!({}),
        created_by: user_id(),
        created_at: OffsetDateTime::now_utc(),
        updated_at: OffsetDateTime::now_utc(),
    }
}

#[derive(Clone)]
struct InMemoryDataSourceRepository {
    actor: ActorContext,
    installations: Arc<RwLock<HashMap<Uuid, PluginInstallationRecord>>>,
    assignments: Arc<RwLock<Vec<PluginAssignmentRecord>>>,
    instances: Arc<RwLock<HashMap<Uuid, DataSourceInstanceRecord>>>,
    secrets: Arc<RwLock<HashMap<Uuid, Value>>>,
    secret_records: Arc<RwLock<HashMap<Uuid, DataSourceSecretRecord>>>,
    caches: Arc<RwLock<HashMap<Uuid, DataSourceCatalogCacheRecord>>>,
    preview_sessions: Arc<RwLock<HashMap<Uuid, DataSourcePreviewSessionRecord>>>,
    audit_logs: Arc<RwLock<Vec<AuditLogRecord>>>,
}

impl Default for InMemoryDataSourceRepository {
    fn default() -> Self {
        let actor = actor();
        let installation = seeded_installation();
        let assignment = PluginAssignmentRecord {
            id: Uuid::now_v7(),
            installation_id: installation.id,
            workspace_id: actor.current_workspace_id,
            provider_code: installation.provider_code.clone(),
            assigned_by: actor.user_id,
            created_at: OffsetDateTime::now_utc(),
        };
        Self {
            actor,
            installations: Arc::new(RwLock::new(HashMap::from([(
                installation.id,
                installation,
            )]))),
            assignments: Arc::new(RwLock::new(vec![assignment])),
            instances: Arc::new(RwLock::new(HashMap::new())),
            secrets: Arc::new(RwLock::new(HashMap::new())),
            secret_records: Arc::new(RwLock::new(HashMap::new())),
            caches: Arc::new(RwLock::new(HashMap::new())),
            preview_sessions: Arc::new(RwLock::new(HashMap::new())),
            audit_logs: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl InMemoryDataSourceRepository {
    fn with_actor(actor: ActorContext) -> Self {
        let mut repository = Self::default();
        repository.actor = actor;
        repository
    }

    async fn preview_session_count(&self) -> usize {
        self.preview_sessions.read().await.len()
    }

    async fn stored_secret_json(&self, instance_id: Uuid) -> Value {
        self.secrets
            .read()
            .await
            .get(&instance_id)
            .cloned()
            .unwrap_or_else(|| json!({}))
    }

    async fn audit_events(&self) -> Vec<AuditLogRecord> {
        self.audit_logs.read().await.clone()
    }
}

#[async_trait]
impl AuthRepository for InMemoryDataSourceRepository {
    async fn find_authenticator(&self, _name: &str) -> Result<Option<AuthenticatorRecord>> {
        Ok(None)
    }

    async fn find_user_for_password_login(&self, _identifier: &str) -> Result<Option<UserRecord>> {
        Ok(None)
    }

    async fn find_user_by_id(&self, _user_id: Uuid) -> Result<Option<UserRecord>> {
        Ok(None)
    }

    async fn default_scope_for_user(&self, _user_id: Uuid) -> Result<ScopeContext> {
        Ok(ScopeContext {
            tenant_id: self.actor.tenant_id,
            workspace_id: self.actor.current_workspace_id,
        })
    }

    async fn load_actor_context_for_user(&self, actor_user_id: Uuid) -> Result<ActorContext> {
        self.load_actor_context(
            actor_user_id,
            self.actor.tenant_id,
            self.actor.current_workspace_id,
            None,
        )
        .await
    }

    async fn load_actor_context(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        workspace_id: Uuid,
        _display_role: Option<&str>,
    ) -> Result<ActorContext> {
        let mut actor = self.actor.clone();
        actor.user_id = user_id;
        actor.tenant_id = tenant_id;
        actor.current_workspace_id = workspace_id;
        Ok(actor)
    }

    async fn update_password_hash(
        &self,
        _user_id: Uuid,
        _password_hash: &str,
        _actor_id: Uuid,
    ) -> Result<i64> {
        Ok(1)
    }

    async fn update_profile(&self, _input: &UpdateProfileInput) -> Result<UserRecord> {
        anyhow::bail!("not implemented")
    }

    async fn bump_session_version(&self, _user_id: Uuid, _actor_id: Uuid) -> Result<i64> {
        Ok(1)
    }

    async fn list_permissions(&self) -> Result<Vec<PermissionDefinition>> {
        Ok(Vec::new())
    }

    async fn append_audit_log(&self, event: &AuditLogRecord) -> Result<()> {
        self.audit_logs.write().await.push(event.clone());
        Ok(())
    }
}

#[async_trait]
impl crate::ports::PluginRepository for InMemoryDataSourceRepository {
    async fn upsert_installation(
        &self,
        _input: &UpsertPluginInstallationInput,
    ) -> Result<PluginInstallationRecord> {
        anyhow::bail!("not implemented")
    }

    async fn get_installation(
        &self,
        installation_id: Uuid,
    ) -> Result<Option<PluginInstallationRecord>> {
        Ok(self
            .installations
            .read()
            .await
            .get(&installation_id)
            .cloned())
    }

    async fn list_installations(&self) -> Result<Vec<PluginInstallationRecord>> {
        Ok(self.installations.read().await.values().cloned().collect())
    }

    async fn delete_installation(&self, _installation_id: Uuid) -> Result<()> {
        anyhow::bail!("not implemented")
    }

    async fn list_pending_restart_host_extensions(&self) -> Result<Vec<PluginInstallationRecord>> {
        Ok(Vec::new())
    }

    async fn update_desired_state(
        &self,
        _input: &UpdatePluginDesiredStateInput,
    ) -> Result<PluginInstallationRecord> {
        anyhow::bail!("not implemented")
    }

    async fn update_artifact_snapshot(
        &self,
        _input: &UpdatePluginArtifactSnapshotInput,
    ) -> Result<PluginInstallationRecord> {
        anyhow::bail!("not implemented")
    }

    async fn update_runtime_snapshot(
        &self,
        _input: &UpdatePluginRuntimeSnapshotInput,
    ) -> Result<PluginInstallationRecord> {
        anyhow::bail!("not implemented")
    }

    async fn create_assignment(
        &self,
        _input: &CreatePluginAssignmentInput,
    ) -> Result<PluginAssignmentRecord> {
        anyhow::bail!("not implemented")
    }

    async fn list_assignments(&self, workspace_id: Uuid) -> Result<Vec<PluginAssignmentRecord>> {
        Ok(self
            .assignments
            .read()
            .await
            .iter()
            .filter(|assignment| assignment.workspace_id == workspace_id)
            .cloned()
            .collect())
    }

    async fn create_task(&self, _input: &CreatePluginTaskInput) -> Result<PluginTaskRecord> {
        anyhow::bail!("not implemented")
    }

    async fn update_task_status(
        &self,
        _input: &UpdatePluginTaskStatusInput,
    ) -> Result<PluginTaskRecord> {
        anyhow::bail!("not implemented")
    }

    async fn get_task(&self, _task_id: Uuid) -> Result<Option<PluginTaskRecord>> {
        Ok(None)
    }

    async fn list_tasks(&self) -> Result<Vec<PluginTaskRecord>> {
        Ok(Vec::new())
    }
}

#[async_trait]
impl DataSourceRepository for InMemoryDataSourceRepository {
    async fn create_instance(
        &self,
        input: &CreateDataSourceInstanceInput,
    ) -> Result<DataSourceInstanceRecord> {
        let record = DataSourceInstanceRecord {
            id: input.instance_id,
            workspace_id: input.workspace_id,
            installation_id: input.installation_id,
            source_code: input.source_code.clone(),
            display_name: input.display_name.clone(),
            status: input.status,
            config_json: input.config_json.clone(),
            metadata_json: input.metadata_json.clone(),
            secret_ref: None,
            secret_version: None,
            defaults: input.defaults,
            created_by: input.created_by,
            created_at: OffsetDateTime::now_utc(),
            updated_at: OffsetDateTime::now_utc(),
        };
        self.instances
            .write()
            .await
            .insert(record.id, record.clone());
        Ok(record)
    }

    async fn update_instance_status(
        &self,
        input: &UpdateDataSourceInstanceStatusInput,
    ) -> Result<DataSourceInstanceRecord> {
        let mut instances = self.instances.write().await;
        let instance = instances
            .get_mut(&input.instance_id)
            .expect("instance should exist for test");
        instance.status = input.status;
        instance.metadata_json = input.metadata_json.clone();
        instance.updated_at = OffsetDateTime::now_utc();
        Ok(instance.clone())
    }

    async fn update_instance_defaults(
        &self,
        input: &UpdateDataSourceDefaultsInput,
    ) -> Result<DataSourceInstanceRecord> {
        let mut instances = self.instances.write().await;
        let instance = instances
            .get_mut(&input.instance_id)
            .expect("instance should exist for test");
        instance.defaults = input.defaults;
        instance.updated_at = OffsetDateTime::now_utc();
        Ok(instance.clone())
    }

    async fn update_instance_config(
        &self,
        input: &UpdateDataSourceInstanceConfigInput,
    ) -> Result<DataSourceInstanceRecord> {
        let mut instances = self.instances.write().await;
        let instance = instances
            .get_mut(&input.instance_id)
            .expect("instance should exist for test");
        instance.config_json = input.config_json.clone();
        instance.updated_at = OffsetDateTime::now_utc();
        Ok(instance.clone())
    }

    async fn get_instance(
        &self,
        workspace_id: Uuid,
        instance_id: Uuid,
    ) -> Result<Option<DataSourceInstanceRecord>> {
        Ok(self
            .instances
            .read()
            .await
            .get(&instance_id)
            .filter(|instance| instance.workspace_id == workspace_id)
            .cloned())
    }

    async fn upsert_secret(
        &self,
        input: &UpsertDataSourceSecretInput,
    ) -> Result<DataSourceSecretRecord> {
        let record = DataSourceSecretRecord {
            data_source_instance_id: input.data_source_instance_id,
            secret_ref: input.secret_ref.clone(),
            encrypted_secret_json: input.secret_json.clone(),
            secret_version: input.secret_version,
            updated_at: OffsetDateTime::now_utc(),
        };
        self.secrets
            .write()
            .await
            .insert(input.data_source_instance_id, input.secret_json.clone());
        self.secret_records
            .write()
            .await
            .insert(input.data_source_instance_id, record.clone());
        if let Some(instance) = self
            .instances
            .write()
            .await
            .get_mut(&input.data_source_instance_id)
        {
            instance.secret_ref = Some(record.secret_ref.clone());
            instance.secret_version = Some(record.secret_version);
        }
        Ok(record)
    }

    async fn rotate_secret(
        &self,
        input: &RotateDataSourceSecretInput,
    ) -> Result<RotateDataSourceSecretOutput> {
        let mut secret_records = self.secret_records.write().await;
        let secret_version = secret_records
            .get(&input.data_source_instance_id)
            .map(|record| record.secret_version + 1)
            .unwrap_or(1);
        let existing_secret_json = self
            .secrets
            .read()
            .await
            .get(&input.data_source_instance_id)
            .cloned();
        let secret_json =
            merge_config_marker_secret_values(existing_secret_json.as_ref(), &input.secret_json);
        let record = DataSourceSecretRecord {
            data_source_instance_id: input.data_source_instance_id,
            secret_ref: input.secret_ref.clone(),
            encrypted_secret_json: secret_json.clone(),
            secret_version,
            updated_at: OffsetDateTime::now_utc(),
        };
        self.secrets
            .write()
            .await
            .insert(input.data_source_instance_id, secret_json);
        secret_records.insert(input.data_source_instance_id, record.clone());
        let mut instances = self.instances.write().await;
        let instance = instances
            .get_mut(&input.data_source_instance_id)
            .expect("instance should exist for test");
        instance.secret_ref = Some(record.secret_ref.clone());
        instance.secret_version = Some(record.secret_version);
        instance.config_json = refresh_test_secret_reference_versions(
            &instance.config_json,
            &record.secret_ref,
            record.secret_version,
        );
        instance.updated_at = OffsetDateTime::now_utc();
        Ok(RotateDataSourceSecretOutput {
            secret: record,
            instance: instance.clone(),
        })
    }

    async fn get_secret_record(&self, instance_id: Uuid) -> Result<Option<DataSourceSecretRecord>> {
        Ok(self.secret_records.read().await.get(&instance_id).cloned())
    }

    async fn get_secret_json(&self, instance_id: Uuid) -> Result<Option<Value>> {
        Ok(self.secrets.read().await.get(&instance_id).cloned())
    }

    async fn upsert_catalog_cache(
        &self,
        input: &UpsertDataSourceCatalogCacheInput,
    ) -> Result<DataSourceCatalogCacheRecord> {
        let record = DataSourceCatalogCacheRecord {
            data_source_instance_id: input.data_source_instance_id,
            refresh_status: input.refresh_status,
            catalog_json: input.catalog_json.clone(),
            last_error_message: input.last_error_message.clone(),
            refreshed_at: input.refreshed_at,
            updated_at: OffsetDateTime::now_utc(),
        };
        self.caches
            .write()
            .await
            .insert(record.data_source_instance_id, record.clone());
        Ok(record)
    }

    async fn create_preview_session(
        &self,
        input: &CreateDataSourcePreviewSessionInput,
    ) -> Result<DataSourcePreviewSessionRecord> {
        let record = DataSourcePreviewSessionRecord {
            id: input.session_id,
            workspace_id: input.workspace_id,
            actor_user_id: input.actor_user_id,
            data_source_instance_id: input.data_source_instance_id,
            config_fingerprint: input.config_fingerprint.clone(),
            preview_json: input.preview_json.clone(),
            expires_at: input.expires_at,
            created_at: OffsetDateTime::now_utc(),
        };
        self.preview_sessions
            .write()
            .await
            .insert(record.id, record.clone());
        Ok(record)
    }
}

fn refresh_test_secret_reference_versions(
    value: &Value,
    secret_ref: &str,
    secret_version: i32,
) -> Value {
    match value {
        Value::Object(object) if is_test_secret_reference_marker(value) => {
            let mut updated = object.clone();
            if updated
                .get("secret_ref")
                .and_then(Value::as_str)
                .map(|value| value == secret_ref)
                .unwrap_or(false)
            {
                updated.insert("secret_version".to_string(), json!(secret_version));
            }
            Value::Object(updated)
        }
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(key, child)| {
                    (
                        key.clone(),
                        refresh_test_secret_reference_versions(child, secret_ref, secret_version),
                    )
                })
                .collect(),
        ),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| {
                    refresh_test_secret_reference_versions(item, secret_ref, secret_version)
                })
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn is_test_secret_reference_marker(value: &Value) -> bool {
    value
        .as_object()
        .map(|object| object.contains_key("secret_ref") && object.contains_key("secret_version"))
        .unwrap_or(false)
}

fn merge_config_marker_secret_values(existing: Option<&Value>, incoming: &Value) -> Value {
    let mut merged = incoming.clone();
    let Some(merged_object) = merged.as_object_mut() else {
        return merged;
    };

    let mut marker_values = existing
        .and_then(|value| value.get("__config_secret_values"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    if let Some(incoming_marker_values) = merged_object
        .get("__config_secret_values")
        .and_then(Value::as_object)
    {
        for (key, value) in incoming_marker_values {
            marker_values.insert(key.clone(), value.clone());
        }
    }
    if !marker_values.is_empty() {
        merged_object.insert(
            "__config_secret_values".to_string(),
            Value::Object(marker_values),
        );
    }

    merged
}

#[derive(Clone)]
struct StubDataSourceRuntime {
    preview_inputs: Arc<RwLock<Vec<DataSourcePreviewReadInput>>>,
    echo_secret_output: bool,
}

impl StubDataSourceRuntime {
    fn ready() -> Self {
        Self {
            preview_inputs: Arc::new(RwLock::new(Vec::new())),
            echo_secret_output: false,
        }
    }

    fn echoing_secret() -> Self {
        Self {
            preview_inputs: Arc::new(RwLock::new(Vec::new())),
            echo_secret_output: true,
        }
    }

    async fn last_preview_input(&self) -> Option<DataSourcePreviewReadInput> {
        self.preview_inputs.read().await.last().cloned()
    }
}

#[async_trait]
impl DataSourceRuntimePort for StubDataSourceRuntime {
    async fn ensure_loaded(&self, _installation: &PluginInstallationRecord) -> Result<()> {
        Ok(())
    }

    async fn validate_config(
        &self,
        _installation: &PluginInstallationRecord,
        _config_json: Value,
        secret_json: Value,
    ) -> Result<Value> {
        if self.echo_secret_output {
            let secret = secret_json["client_secret"].as_str().unwrap_or_default();
            return Ok(json!({
                "ok": true,
                "echoed": secret_json["client_secret"].clone(),
                "authorization": format!("Bearer {secret}"),
                "nested": {
                    "token": secret_json["client_secret"].clone(),
                    "authorization": format!("Token {secret}"),
                }
            }));
        }
        Ok(json!({ "ok": true }))
    }

    async fn test_connection(
        &self,
        _installation: &PluginInstallationRecord,
        _config_json: Value,
        _secret_json: Value,
    ) -> Result<Value> {
        Ok(json!({ "status": "ok" }))
    }

    async fn discover_catalog(
        &self,
        _installation: &PluginInstallationRecord,
        _config_json: Value,
        secret_json: Value,
    ) -> Result<Value> {
        if self.echo_secret_output {
            let secret = secret_json["client_secret"].as_str().unwrap_or_default();
            return Ok(serde_json::to_value(vec![DataSourceCatalogEntry {
                resource_key: "contacts".to_string(),
                display_name: "Contacts".to_string(),
                resource_kind: "object".to_string(),
                metadata: json!({
                    "authorization": format!("Bearer {secret}"),
                    "nested": {
                        "token": secret_json["client_secret"].clone(),
                    },
                }),
            }])?);
        }
        Ok(serde_json::to_value(vec![DataSourceCatalogEntry {
            resource_key: "contacts".to_string(),
            display_name: "Contacts".to_string(),
            resource_kind: "object".to_string(),
            metadata: json!({}),
        }])?)
    }

    async fn preview_read(
        &self,
        _installation: &PluginInstallationRecord,
        input: DataSourcePreviewReadInput,
    ) -> Result<DataSourcePreviewReadOutput> {
        let echoed_secret = input.connection.secret_json["client_secret"].clone();
        self.preview_inputs.write().await.push(input);
        if self.echo_secret_output {
            let secret = echoed_secret.as_str().unwrap_or_default();
            return Ok(DataSourcePreviewReadOutput {
                rows: vec![json!({
                    "id": "1",
                    "token": echoed_secret,
                    "authorization": format!("Bearer {secret}"),
                    "nested": { "secret": echoed_secret },
                    "items": [echoed_secret]
                })],
                next_cursor: None,
            });
        }
        Ok(DataSourcePreviewReadOutput {
            rows: vec![json!({ "id": "1", "email": "person@example.com" })],
            next_cursor: None,
        })
    }
}

#[tokio::test]
async fn validate_instance_updates_status_and_catalog_cache() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository.clone(), runtime);

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({ "client_secret": "secret" }),
        })
        .await
        .unwrap();

    let validated = service
        .validate_instance(ValidateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
        })
        .await
        .unwrap();

    assert_eq!(validated.instance.status, DataSourceInstanceStatus::Ready);
    assert_eq!(
        validated.catalog.refresh_status,
        DataSourceCatalogRefreshStatus::Ready
    );
    assert_eq!(
        repository.stored_secret_json(created.instance.id).await,
        json!({ "client_secret": "secret" })
    );
}

#[tokio::test]
async fn create_instance_requires_external_data_source_configure_permission_not_state_model_manage()
{
    let state_model_actor = ActorContext::scoped_in_scope(
        user_id(),
        tenant_id(),
        workspace_id(),
        "member",
        ["state_model.manage.all".to_string()],
    );
    let denied_repository = InMemoryDataSourceRepository::with_actor(state_model_actor);
    let denied_service = DataSourceService::new(denied_repository, StubDataSourceRuntime::ready());

    let denied = denied_service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({}),
        })
        .await
        .unwrap_err();
    assert!(denied.to_string().contains("permission_denied"));

    let data_source_actor = ActorContext::scoped_in_scope(
        user_id(),
        tenant_id(),
        workspace_id(),
        "member",
        ["external_data_source.configure.all".to_string()],
    );
    let allowed_repository = InMemoryDataSourceRepository::with_actor(data_source_actor);
    let allowed_service =
        DataSourceService::new(allowed_repository, StubDataSourceRuntime::ready());

    let created = allowed_service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({}),
        })
        .await
        .unwrap();
    assert_eq!(created.instance.display_name, "HubSpot");
}

#[tokio::test]
async fn create_instance_extracts_secret_like_config_values_to_reference_boundary() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository.clone(), runtime);
    let plaintext_token = "plain-token-from-config";

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({
                "base_url": "https://api.example.test",
                "access_token": plaintext_token,
            }),
            secret_json: json!({ "client_secret": "plain-secret-body" }),
        })
        .await
        .unwrap();

    let stored_config_text = created.instance.config_json.to_string();
    assert!(!stored_config_text.contains(plaintext_token));
    assert_eq!(
        created.instance.config_json["access_token"],
        json!({
            "secret_ref": created.instance.secret_ref.as_ref().unwrap(),
            "secret_version": created.instance.secret_version.unwrap(),
        })
    );
    assert!(created
        .instance
        .secret_ref
        .as_ref()
        .unwrap()
        .starts_with("secret://workspace/"));
    assert_eq!(created.instance.secret_version, Some(1));

    let stored_secret = repository.stored_secret_json(created.instance.id).await;
    assert_eq!(stored_secret["access_token"], plaintext_token);
    assert_eq!(stored_secret["client_secret"], "plain-secret-body");

    let audit_text = serde_json::to_string(&repository.audit_events().await).unwrap();
    assert!(!audit_text.contains(plaintext_token));
    assert!(!audit_text.contains("plain-secret-body"));
}

#[tokio::test]
async fn create_instance_extracts_generic_secret_bearing_value_shapes() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository.clone(), runtime);
    let header_plaintext = "bearer-from-header-value";
    let credential_plaintext = "credential-value-secret";

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({
                "headers": [
                    { "name": "Authorization", "value": header_plaintext },
                    { "name": "X-Trace", "value": "not-secret" }
                ],
                "credentials": { "type": "api_key", "value": credential_plaintext }
            }),
            secret_json: json!({}),
        })
        .await
        .unwrap();

    let config_text = created.instance.config_json.to_string();
    assert!(!config_text.contains(header_plaintext));
    assert!(!config_text.contains(credential_plaintext));
    assert!(config_text.contains("not-secret"));
    assert_eq!(
        created.instance.config_json["headers"][0]["value"],
        json!({
            "secret_ref": created.instance.secret_ref.as_ref().unwrap(),
            "secret_version": created.instance.secret_version.unwrap(),
        })
    );
    assert_eq!(
        created.instance.config_json["headers"][1]["value"],
        json!("not-secret")
    );
    assert_eq!(
        created.instance.config_json["credentials"]["value"],
        json!({
            "secret_ref": created.instance.secret_ref.as_ref().unwrap(),
            "secret_version": created.instance.secret_version.unwrap(),
        })
    );

    let stored_secret = repository.stored_secret_json(created.instance.id).await;
    assert_eq!(
        stored_secret["__config_secret_values"]["/headers/0/value"],
        header_plaintext
    );
    assert_eq!(
        stored_secret["__config_secret_values"].get("/headers/1/value"),
        None
    );
    assert_eq!(
        stored_secret["__config_secret_values"]["/credentials/value"],
        credential_plaintext
    );
}

#[tokio::test]
async fn rotate_secret_preserves_config_marker_values_when_payload_is_partial() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository.clone(), runtime);

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({
                "access_token": "config-token-secret",
                "headers": [
                    { "name": "Authorization", "value": "authorization-secret" },
                    { "name": "X-Trace", "value": "not-secret" }
                ]
            }),
            secret_json: json!({
                "client_secret": "initial-client-secret",
                "__config_secret_values": {
                    "/manual/marker": "explicit-marker"
                }
            }),
        })
        .await
        .unwrap();

    let rotated = service
        .rotate_secret(RotateDataSourceSecretCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            secret_json: json!({ "client_secret": "rotated-client-secret" }),
        })
        .await
        .unwrap();

    let stored_secret = repository.stored_secret_json(created.instance.id).await;
    assert_eq!(stored_secret["client_secret"], "rotated-client-secret");
    assert_eq!(
        stored_secret["__config_secret_values"]["/access_token"],
        "config-token-secret"
    );
    assert_eq!(
        stored_secret["__config_secret_values"]["/headers/0/value"],
        "authorization-secret"
    );
    assert_eq!(
        stored_secret["__config_secret_values"]["/manual/marker"],
        "explicit-marker"
    );
    assert_eq!(
        stored_secret["__config_secret_values"].get("/headers/1/value"),
        None
    );
    assert_eq!(
        rotated.instance.config_json["access_token"]["secret_version"],
        json!(2)
    );
    assert_eq!(
        rotated.instance.config_json["headers"][0]["value"]["secret_version"],
        json!(2)
    );
    assert_eq!(
        rotated.instance.config_json["headers"][1]["value"],
        json!("not-secret")
    );
}

#[tokio::test]
async fn rotate_secret_updates_version_and_audit_without_cleartext() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository.clone(), runtime);
    let rotated_plaintext = "rotated-secret-value";

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "base_url": "https://api.example.test" }),
            secret_json: json!({ "client_secret": "initial-secret-value" }),
        })
        .await
        .unwrap();

    let rotated = service
        .rotate_secret(RotateDataSourceSecretCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            secret_json: json!({ "client_secret": rotated_plaintext }),
        })
        .await
        .unwrap();

    assert_eq!(rotated.instance.secret_ref, created.instance.secret_ref);
    assert_eq!(rotated.instance.secret_version, Some(2));
    assert_eq!(
        repository.stored_secret_json(created.instance.id).await["client_secret"],
        rotated_plaintext
    );

    let audit_events = repository.audit_events().await;
    assert!(audit_events
        .iter()
        .any(|event| event.event_code == "data_source.secret_rotated"
            && event.payload["secret_ref"] == rotated.instance.secret_ref.clone().unwrap()
            && event.payload["secret_version"] == json!(2)));
    let audit_text = serde_json::to_string(&audit_events).unwrap();
    assert!(!audit_text.contains(rotated_plaintext));
    assert!(!audit_text.contains("initial-secret-value"));
}

#[tokio::test]
async fn sequential_secret_rotation_increments_versions_without_read_write_race_entrypoint() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository.clone(), runtime);

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "access_token": "initial-config-secret" }),
            secret_json: json!({ "client_secret": "initial-secret-value" }),
        })
        .await
        .unwrap();

    let rotated_once = service
        .rotate_secret(RotateDataSourceSecretCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            secret_json: json!({ "client_secret": "rotated-once" }),
        })
        .await
        .unwrap();
    let rotated_twice = service
        .rotate_secret(RotateDataSourceSecretCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            secret_json: json!({ "client_secret": "rotated-twice" }),
        })
        .await
        .unwrap();

    assert_eq!(rotated_once.instance.secret_version, Some(2));
    assert_eq!(rotated_twice.instance.secret_version, Some(3));
    let secret_record = repository
        .get_secret_record(created.instance.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(secret_record.secret_version, 3);
    assert_eq!(
        rotated_twice.instance.config_json["access_token"]["secret_version"],
        json!(secret_record.secret_version)
    );
}

#[tokio::test]
async fn validate_and_preview_redact_runtime_echoed_secret_values() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::echoing_secret();
    let service = DataSourceService::new(repository.clone(), runtime);
    let plaintext = "secret-runtime-echo";

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({ "client_secret": plaintext }),
        })
        .await
        .unwrap();

    let validated = service
        .validate_instance(ValidateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
        })
        .await
        .unwrap();
    let preview = service
        .preview_read(PreviewDataSourceReadCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            resource_key: "contacts".into(),
            limit: Some(20),
            cursor: None,
            options_json: json!({}),
        })
        .await
        .unwrap();

    let validate_text = validated.output.to_string();
    let preview_text = serde_json::to_string(&preview.output.rows).unwrap();
    let preview_session = repository
        .preview_sessions
        .read()
        .await
        .values()
        .next()
        .unwrap()
        .clone();
    assert!(!validate_text.contains(plaintext));
    assert!(!preview_text.contains(plaintext));
    assert!(!preview_session.config_fingerprint.contains(plaintext));
    assert!(validate_text.contains("***"));
    assert!(preview_text.contains("***"));
    assert!(!serde_json::to_string(&preview_session.preview_json)
        .unwrap()
        .contains(plaintext));
}

#[tokio::test]
async fn validate_preview_and_catalog_redact_embedded_secret_substrings() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::echoing_secret();
    let service = DataSourceService::new(repository.clone(), runtime);
    let plaintext = "embedded-secret-value";

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({ "client_secret": plaintext }),
        })
        .await
        .unwrap();

    let validated = service
        .validate_instance(ValidateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
        })
        .await
        .unwrap();
    let preview = service
        .preview_read(PreviewDataSourceReadCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            resource_key: "contacts".into(),
            limit: Some(20),
            cursor: None,
            options_json: json!({}),
        })
        .await
        .unwrap();

    let validate_text = validated.output.to_string();
    let catalog_text = serde_json::to_string(&validated.catalog.catalog_json).unwrap();
    let stored_catalog = repository
        .caches
        .read()
        .await
        .get(&created.instance.id)
        .expect("catalog cache should be persisted")
        .catalog_json
        .clone();
    let stored_catalog_text = serde_json::to_string(&stored_catalog).unwrap();
    let preview_text = serde_json::to_string(&preview.output.rows).unwrap();

    assert!(!validate_text.contains(plaintext));
    assert!(!catalog_text.contains(plaintext));
    assert!(!stored_catalog_text.contains(plaintext));
    assert!(!preview_text.contains(plaintext));
    assert!(validate_text.contains("Bearer ***"));
    assert!(catalog_text.contains("Bearer ***"));
    assert!(stored_catalog_text.contains("Bearer ***"));
    assert!(preview_text.contains("Bearer ***"));
}

#[tokio::test]
async fn update_defaults_persists_valid_data_model_defaults() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository, runtime);

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({ "client_secret": "secret" }),
        })
        .await
        .unwrap();

    let updated = service
        .update_defaults(UpdateDataSourceDefaultsCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            defaults: DataSourceDefaults {
                data_model_status: domain::DataModelStatus::Draft,
                api_exposure_status: domain::ApiExposureStatus::Draft,
            },
        })
        .await
        .unwrap();

    assert_eq!(
        updated.defaults.data_model_status,
        domain::DataModelStatus::Draft
    );
    assert_eq!(
        updated.defaults.api_exposure_status,
        domain::ApiExposureStatus::Draft
    );
}

#[tokio::test]
async fn update_defaults_rejects_invalid_status_exposure_combinations() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository, runtime);

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({ "client_secret": "secret" }),
        })
        .await
        .unwrap();

    let error = service
        .update_defaults(UpdateDataSourceDefaultsCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            defaults: DataSourceDefaults {
                data_model_status: domain::DataModelStatus::Draft,
                api_exposure_status: domain::ApiExposureStatus::PublishedNotExposed,
            },
        })
        .await
        .unwrap_err();

    assert!(error.to_string().contains("default_api_exposure_status"));
}

#[tokio::test]
async fn preview_read_uses_stored_secret_and_creates_preview_session() {
    let repository = InMemoryDataSourceRepository::default();
    let runtime = StubDataSourceRuntime::ready();
    let service = DataSourceService::new(repository.clone(), runtime.clone());

    let created = service
        .create_instance(CreateDataSourceInstanceCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            installation_id: installation_id(),
            source_code: "acme_hubspot_source".into(),
            display_name: "HubSpot".into(),
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({ "client_secret": "secret" }),
        })
        .await
        .unwrap();

    let preview = service
        .preview_read(PreviewDataSourceReadCommand {
            actor_user_id: user_id(),
            workspace_id: workspace_id(),
            instance_id: created.instance.id,
            resource_key: "contacts".into(),
            limit: Some(20),
            cursor: None,
            options_json: json!({ "sample": true }),
        })
        .await
        .unwrap();

    assert_eq!(preview.output.rows.len(), 1);
    assert_eq!(repository.preview_session_count().await, 1);

    let runtime_input = runtime.last_preview_input().await.unwrap();
    assert_eq!(
        runtime_input.connection,
        DataSourceConfigInput {
            config_json: json!({ "client_id": "abc" }),
            secret_json: json!({ "client_secret": "secret" }),
        }
    );
    assert_eq!(runtime_input.resource_key, "contacts");
}
