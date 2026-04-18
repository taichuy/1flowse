use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use access_control::ensure_permission;
use anyhow::{Context, Result};
use plugin_framework::provider_package::ProviderPackage;
use serde_json::json;
use uuid::Uuid;

use crate::{
    audit::audit_log,
    errors::ControlPlaneError,
    ports::{
        AuthRepository, CreatePluginAssignmentInput, CreatePluginTaskInput, PluginRepository,
        ProviderRuntimePort, UpdatePluginInstallationEnabledInput, UpdatePluginTaskStatusInput,
        UpsertPluginInstallationInput,
    },
};

pub struct InstallPluginCommand {
    pub actor_user_id: Uuid,
    pub package_root: String,
}

pub struct EnablePluginCommand {
    pub actor_user_id: Uuid,
    pub installation_id: Uuid,
}

pub struct AssignPluginCommand {
    pub actor_user_id: Uuid,
    pub installation_id: Uuid,
}

#[derive(Debug, Clone)]
pub struct PluginCatalogEntry {
    pub installation: domain::PluginInstallationRecord,
    pub help_url: Option<String>,
    pub default_base_url: Option<String>,
    pub model_discovery_mode: String,
    pub assigned_to_current_workspace: bool,
}

#[derive(Debug, Clone)]
pub struct InstallPluginResult {
    pub installation: domain::PluginInstallationRecord,
    pub task: domain::PluginTaskRecord,
}

pub struct PluginManagementService<R, H> {
    repository: R,
    runtime: H,
    install_root: PathBuf,
}

impl<R, H> PluginManagementService<R, H>
where
    R: AuthRepository + PluginRepository,
    H: ProviderRuntimePort,
{
    pub fn new(repository: R, runtime: H, install_root: impl Into<PathBuf>) -> Self {
        Self {
            repository,
            runtime,
            install_root: install_root.into(),
        }
    }

    pub async fn list_catalog(&self, actor_user_id: Uuid) -> Result<Vec<PluginCatalogEntry>> {
        let actor = load_actor_context_for_user(&self.repository, actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.view.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let assigned_installation_ids = self
            .repository
            .list_assignments(actor.current_workspace_id)
            .await?
            .into_iter()
            .map(|assignment| assignment.installation_id)
            .collect::<HashSet<_>>();
        let installations = self.repository.list_installations().await?;
        let mut catalog = Vec::with_capacity(installations.len());
        for installation in installations {
            let package = load_provider_package(&installation.install_path)?;
            catalog.push(PluginCatalogEntry {
                help_url: package.provider.help_url.clone(),
                default_base_url: package.provider.default_base_url.clone(),
                model_discovery_mode: format!("{:?}", package.provider.model_discovery_mode)
                    .to_ascii_lowercase(),
                assigned_to_current_workspace: assigned_installation_ids.contains(&installation.id),
                installation,
            });
        }

        Ok(catalog)
    }

    pub async fn install_plugin(
        &self,
        command: InstallPluginCommand,
    ) -> Result<InstallPluginResult> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let task_id = Uuid::now_v7();
        self.repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: None,
                workspace_id: None,
                provider_code: "pending_provider".to_string(),
                task_kind: domain::PluginTaskKind::Install,
                status: domain::PluginTaskStatus::Pending,
                status_message: Some("pending".to_string()),
                detail_json: json!({
                    "package_root": command.package_root,
                }),
                actor_user_id: Some(command.actor_user_id),
            })
            .await?;
        self.repository
            .update_task_status(&UpdatePluginTaskStatusInput {
                task_id,
                status: domain::PluginTaskStatus::Running,
                status_message: Some("running".to_string()),
                detail_json: json!({
                    "package_root": command.package_root,
                }),
            })
            .await?;

        let installation_result = async {
            let source_package = load_provider_package(&command.package_root)?;
            let install_path = self.install_root.join(&source_package.manifest.plugin_code).join(
                &source_package.manifest.version,
            );
            copy_installation_artifact(Path::new(&command.package_root), &install_path)?;
            let installed_package = load_provider_package(&install_path)?;
            let installation = self
                .repository
                .upsert_installation(&UpsertPluginInstallationInput {
                    installation_id: Uuid::now_v7(),
                    provider_code: installed_package.provider.provider_code.clone(),
                    plugin_id: installed_package.identifier(),
                    plugin_version: installed_package.manifest.version.clone(),
                    contract_version: installed_package.manifest.contract_version.clone(),
                    protocol: installed_package.provider.protocol.clone(),
                    display_name: installed_package.manifest.display_name.clone(),
                    source_kind: "downloaded_or_uploaded".to_string(),
                    verification_status: domain::PluginVerificationStatus::Valid,
                    enabled: false,
                    install_path: install_path.display().to_string(),
                    checksum: None,
                    signature_status: None,
                    metadata_json: json!({
                        "help_url": installed_package.provider.help_url,
                        "default_base_url": installed_package.provider.default_base_url,
                        "model_discovery_mode": format!("{:?}", installed_package.provider.model_discovery_mode).to_ascii_lowercase(),
                        "supported_model_types": installed_package.manifest.supported_model_types,
                    }),
                    actor_user_id: command.actor_user_id,
                })
                .await?;
            self.repository
                .append_audit_log(&audit_log(
                    Some(actor.current_workspace_id),
                    Some(command.actor_user_id),
                    "plugin_installation",
                    Some(installation.id),
                    "plugin.installed",
                    json!({
                        "provider_code": installation.provider_code,
                        "plugin_id": installation.plugin_id,
                    }),
                ))
                .await?;
            Ok::<domain::PluginInstallationRecord, anyhow::Error>(installation)
        }
        .await;

        match installation_result {
            Ok(installation) => {
                let task = self
                    .repository
                    .update_task_status(&UpdatePluginTaskStatusInput {
                        task_id,
                        status: domain::PluginTaskStatus::Success,
                        status_message: Some("installed".to_string()),
                        detail_json: json!({
                            "installation_id": installation.id,
                            "provider_code": installation.provider_code,
                            "plugin_id": installation.plugin_id,
                            "install_path": installation.install_path,
                        }),
                    })
                    .await?;
                Ok(InstallPluginResult { installation, task })
            }
            Err(error) => {
                let _ = self
                    .repository
                    .update_task_status(&UpdatePluginTaskStatusInput {
                        task_id,
                        status: domain::PluginTaskStatus::Failed,
                        status_message: Some(error.to_string()),
                        detail_json: json!({
                            "package_root": command.package_root,
                        }),
                    })
                    .await;
                Err(error)
            }
        }
    }

    pub async fn enable_plugin(
        &self,
        command: EnablePluginCommand,
    ) -> Result<domain::PluginTaskRecord> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;
        let installation = self
            .repository
            .get_installation(command.installation_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;

        let task_id = Uuid::now_v7();
        self.repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: Some(command.installation_id),
                workspace_id: None,
                provider_code: installation.provider_code.clone(),
                task_kind: domain::PluginTaskKind::Enable,
                status: domain::PluginTaskStatus::Pending,
                status_message: Some("pending".to_string()),
                detail_json: json!({}),
                actor_user_id: Some(command.actor_user_id),
            })
            .await?;
        self.repository
            .update_task_status(&UpdatePluginTaskStatusInput {
                task_id,
                status: domain::PluginTaskStatus::Running,
                status_message: Some("running".to_string()),
                detail_json: json!({}),
            })
            .await?;

        let enable_result = async {
            self.runtime.ensure_loaded(&installation).await?;
            let updated = self
                .repository
                .update_installation_enabled(&UpdatePluginInstallationEnabledInput {
                    installation_id: command.installation_id,
                    enabled: true,
                })
                .await?;
            self.repository
                .append_audit_log(&audit_log(
                    Some(actor.current_workspace_id),
                    Some(command.actor_user_id),
                    "plugin_installation",
                    Some(updated.id),
                    "plugin.enabled",
                    json!({
                        "provider_code": updated.provider_code,
                    }),
                ))
                .await?;
            Ok::<domain::PluginInstallationRecord, anyhow::Error>(updated)
        }
        .await;

        match enable_result {
            Ok(updated) => {
                self.repository
                    .update_task_status(&UpdatePluginTaskStatusInput {
                        task_id,
                        status: domain::PluginTaskStatus::Success,
                        status_message: Some("enabled".to_string()),
                        detail_json: json!({
                            "installation_id": updated.id,
                            "enabled": updated.enabled,
                        }),
                    })
                    .await
            }
            Err(error) => {
                let _ = self
                    .repository
                    .update_task_status(&UpdatePluginTaskStatusInput {
                        task_id,
                        status: domain::PluginTaskStatus::Failed,
                        status_message: Some(error.to_string()),
                        detail_json: json!({
                            "installation_id": command.installation_id,
                        }),
                    })
                    .await;
                Err(error)
            }
        }
    }

    pub async fn assign_plugin(
        &self,
        command: AssignPluginCommand,
    ) -> Result<domain::PluginTaskRecord> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;
        let installation = self
            .repository
            .get_installation(command.installation_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
        if !installation.enabled {
            return Err(ControlPlaneError::Conflict("plugin_installation_disabled").into());
        }

        let task_id = Uuid::now_v7();
        self.repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: Some(command.installation_id),
                workspace_id: Some(actor.current_workspace_id),
                provider_code: installation.provider_code.clone(),
                task_kind: domain::PluginTaskKind::Assign,
                status: domain::PluginTaskStatus::Pending,
                status_message: Some("pending".to_string()),
                detail_json: json!({}),
                actor_user_id: Some(command.actor_user_id),
            })
            .await?;
        self.repository
            .update_task_status(&UpdatePluginTaskStatusInput {
                task_id,
                status: domain::PluginTaskStatus::Running,
                status_message: Some("running".to_string()),
                detail_json: json!({}),
            })
            .await?;

        let assign_result = async {
            self.repository
                .create_assignment(&CreatePluginAssignmentInput {
                    installation_id: command.installation_id,
                    workspace_id: actor.current_workspace_id,
                    actor_user_id: command.actor_user_id,
                })
                .await?;
            self.repository
                .append_audit_log(&audit_log(
                    Some(actor.current_workspace_id),
                    Some(command.actor_user_id),
                    "plugin_assignment",
                    Some(command.installation_id),
                    "plugin.assigned",
                    json!({
                        "provider_code": installation.provider_code,
                    }),
                ))
                .await?;
            Ok::<(), anyhow::Error>(())
        }
        .await;

        match assign_result {
            Ok(()) => {
                self.repository
                    .update_task_status(&UpdatePluginTaskStatusInput {
                        task_id,
                        status: domain::PluginTaskStatus::Success,
                        status_message: Some("assigned".to_string()),
                        detail_json: json!({
                            "installation_id": command.installation_id,
                            "workspace_id": actor.current_workspace_id,
                        }),
                    })
                    .await
            }
            Err(error) => {
                let _ = self
                    .repository
                    .update_task_status(&UpdatePluginTaskStatusInput {
                        task_id,
                        status: domain::PluginTaskStatus::Failed,
                        status_message: Some(error.to_string()),
                        detail_json: json!({
                            "installation_id": command.installation_id,
                            "workspace_id": actor.current_workspace_id,
                        }),
                    })
                    .await;
                Err(error)
            }
        }
    }

    pub async fn list_tasks(&self, actor_user_id: Uuid) -> Result<Vec<domain::PluginTaskRecord>> {
        let actor = load_actor_context_for_user(&self.repository, actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.view.all")
            .map_err(ControlPlaneError::PermissionDenied)?;
        self.repository.list_tasks().await
    }

    pub async fn get_task(
        &self,
        actor_user_id: Uuid,
        task_id: Uuid,
    ) -> Result<domain::PluginTaskRecord> {
        let actor = load_actor_context_for_user(&self.repository, actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.view.all")
            .map_err(ControlPlaneError::PermissionDenied)?;
        self.repository
            .get_task(task_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_task").into())
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

fn load_provider_package(path: impl AsRef<Path>) -> Result<ProviderPackage> {
    ProviderPackage::load_from_dir(path.as_ref()).map_err(map_framework_error)
}

fn map_framework_error(error: plugin_framework::error::PluginFrameworkError) -> anyhow::Error {
    use plugin_framework::error::PluginFrameworkErrorKind;

    match error.kind() {
        PluginFrameworkErrorKind::InvalidAssignment
        | PluginFrameworkErrorKind::InvalidProviderPackage
        | PluginFrameworkErrorKind::InvalidProviderContract
        | PluginFrameworkErrorKind::Serialization => {
            ControlPlaneError::InvalidInput("provider_package").into()
        }
        PluginFrameworkErrorKind::Io | PluginFrameworkErrorKind::RuntimeContract => {
            ControlPlaneError::UpstreamUnavailable("provider_runtime").into()
        }
    }
}

fn copy_installation_artifact(source_root: &Path, target_root: &Path) -> Result<()> {
    if target_root.exists() {
        fs::remove_dir_all(target_root).with_context(|| {
            format!(
                "failed to remove previous installation artifact at {}",
                target_root.display()
            )
        })?;
    }
    fs::create_dir_all(target_root).with_context(|| {
        format!(
            "failed to create installation artifact root {}",
            target_root.display()
        )
    })?;
    copy_dir(source_root, target_root)
}

fn copy_dir(source_root: &Path, target_root: &Path) -> Result<()> {
    for entry in fs::read_dir(source_root)
        .with_context(|| format!("failed to read {}", source_root.display()))?
    {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target_root.join(entry.file_name());
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if source_path.is_dir() {
            if matches!(name.as_ref(), "demo" | "scripts") {
                continue;
            }
            fs::create_dir_all(&target_path)
                .with_context(|| format!("failed to create {}", target_path.display()))?;
            copy_dir(&source_path, &target_path)?;
            continue;
        }

        fs::copy(&source_path, &target_path).with_context(|| {
            format!(
                "failed to copy installation artifact {} -> {}",
                source_path.display(),
                target_path.display()
            )
        })?;
    }
    Ok(())
}
