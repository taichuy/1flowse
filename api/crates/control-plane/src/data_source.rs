use std::collections::HashSet;

use anyhow::Result;
use plugin_framework::data_source_contract::{
    DataSourceCatalogEntry, DataSourceConfigInput, DataSourcePreviewReadInput,
    DataSourcePreviewReadOutput,
};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

use crate::{
    audit::audit_log,
    errors::ControlPlaneError,
    ports::{
        AuthRepository, CreateDataSourceInstanceInput, CreateDataSourcePreviewSessionInput,
        DataSourceRepository, DataSourceRuntimePort, PluginRepository, RotateDataSourceSecretInput,
        UpdateDataSourceDefaultsInput, UpdateDataSourceInstanceStatusInput,
        UpsertDataSourceCatalogCacheInput, UpsertDataSourceSecretInput,
    },
};

#[derive(Debug, Clone)]
pub struct CreateDataSourceInstanceCommand {
    pub actor_user_id: Uuid,
    pub workspace_id: Uuid,
    pub installation_id: Uuid,
    pub source_code: String,
    pub display_name: String,
    pub config_json: Value,
    pub secret_json: Value,
}

#[derive(Debug, Clone)]
pub struct ValidateDataSourceInstanceCommand {
    pub actor_user_id: Uuid,
    pub workspace_id: Uuid,
    pub instance_id: Uuid,
}

#[derive(Debug, Clone)]
pub struct UpdateDataSourceDefaultsCommand {
    pub actor_user_id: Uuid,
    pub workspace_id: Uuid,
    pub instance_id: Uuid,
    pub defaults: domain::DataSourceDefaults,
}

#[derive(Debug, Clone)]
pub struct RotateDataSourceSecretCommand {
    pub actor_user_id: Uuid,
    pub workspace_id: Uuid,
    pub instance_id: Uuid,
    pub secret_json: Value,
}

#[derive(Debug, Clone)]
pub struct PreviewDataSourceReadCommand {
    pub actor_user_id: Uuid,
    pub workspace_id: Uuid,
    pub instance_id: Uuid,
    pub resource_key: String,
    pub limit: Option<u32>,
    pub cursor: Option<String>,
    pub options_json: Value,
}

#[derive(Debug, Clone)]
pub struct DataSourceInstanceView {
    pub instance: domain::DataSourceInstanceRecord,
    pub catalog: Option<domain::DataSourceCatalogCacheRecord>,
}

#[derive(Debug, Clone)]
pub struct DataSourceCatalogEntryView {
    pub installation_id: Uuid,
    pub source_code: String,
    pub plugin_id: String,
    pub plugin_version: String,
    pub display_name: String,
    pub protocol: String,
}

#[derive(Debug, Clone)]
pub struct ValidateDataSourceInstanceResult {
    pub instance: domain::DataSourceInstanceRecord,
    pub catalog: domain::DataSourceCatalogCacheRecord,
    pub output: Value,
}

#[derive(Debug, Clone)]
pub struct PreviewDataSourceReadResult {
    pub preview_session: domain::DataSourcePreviewSessionRecord,
    pub output: DataSourcePreviewReadOutput,
}

pub struct DataSourceService<R, H> {
    repository: R,
    runtime: H,
}

impl<R, H> DataSourceService<R, H>
where
    R: AuthRepository + PluginRepository + DataSourceRepository,
    H: DataSourceRuntimePort,
{
    pub fn new(repository: R, runtime: H) -> Self {
        Self {
            repository,
            runtime,
        }
    }

    pub async fn list_catalog(
        &self,
        actor_user_id: Uuid,
        workspace_id: Uuid,
    ) -> Result<Vec<DataSourceCatalogEntryView>> {
        let actor = load_actor_context_for_user(&self.repository, actor_user_id).await?;
        ensure_workspace_matches(&actor, workspace_id)?;
        ensure_external_data_source_permission(&actor, "view")?;

        let assigned_installation_ids = self
            .repository
            .list_assignments(workspace_id)
            .await?
            .into_iter()
            .map(|assignment| assignment.installation_id)
            .collect::<HashSet<_>>();

        let mut entries = self
            .repository
            .list_installations()
            .await?
            .into_iter()
            .filter(|installation| installation.contract_version == "1flowbase.data_source/v1")
            .filter(|installation| assigned_installation_ids.contains(&installation.id))
            .map(|installation| DataSourceCatalogEntryView {
                installation_id: installation.id,
                source_code: installation.provider_code,
                plugin_id: installation.plugin_id,
                plugin_version: installation.plugin_version,
                display_name: installation.display_name,
                protocol: installation.protocol,
            })
            .collect::<Vec<_>>();
        entries.sort_by(|left, right| left.display_name.cmp(&right.display_name));
        Ok(entries)
    }

    pub async fn create_instance(
        &self,
        command: CreateDataSourceInstanceCommand,
    ) -> Result<DataSourceInstanceView> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_workspace_matches(&actor, command.workspace_id)?;
        ensure_external_data_source_permission(&actor, "configure")?;

        let installation = self
            .repository
            .get_installation(command.installation_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
        ensure_installation_assigned(
            &self.repository,
            command.workspace_id,
            command.installation_id,
        )
        .await?;
        ensure_data_source_installation(&installation, &command.source_code)?;

        let instance_id = Uuid::now_v7();
        let secret_ref = domain::data_source_secret_ref(instance_id);
        let (config_json, secret_json) = sanitize_config_and_merge_secrets(
            &command.config_json,
            &command.secret_json,
            &secret_ref,
            1,
        )?;

        let instance = self
            .repository
            .create_instance(&CreateDataSourceInstanceInput {
                instance_id,
                workspace_id: command.workspace_id,
                installation_id: command.installation_id,
                source_code: normalize_required_text(&command.source_code, "source_code")?,
                display_name: normalize_required_text(&command.display_name, "display_name")?,
                status: domain::DataSourceInstanceStatus::Draft,
                config_json,
                metadata_json: json!({}),
                defaults: domain::DataSourceDefaults::default(),
                created_by: actor.user_id,
            })
            .await?;

        self.repository
            .upsert_secret(&UpsertDataSourceSecretInput {
                data_source_instance_id: instance.id,
                secret_ref: secret_ref.clone(),
                secret_json,
                secret_version: 1,
            })
            .await?;
        let instance = self
            .repository
            .get_instance(command.workspace_id, instance.id)
            .await?
            .unwrap_or(instance);

        self.repository
            .append_audit_log(&audit_log(
                Some(command.workspace_id),
                Some(actor.user_id),
                "data_source_instance",
                Some(instance.id),
                "data_source.instance_created",
                json!({
                    "installation_id": command.installation_id,
                    "source_code": instance.source_code,
                    "secret_ref": secret_ref,
                    "secret_version": 1,
                }),
            ))
            .await?;

        Ok(DataSourceInstanceView {
            instance,
            catalog: None,
        })
    }

    pub async fn validate_instance(
        &self,
        command: ValidateDataSourceInstanceCommand,
    ) -> Result<ValidateDataSourceInstanceResult> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_workspace_matches(&actor, command.workspace_id)?;
        ensure_external_data_source_permission(&actor, "configure")?;

        let existing = self
            .repository
            .get_instance(command.workspace_id, command.instance_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("data_source_instance"))?;
        let installation = self
            .repository
            .get_installation(existing.installation_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
        ensure_installation_assigned(
            &self.repository,
            command.workspace_id,
            existing.installation_id,
        )
        .await?;

        let secret_json = self
            .repository
            .get_secret_json(existing.id)
            .await?
            .unwrap_or_else(|| json!({}));

        self.runtime.ensure_loaded(&installation).await?;
        let secret_values = collect_secret_strings(&secret_json);
        let output = self
            .runtime
            .validate_config(
                &installation,
                existing.config_json.clone(),
                secret_json.clone(),
            )
            .await?;
        let output = redact_value(&output, &secret_values);
        self.runtime
            .test_connection(
                &installation,
                existing.config_json.clone(),
                secret_json.clone(),
            )
            .await?;
        let catalog_json = self
            .runtime
            .discover_catalog(&installation, existing.config_json.clone(), secret_json)
            .await?;
        let catalog_json = redact_value(&catalog_json, &secret_values);
        let _catalog_entries: Vec<DataSourceCatalogEntry> =
            serde_json::from_value(catalog_json.clone())?;
        let now = OffsetDateTime::now_utc();

        let instance = self
            .repository
            .update_instance_status(&UpdateDataSourceInstanceStatusInput {
                workspace_id: command.workspace_id,
                instance_id: existing.id,
                status: domain::DataSourceInstanceStatus::Ready,
                metadata_json: existing.metadata_json.clone(),
                updated_by: actor.user_id,
            })
            .await?;
        let catalog = self
            .repository
            .upsert_catalog_cache(&UpsertDataSourceCatalogCacheInput {
                data_source_instance_id: instance.id,
                refresh_status: domain::DataSourceCatalogRefreshStatus::Ready,
                catalog_json,
                last_error_message: None,
                refreshed_at: Some(now),
            })
            .await?;

        self.repository
            .append_audit_log(&audit_log(
                Some(command.workspace_id),
                Some(actor.user_id),
                "data_source_instance",
                Some(instance.id),
                "data_source.instance_validated",
                json!({
                    "refresh_status": catalog.refresh_status.as_str(),
                }),
            ))
            .await?;

        Ok(ValidateDataSourceInstanceResult {
            instance,
            catalog,
            output,
        })
    }

    pub async fn update_defaults(
        &self,
        command: UpdateDataSourceDefaultsCommand,
    ) -> Result<domain::DataSourceInstanceRecord> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_workspace_matches(&actor, command.workspace_id)?;
        ensure_external_data_source_permission(&actor, "configure")?;
        ensure_data_source_defaults_compatible(command.defaults)?;

        let instance = self
            .repository
            .update_instance_defaults(&UpdateDataSourceDefaultsInput {
                workspace_id: command.workspace_id,
                instance_id: command.instance_id,
                defaults: command.defaults,
                updated_by: actor.user_id,
            })
            .await?;

        self.repository
            .append_audit_log(&audit_log(
                Some(command.workspace_id),
                Some(actor.user_id),
                "data_source_instance",
                Some(instance.id),
                "data_source.defaults_updated",
                json!({
                    "default_data_model_status": instance.defaults.data_model_status.as_str(),
                    "default_api_exposure_status": instance.defaults.api_exposure_status.as_str(),
                }),
            ))
            .await?;

        Ok(instance)
    }

    pub async fn rotate_secret(
        &self,
        command: RotateDataSourceSecretCommand,
    ) -> Result<DataSourceInstanceView> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_workspace_matches(&actor, command.workspace_id)?;
        ensure_external_data_source_permission(&actor, "configure")?;

        let existing = self
            .repository
            .get_instance(command.workspace_id, command.instance_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("data_source_instance"))?;
        let secret_ref = existing
            .secret_ref
            .clone()
            .unwrap_or_else(|| domain::data_source_secret_ref(existing.id));
        let secret_json = ensure_json_object(&command.secret_json, "secret_json")?;

        let secret = self
            .repository
            .rotate_secret(&RotateDataSourceSecretInput {
                workspace_id: command.workspace_id,
                data_source_instance_id: existing.id,
                secret_ref: secret_ref.clone(),
                secret_json,
                updated_by: actor.user_id,
            })
            .await?;

        self.repository
            .append_audit_log(&audit_log(
                Some(command.workspace_id),
                Some(actor.user_id),
                "data_source_instance",
                Some(secret.instance.id),
                "data_source.secret_rotated",
                json!({
                    "secret_ref": secret_ref,
                    "secret_version": secret.secret.secret_version,
                }),
            ))
            .await?;

        Ok(DataSourceInstanceView {
            instance: secret.instance,
            catalog: None,
        })
    }

    pub async fn preview_read(
        &self,
        command: PreviewDataSourceReadCommand,
    ) -> Result<PreviewDataSourceReadResult> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_workspace_matches(&actor, command.workspace_id)?;
        ensure_external_data_source_permission(&actor, "configure")?;

        let instance = self
            .repository
            .get_instance(command.workspace_id, command.instance_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("data_source_instance"))?;
        let installation = self
            .repository
            .get_installation(instance.installation_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
        ensure_installation_assigned(
            &self.repository,
            command.workspace_id,
            instance.installation_id,
        )
        .await?;

        let secret_json = self
            .repository
            .get_secret_json(instance.id)
            .await?
            .unwrap_or_else(|| json!({}));
        let secret_values = collect_secret_strings(&secret_json);
        let preview_input = DataSourcePreviewReadInput {
            connection: DataSourceConfigInput {
                config_json: instance.config_json.clone(),
                secret_json,
            },
            resource_key: normalize_required_text(&command.resource_key, "resource_key")?,
            limit: command.limit,
            cursor: command.cursor,
            options_json: command.options_json,
        };
        let output = self
            .runtime
            .preview_read(&installation, preview_input.clone())
            .await?;
        let output = redact_preview_output(output, &secret_values);
        let preview_json = serde_json::to_value(&output)?;
        let preview_session = self
            .repository
            .create_preview_session(&CreateDataSourcePreviewSessionInput {
                session_id: Uuid::now_v7(),
                workspace_id: command.workspace_id,
                actor_user_id: actor.user_id,
                data_source_instance_id: Some(instance.id),
                config_fingerprint: build_preview_fingerprint(&preview_input, &secret_values)?,
                preview_json,
                expires_at: OffsetDateTime::now_utc() + Duration::minutes(15),
            })
            .await?;

        self.repository
            .append_audit_log(&audit_log(
                Some(command.workspace_id),
                Some(actor.user_id),
                "data_source_instance",
                Some(instance.id),
                "data_source.preview_read",
                json!({
                    "resource_key": preview_input.resource_key,
                }),
            ))
            .await?;

        Ok(PreviewDataSourceReadResult {
            preview_session,
            output,
        })
    }
}

async fn load_actor_context_for_user<R>(
    repository: &R,
    actor_user_id: Uuid,
) -> Result<domain::ActorContext>
where
    R: AuthRepository,
{
    let scope = repository.default_scope_for_user(actor_user_id).await?;
    repository
        .load_actor_context(actor_user_id, scope.tenant_id, scope.workspace_id, None)
        .await
}

fn ensure_workspace_matches(actor: &domain::ActorContext, workspace_id: Uuid) -> Result<()> {
    if actor.current_workspace_id == workspace_id {
        Ok(())
    } else {
        Err(ControlPlaneError::InvalidInput("workspace_id").into())
    }
}

fn ensure_external_data_source_permission(
    actor: &domain::ActorContext,
    action: &str,
) -> Result<(), ControlPlaneError> {
    if actor.is_root
        || actor.has_permission(&format!("external_data_source.{action}.all"))
        || actor.has_permission(&format!("external_data_source.{action}.own"))
    {
        return Ok(());
    }

    Err(ControlPlaneError::PermissionDenied("permission_denied"))
}

async fn ensure_installation_assigned<R>(
    repository: &R,
    workspace_id: Uuid,
    installation_id: Uuid,
) -> Result<()>
where
    R: PluginRepository,
{
    let assigned = repository
        .list_assignments(workspace_id)
        .await?
        .into_iter()
        .any(|assignment| assignment.installation_id == installation_id);
    if assigned {
        Ok(())
    } else {
        Err(ControlPlaneError::Conflict("plugin_assignment_required").into())
    }
}

fn ensure_data_source_installation(
    installation: &domain::PluginInstallationRecord,
    source_code: &str,
) -> Result<()> {
    if installation.contract_version != "1flowbase.data_source/v1" {
        return Err(ControlPlaneError::InvalidInput("plugin_installation").into());
    }
    if installation.provider_code != source_code {
        return Err(ControlPlaneError::InvalidInput("source_code").into());
    }
    Ok(())
}

fn normalize_required_text(value: &str, field: &'static str) -> Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(ControlPlaneError::InvalidInput(field).into())
    } else {
        Ok(trimmed.to_string())
    }
}

fn ensure_json_object(value: &Value, field: &'static str) -> Result<Value> {
    if value.is_object() {
        Ok(value.clone())
    } else {
        Err(ControlPlaneError::InvalidInput(field).into())
    }
}

fn sanitize_config_and_merge_secrets(
    config_json: &Value,
    secret_json: &Value,
    secret_ref: &str,
    secret_version: i32,
) -> Result<(Value, Value)> {
    let config_json = ensure_json_object(config_json, "config_json")?;
    let mut merged_secret_json = ensure_json_object(secret_json, "secret_json")?;
    let sanitized_config = scrub_secret_like_config_values(
        &config_json,
        &mut merged_secret_json,
        secret_ref,
        secret_version,
        &mut Vec::new(),
    );
    Ok((sanitized_config, merged_secret_json))
}

fn scrub_secret_like_config_values(
    value: &Value,
    secret_json: &mut Value,
    secret_ref: &str,
    secret_version: i32,
    path: &mut Vec<String>,
) -> Value {
    match value {
        Value::Object(object) => {
            let mut sanitized = Map::new();
            for (key, child) in object {
                path.push(key.clone());
                let next = if is_secret_bearing_config_value(key, child, path)
                    && !is_secret_reference_marker(child)
                {
                    store_config_secret_value(secret_json, path, child.clone());
                    secret_reference_marker(secret_ref, secret_version)
                } else {
                    scrub_secret_like_config_values(
                        child,
                        secret_json,
                        secret_ref,
                        secret_version,
                        path,
                    )
                };
                path.pop();
                sanitized.insert(key.clone(), next);
            }
            Value::Object(sanitized)
        }
        Value::Array(items) => Value::Array(
            items
                .iter()
                .enumerate()
                .map(|(index, item)| {
                    path.push(index.to_string());
                    let next = scrub_secret_like_config_values(
                        item,
                        secret_json,
                        secret_ref,
                        secret_version,
                        path,
                    );
                    path.pop();
                    next
                })
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn store_config_secret_value(secret_json: &mut Value, path: &[String], value: Value) {
    if let Some(last) = path.last() {
        if path.len() == 1 {
            if let Some(secret_object) = secret_json.as_object_mut() {
                secret_object
                    .entry(last.clone())
                    .or_insert_with(|| value.clone());
            }
        }
    }

    let pointer = format!("/{}", path.join("/"));
    if let Some(secret_object) = secret_json.as_object_mut() {
        let entry = secret_object
            .entry("__config_secret_values")
            .or_insert_with(|| Value::Object(Map::new()));
        if let Some(config_secret_values) = entry.as_object_mut() {
            config_secret_values.insert(pointer, value);
        }
    }
}

fn is_secret_like_config_key(key: &str) -> bool {
    let normalized = key.to_ascii_lowercase().replace(['-', ' '], "_");
    if normalized == "secret_ref" || normalized == "secret_version" || normalized.ends_with("_ref")
    {
        return false;
    }

    normalized.contains("secret")
        || normalized.contains("password")
        || normalized.contains("token")
        || normalized.contains("api_key")
        || normalized.contains("apikey")
        || normalized.contains("authorization")
        || normalized.contains("private_key")
}

fn is_secret_bearing_config_value(key: &str, child: &Value, path: &[String]) -> bool {
    if is_secret_like_config_key(key) {
        return true;
    }

    if key == "value" && path_matches_headers_value(path) {
        return true;
    }

    key == "value" && path_matches_credentials_value(path) && !child.is_null()
}

fn path_matches_headers_value(path: &[String]) -> bool {
    path.len() >= 3
        && path.last().map(String::as_str) == Some("value")
        && path.get(path.len() - 3).map(String::as_str) == Some("headers")
        && path
            .get(path.len() - 2)
            .map(|segment| segment.parse::<usize>().is_ok())
            .unwrap_or(false)
}

fn path_matches_credentials_value(path: &[String]) -> bool {
    path.len() >= 2
        && path.last().map(String::as_str) == Some("value")
        && path.get(path.len() - 2).map(String::as_str) == Some("credentials")
}

fn is_secret_reference_marker(value: &Value) -> bool {
    value
        .as_object()
        .map(|object| object.contains_key("secret_ref") && object.contains_key("secret_version"))
        .unwrap_or(false)
}

fn collect_secret_strings(value: &Value) -> HashSet<String> {
    let mut secrets = HashSet::new();
    collect_secret_strings_into(value, &mut secrets);
    secrets
}

fn collect_secret_strings_into(value: &Value, secrets: &mut HashSet<String>) {
    match value {
        Value::String(raw) if !raw.is_empty() => {
            secrets.insert(raw.clone());
        }
        Value::Array(items) => {
            for item in items {
                collect_secret_strings_into(item, secrets);
            }
        }
        Value::Object(object) => {
            for child in object.values() {
                collect_secret_strings_into(child, secrets);
            }
        }
        _ => {}
    }
}

fn redact_value(value: &Value, secrets: &HashSet<String>) -> Value {
    match value {
        Value::String(raw) => Value::String(redact_string(raw, secrets)),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| redact_value(item, secrets))
                .collect(),
        ),
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(key, child)| (key.clone(), redact_value(child, secrets)))
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn redact_string(raw: &str, secrets: &HashSet<String>) -> String {
    if secrets.is_empty() {
        return raw.to_string();
    }

    let mut ordered_secrets = secrets.iter().collect::<Vec<_>>();
    ordered_secrets
        .sort_by(|left, right| right.len().cmp(&left.len()).then_with(|| left.cmp(right)));

    let mut redacted = raw.to_string();
    for secret in ordered_secrets {
        if !secret.is_empty() {
            redacted = redacted.replace(secret, "***");
        }
    }
    redacted
}

fn redact_preview_output(
    output: DataSourcePreviewReadOutput,
    secrets: &HashSet<String>,
) -> DataSourcePreviewReadOutput {
    DataSourcePreviewReadOutput {
        rows: output
            .rows
            .into_iter()
            .map(|row| redact_value(&row, secrets))
            .collect(),
        next_cursor: output
            .next_cursor
            .map(|cursor| redact_string(&cursor, secrets)),
    }
}

fn secret_reference_marker(secret_ref: &str, secret_version: i32) -> Value {
    json!({
        "secret_ref": secret_ref,
        "secret_version": secret_version,
    })
}

fn ensure_data_source_defaults_compatible(defaults: domain::DataSourceDefaults) -> Result<()> {
    if domain::ApiExposureStatus::validate_for_status(
        defaults.data_model_status,
        defaults.api_exposure_status,
        domain::ApiExposureReadiness::default(),
    )
    .is_rejected()
    {
        Err(ControlPlaneError::InvalidInput("default_api_exposure_status").into())
    } else {
        Ok(())
    }
}

fn build_preview_fingerprint(
    input: &DataSourcePreviewReadInput,
    secret_values: &HashSet<String>,
) -> Result<String> {
    let mut sanitized = input.clone();
    sanitized.connection.config_json =
        redact_value(&sanitized.connection.config_json, secret_values);
    sanitized.connection.secret_json =
        redact_value(&sanitized.connection.secret_json, secret_values);
    let bytes = serde_json::to_vec(&sanitized)?;
    let digest = Sha256::digest(bytes);
    Ok(format!("sha256:{}", to_hex(&digest)))
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}
