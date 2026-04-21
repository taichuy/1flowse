use std::{
    cmp::Ordering,
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use access_control::ensure_permission;
use anyhow::{Context, Result};
use plugin_framework::{
    compute_manifest_fingerprint, intake_package_bytes, parse_plugin_manifest,
    provider_package::ProviderPackage, PackageIntakePolicy, PackageIntakeResult, PluginManifestV1,
};
use serde_json::json;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    audit::audit_log,
    errors::ControlPlaneError,
    host_extension::{
        ensure_root_actor, ensure_uploaded_host_extensions_enabled, is_host_extension_installation,
        is_host_extension_manifest, is_model_provider_installation, plugin_code_from_plugin_id,
    },
    i18n::{
        merge_i18n_catalog, plugin_namespace, trim_json_bundles, trim_provider_bundles,
        I18nCatalog, RequestedLocales,
    },
    plugin_lifecycle::{derive_availability_status, reconcile_installation_snapshot},
    ports::{
        AuthRepository, CreatePluginAssignmentInput, CreatePluginTaskInput,
        ModelProviderRepository, NodeContributionRegistryInput, NodeContributionRepository,
        OfficialPluginArtifact, OfficialPluginSourceEntry, OfficialPluginSourcePort,
        PluginRepository, ProviderRuntimePort, ReassignModelProviderInstancesInput,
        ReplaceInstallationNodeContributionsInput, UpdatePluginDesiredStateInput,
        UpdatePluginRuntimeSnapshotInput, UpdatePluginTaskStatusInput,
        UpsertModelProviderCatalogCacheInput, UpsertPluginInstallationInput,
    },
    state_transition::ensure_plugin_task_transition,
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

pub struct InstallOfficialPluginCommand {
    pub actor_user_id: Uuid,
    pub plugin_id: String,
}

pub struct InstallUploadedPluginCommand {
    pub actor_user_id: Uuid,
    pub file_name: String,
    pub package_bytes: Vec<u8>,
}

pub struct UpgradeLatestPluginFamilyCommand {
    pub actor_user_id: Uuid,
    pub provider_code: String,
}

pub struct SwitchPluginVersionCommand {
    pub actor_user_id: Uuid,
    pub provider_code: String,
    pub target_installation_id: Uuid,
}

pub struct DeletePluginFamilyCommand {
    pub actor_user_id: Uuid,
    pub provider_code: String,
}

#[derive(Debug, Clone)]
pub struct PluginCatalogEntry {
    pub installation: domain::PluginInstallationRecord,
    pub plugin_type: String,
    pub namespace: String,
    pub label_key: String,
    pub description_key: Option<String>,
    pub provider_label_key: String,
    pub help_url: Option<String>,
    pub default_base_url: Option<String>,
    pub model_discovery_mode: String,
    pub assigned_to_current_workspace: bool,
}

#[derive(Debug, Clone)]
pub struct PluginCatalogView {
    pub entries: Vec<PluginCatalogEntry>,
    pub i18n_catalog: I18nCatalog,
}

#[derive(Debug, Clone, Default)]
pub struct PluginCatalogFilter {
    pub plugin_type: Option<String>,
}

impl PluginCatalogFilter {
    fn matches(&self, plugin_type: &str) -> bool {
        self.plugin_type
            .as_deref()
            .is_none_or(|value| value == plugin_type)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OfficialPluginInstallStatus {
    NotInstalled,
    Installed,
    Assigned,
}

impl OfficialPluginInstallStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotInstalled => "not_installed",
            Self::Installed => "installed",
            Self::Assigned => "assigned",
        }
    }
}

#[derive(Debug, Clone)]
pub struct OfficialPluginCatalogEntry {
    pub plugin_id: String,
    pub plugin_type: String,
    pub provider_code: String,
    pub namespace: String,
    pub label_key: String,
    pub description_key: Option<String>,
    pub provider_label_key: String,
    pub protocol: String,
    pub latest_version: String,
    pub selected_artifact: OfficialPluginArtifact,
    pub help_url: Option<String>,
    pub model_discovery_mode: String,
    pub install_status: OfficialPluginInstallStatus,
}

#[derive(Debug, Clone)]
pub struct OfficialPluginCatalogView {
    pub source_kind: String,
    pub source_label: String,
    pub registry_url: String,
    pub i18n_catalog: I18nCatalog,
    pub entries: Vec<OfficialPluginCatalogEntry>,
}

#[derive(Debug, Clone)]
pub struct PluginInstalledVersionView {
    pub installation_id: Uuid,
    pub plugin_version: String,
    pub source_kind: String,
    pub trust_level: String,
    pub desired_state: String,
    pub availability_status: String,
    pub created_at: OffsetDateTime,
    pub is_current: bool,
}

#[derive(Debug, Clone)]
pub struct PluginFamilyView {
    pub provider_code: String,
    pub plugin_type: String,
    pub namespace: String,
    pub label_key: String,
    pub description_key: Option<String>,
    pub provider_label_key: String,
    pub protocol: String,
    pub help_url: Option<String>,
    pub default_base_url: Option<String>,
    pub model_discovery_mode: String,
    pub current_installation_id: Uuid,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub has_update: bool,
    pub installed_versions: Vec<PluginInstalledVersionView>,
}

#[derive(Debug, Clone)]
pub struct PluginFamilyCatalogView {
    pub entries: Vec<PluginFamilyView>,
    pub i18n_catalog: I18nCatalog,
}

#[derive(Debug, Clone)]
pub struct InstallPluginResult {
    pub installation: domain::PluginInstallationRecord,
    pub task: domain::PluginTaskRecord,
}

pub struct PluginManagementService<R, H> {
    repository: R,
    runtime: H,
    official_source: Arc<dyn OfficialPluginSourcePort>,
    install_root: PathBuf,
    allow_uploaded_host_extensions: bool,
}

struct InstallSourceMetadata {
    source_kind: String,
    trust_level: String,
    checksum: Option<String>,
    signature_status: Option<String>,
    signature_algorithm: Option<String>,
    signing_key_id: Option<String>,
    package_bytes: Option<Vec<u8>>,
}

impl InstallSourceMetadata {
    fn legacy_manual_import() -> Self {
        Self {
            source_kind: "uploaded".to_string(),
            trust_level: "checksum_only".to_string(),
            checksum: None,
            signature_status: Some("unsigned".to_string()),
            signature_algorithm: None,
            signing_key_id: None,
            package_bytes: None,
        }
    }
}

fn compare_plugin_versions(left: &str, right: &str) -> Ordering {
    let mut left_parts = left.split('.');
    let mut right_parts = right.split('.');

    loop {
        match (left_parts.next(), right_parts.next()) {
            (None, None) => return Ordering::Equal,
            (Some(left_part), Some(right_part)) => {
                let ordering = match (left_part.parse::<u64>(), right_part.parse::<u64>()) {
                    (Ok(left_number), Ok(right_number)) => left_number.cmp(&right_number),
                    _ => left_part.cmp(right_part),
                };

                if ordering != Ordering::Equal {
                    return ordering;
                }
            }
            (Some(left_part), None) => match left_part.parse::<u64>() {
                Ok(0) => continue,
                Ok(_) | Err(_) => return Ordering::Greater,
            },
            (None, Some(right_part)) => match right_part.parse::<u64>() {
                Ok(0) => continue,
                Ok(_) | Err(_) => return Ordering::Less,
            },
        }
    }
}

fn remove_path_if_exists(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(path)?;
    if metadata.is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }

    Ok(())
}

fn pick_latest_official_entry(
    current: OfficialPluginSourceEntry,
    candidate: OfficialPluginSourceEntry,
) -> OfficialPluginSourceEntry {
    match compare_plugin_versions(&candidate.latest_version, &current.latest_version) {
        Ordering::Greater => candidate,
        Ordering::Less => current,
        Ordering::Equal => {
            if candidate.plugin_id < current.plugin_id {
                candidate
            } else {
                current
            }
        }
    }
}

fn normalize_official_entries(
    entries: Vec<OfficialPluginSourceEntry>,
) -> Vec<OfficialPluginSourceEntry> {
    let mut grouped = HashMap::<String, OfficialPluginSourceEntry>::new();

    for entry in entries {
        let provider_code = entry.provider_code.clone();
        match grouped.remove(&provider_code) {
            Some(existing) => {
                grouped.insert(provider_code, pick_latest_official_entry(existing, entry));
            }
            None => {
                grouped.insert(provider_code, entry);
            }
        }
    }

    let mut normalized = grouped.into_values().collect::<Vec<_>>();
    normalized.sort_by(|left, right| {
        left.provider_code
            .cmp(&right.provider_code)
            .then_with(|| left.plugin_id.cmp(&right.plugin_id))
    });
    normalized
}

impl<R, H> PluginManagementService<R, H>
where
    R: AuthRepository + PluginRepository + ModelProviderRepository + NodeContributionRepository,
    H: ProviderRuntimePort,
{
    pub fn new(
        repository: R,
        runtime: H,
        official_source: Arc<dyn OfficialPluginSourcePort>,
        install_root: impl Into<PathBuf>,
    ) -> Self {
        Self {
            repository,
            runtime,
            official_source,
            install_root: install_root.into(),
            allow_uploaded_host_extensions: true,
        }
    }

    pub fn with_allow_uploaded_host_extensions(mut self, allow: bool) -> Self {
        self.allow_uploaded_host_extensions = allow;
        self
    }

    async fn transition_task(
        &self,
        task: &domain::PluginTaskRecord,
        next_status: domain::PluginTaskStatus,
        status_message: Option<String>,
        detail_json: serde_json::Value,
    ) -> Result<domain::PluginTaskRecord> {
        ensure_plugin_task_transition(task.status, next_status, "plugin_task_progress")?;
        self.repository
            .update_task_status(&UpdatePluginTaskStatusInput {
                task_id: task.id,
                status: next_status,
                status_message,
                detail_json,
            })
            .await
    }

    pub async fn list_catalog(
        &self,
        actor_user_id: Uuid,
        filter: PluginCatalogFilter,
        locales: RequestedLocales,
    ) -> Result<PluginCatalogView> {
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
        let mut i18n_catalog = BTreeMap::new();
        for installation in installations {
            let installation =
                reconcile_installation_snapshot(&self.repository, installation.id).await?;
            if !filter.matches("model_provider") {
                continue;
            }
            if !is_model_provider_installation(&installation) {
                continue;
            }
            let namespace = plugin_namespace(&installation.provider_code);
            let package = load_provider_package(&installation.installed_path).ok();
            if let Some(package) = package.as_ref() {
                merge_i18n_catalog(
                    &mut i18n_catalog,
                    trim_provider_bundles(&namespace, &package.i18n, &locales),
                );
            }
            catalog.push(PluginCatalogEntry {
                plugin_type: "model_provider".to_string(),
                namespace,
                label_key: "plugin.label".to_string(),
                description_key: Some("plugin.description".to_string()),
                provider_label_key: "provider.label".to_string(),
                help_url: provider_help_url(&installation, package.as_ref()),
                default_base_url: provider_default_base_url(&installation, package.as_ref()),
                model_discovery_mode: provider_model_discovery_mode(
                    &installation,
                    package.as_ref(),
                ),
                assigned_to_current_workspace: assigned_installation_ids.contains(&installation.id),
                installation,
            });
        }

        Ok(PluginCatalogView {
            entries: catalog,
            i18n_catalog,
        })
    }

    pub async fn list_official_catalog(
        &self,
        actor_user_id: Uuid,
        filter: PluginCatalogFilter,
        locales: RequestedLocales,
    ) -> Result<OfficialPluginCatalogView> {
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
        let official_snapshot = self.official_source.list_official_catalog().await?;
        let normalized_entries = normalize_official_entries(official_snapshot.entries);
        let mut i18n_catalog = BTreeMap::new();

        let entries = normalized_entries
            .into_iter()
            .filter(|entry| filter.matches(&entry.plugin_type))
            .map(|entry| {
                let matching_installations = installations
                    .iter()
                    .filter(|installation| installation.provider_code == entry.provider_code)
                    .collect::<Vec<_>>();
                let install_status = if matching_installations
                    .iter()
                    .any(|installation| assigned_installation_ids.contains(&installation.id))
                {
                    OfficialPluginInstallStatus::Assigned
                } else if !matching_installations.is_empty() {
                    OfficialPluginInstallStatus::Installed
                } else {
                    OfficialPluginInstallStatus::NotInstalled
                };
                merge_i18n_catalog(
                    &mut i18n_catalog,
                    trim_json_bundles(&entry.namespace, &entry.i18n_summary.bundles, &locales),
                );

                OfficialPluginCatalogEntry {
                    plugin_id: entry.plugin_id,
                    plugin_type: entry.plugin_type,
                    provider_code: entry.provider_code,
                    namespace: entry.namespace,
                    label_key: "plugin.label".to_string(),
                    description_key: Some("plugin.description".to_string()),
                    provider_label_key: "provider.label".to_string(),
                    protocol: entry.protocol,
                    latest_version: entry.latest_version,
                    selected_artifact: entry.selected_artifact,
                    help_url: entry.help_url,
                    model_discovery_mode: entry.model_discovery_mode,
                    install_status,
                }
            })
            .collect();

        Ok(OfficialPluginCatalogView {
            source_kind: official_snapshot.source.source_kind,
            source_label: official_snapshot.source.source_label,
            registry_url: official_snapshot.source.registry_url,
            i18n_catalog,
            entries,
        })
    }

    pub async fn list_families(
        &self,
        actor_user_id: Uuid,
        filter: PluginCatalogFilter,
        locales: RequestedLocales,
    ) -> Result<PluginFamilyCatalogView> {
        let actor = load_actor_context_for_user(&self.repository, actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.view.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let assignments = self
            .repository
            .list_assignments(actor.current_workspace_id)
            .await?;
        let installations = self.repository.list_installations().await?;
        let mut installation_map = HashMap::new();
        let mut installations_by_provider =
            HashMap::<String, Vec<domain::PluginInstallationRecord>>::new();
        for installation in installations {
            let installation =
                reconcile_installation_snapshot(&self.repository, installation.id).await?;
            installation_map.insert(installation.id, installation.clone());
            installations_by_provider
                .entry(installation.provider_code.clone())
                .or_default()
                .push(installation);
        }
        for versions in installations_by_provider.values_mut() {
            versions.sort_by(|left, right| {
                right
                    .created_at
                    .cmp(&left.created_at)
                    .then_with(|| right.id.cmp(&left.id))
            });
        }
        let official_by_provider = self.official_source.list_official_catalog().await?.entries;
        let official_by_provider = normalize_official_entries(official_by_provider)
            .into_iter()
            .map(|entry| (entry.provider_code.clone(), entry))
            .collect::<HashMap<_, _>>();

        let mut families = Vec::with_capacity(assignments.len());
        let mut i18n_catalog = BTreeMap::new();
        for assignment in assignments {
            if !filter.matches("model_provider") {
                continue;
            }
            let current = installation_map
                .get(&assignment.installation_id)
                .cloned()
                .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
            if !is_model_provider_installation(&current) {
                continue;
            }
            let namespace = plugin_namespace(&current.provider_code);
            let package = load_provider_package(&current.installed_path).ok();
            if let Some(package) = package.as_ref() {
                merge_i18n_catalog(
                    &mut i18n_catalog,
                    trim_provider_bundles(&namespace, &package.i18n, &locales),
                );
            }
            let latest_version = official_by_provider
                .get(&assignment.provider_code)
                .map(|entry| entry.latest_version.clone());
            let installed_versions = installations_by_provider
                .get(&assignment.provider_code)
                .into_iter()
                .flatten()
                .map(|installation| PluginInstalledVersionView {
                    installation_id: installation.id,
                    plugin_version: installation.plugin_version.clone(),
                    source_kind: installation.source_kind.clone(),
                    trust_level: installation.trust_level.clone(),
                    desired_state: installation.desired_state.as_str().to_string(),
                    availability_status: installation.availability_status.as_str().to_string(),
                    created_at: installation.created_at,
                    is_current: installation.id == current.id,
                })
                .collect();

            families.push(PluginFamilyView {
                provider_code: current.provider_code.clone(),
                plugin_type: "model_provider".to_string(),
                namespace,
                label_key: "plugin.label".to_string(),
                description_key: Some("plugin.description".to_string()),
                provider_label_key: "provider.label".to_string(),
                protocol: current.protocol.clone(),
                help_url: provider_help_url(&current, package.as_ref()),
                default_base_url: provider_default_base_url(&current, package.as_ref()),
                model_discovery_mode: provider_model_discovery_mode(&current, package.as_ref()),
                current_installation_id: current.id,
                current_version: current.plugin_version.clone(),
                latest_version: latest_version.clone(),
                has_update: latest_version
                    .as_deref()
                    .is_some_and(|version| version != current.plugin_version),
                installed_versions,
            });
        }
        families.sort_by(|left, right| left.provider_code.cmp(&right.provider_code));

        Ok(PluginFamilyCatalogView {
            entries: families,
            i18n_catalog,
        })
    }

    pub async fn install_plugin(
        &self,
        command: InstallPluginCommand,
    ) -> Result<InstallPluginResult> {
        let package_root = command.package_root.clone();
        self.install_plugin_with_metadata(
            command,
            InstallSourceMetadata::legacy_manual_import(),
            json!({
                "install_kind": "legacy_manual_import",
                "package_root": package_root,
            }),
        )
        .await
    }

    pub async fn reconcile_all_installations(&self) -> Result<()> {
        for installation in self.repository.list_installations().await? {
            let _ = reconcile_installation_snapshot(&self.repository, installation.id).await?;
        }

        Ok(())
    }

    pub async fn install_uploaded_plugin(
        &self,
        command: InstallUploadedPluginCommand,
    ) -> Result<InstallPluginResult> {
        let file_name = command.file_name.clone();
        let intake = intake_package_bytes(
            &command.package_bytes,
            &PackageIntakePolicy {
                source_kind: "uploaded".to_string(),
                trust_mode: "allow_unsigned".to_string(),
                expected_artifact_sha256: None,
                trusted_public_keys: self.official_source.trusted_public_keys(),
                original_filename: Some(file_name.clone()),
            },
        )
        .await?;
        self.install_intake_result(
            command.actor_user_id,
            intake,
            Some(command.package_bytes),
            json!({
                "install_kind": "upload",
                "file_name": file_name,
            }),
        )
        .await
    }

    pub async fn install_official_plugin(
        &self,
        command: InstallOfficialPluginCommand,
    ) -> Result<InstallPluginResult> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let snapshot = self.official_source.list_official_catalog().await?;
        let entry = snapshot
            .entries
            .into_iter()
            .find(|item| item.plugin_id == command.plugin_id)
            .ok_or(ControlPlaneError::NotFound("official_plugin"))?;
        let downloaded = self.official_source.download_plugin(&entry).await?;
        let intake = intake_package_bytes(
            &downloaded.package_bytes,
            &PackageIntakePolicy {
                source_kind: snapshot.source.source_kind.clone(),
                trust_mode: entry.trust_mode.clone(),
                expected_artifact_sha256: Some(entry.selected_artifact.checksum.clone()),
                trusted_public_keys: self.official_source.trusted_public_keys(),
                original_filename: Some(downloaded.file_name.clone()),
            },
        )
        .await?;
        let result = async {
            let install = self
                .install_intake_result(
                    command.actor_user_id,
                    intake,
                    Some(downloaded.package_bytes.clone()),
                    json!({
                        "install_kind": "official_source",
                        "plugin_id": command.plugin_id,
                        "file_name": downloaded.file_name,
                    }),
                )
                .await?;
            if is_host_extension_installation(&install.installation) {
                return Ok::<InstallPluginResult, anyhow::Error>(install);
            }
            self.enable_plugin(EnablePluginCommand {
                actor_user_id: command.actor_user_id,
                installation_id: install.installation.id,
            })
            .await?;
            let task = self
                .assign_plugin(AssignPluginCommand {
                    actor_user_id: command.actor_user_id,
                    installation_id: install.installation.id,
                })
                .await?;
            let installation = self
                .repository
                .get_installation(install.installation.id)
                .await?
                .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
            Ok::<InstallPluginResult, anyhow::Error>(InstallPluginResult { installation, task })
        }
        .await;
        result
    }

    pub async fn upgrade_latest(
        &self,
        command: UpgradeLatestPluginFamilyCommand,
    ) -> Result<domain::PluginTaskRecord> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let current = self
            .load_current_family_installation(actor.current_workspace_id, &command.provider_code)
            .await?;
        let official_entry = self.official_source.list_official_catalog().await?.entries;
        let official_entry = normalize_official_entries(official_entry)
            .into_iter()
            .find(|entry| entry.provider_code == command.provider_code)
            .ok_or(ControlPlaneError::NotFound("official_plugin"))?;
        let installed_target = self
            .repository
            .list_installations()
            .await?
            .into_iter()
            .find(|installation| {
                installation.provider_code == command.provider_code
                    && installation.plugin_version == official_entry.latest_version
            });
        let target = match installed_target {
            Some(installation) => installation,
            None => {
                let downloaded = self
                    .official_source
                    .download_plugin(&official_entry)
                    .await?;
                let snapshot = self.official_source.list_official_catalog().await?;
                let snapshot_entry = normalize_official_entries(snapshot.entries)
                    .into_iter()
                    .find(|entry| entry.provider_code == command.provider_code)
                    .ok_or(ControlPlaneError::NotFound("official_plugin"))?;
                let intake = intake_package_bytes(
                    &downloaded.package_bytes,
                    &PackageIntakePolicy {
                        source_kind: snapshot.source.source_kind.clone(),
                        trust_mode: snapshot_entry.trust_mode.clone(),
                        expected_artifact_sha256: Some(
                            snapshot_entry.selected_artifact.checksum.clone(),
                        ),
                        trusted_public_keys: self.official_source.trusted_public_keys(),
                        original_filename: Some(downloaded.file_name.clone()),
                    },
                )
                .await?;
                self.install_intake_result(
                    command.actor_user_id,
                    intake,
                    Some(downloaded.package_bytes.clone()),
                    json!({
                        "install_kind": "official_upgrade",
                        "plugin_id": snapshot_entry.plugin_id,
                        "provider_code": snapshot_entry.provider_code,
                        "file_name": downloaded.file_name,
                    }),
                )
                .await?
                .installation
            }
        };
        if current.id == target.id {
            return Err(ControlPlaneError::Conflict("plugin_version_already_current").into());
        }

        self.switch_family_installation(
            &actor,
            &command.provider_code,
            &current,
            &target,
            command.actor_user_id,
        )
        .await
    }

    async fn install_intake_result(
        &self,
        actor_user_id: Uuid,
        intake: PackageIntakeResult,
        package_bytes: Option<Vec<u8>>,
        detail_json: serde_json::Value,
    ) -> Result<InstallPluginResult> {
        let package_root = intake.extracted_root.clone();
        let result = self
            .install_plugin_with_metadata(
                InstallPluginCommand {
                    actor_user_id,
                    package_root: package_root.display().to_string(),
                },
                InstallSourceMetadata {
                    source_kind: intake.source_kind,
                    trust_level: intake.trust_level,
                    checksum: intake.checksum,
                    signature_status: Some(intake.signature_status),
                    signature_algorithm: intake.signature_algorithm,
                    signing_key_id: intake.signing_key_id,
                    package_bytes,
                },
                detail_json,
            )
            .await;
        let _ = fs::remove_dir_all(&package_root);
        result
    }

    async fn install_plugin_with_metadata(
        &self,
        command: InstallPluginCommand,
        source_metadata: InstallSourceMetadata,
        detail_json: serde_json::Value,
    ) -> Result<InstallPluginResult> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let task_id = Uuid::now_v7();
        let task = self
            .repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: None,
                workspace_id: None,
                provider_code: "pending_provider".to_string(),
                task_kind: domain::PluginTaskKind::Install,
                status: domain::PluginTaskStatus::Queued,
                status_message: Some("pending".to_string()),
                detail_json: detail_json.clone(),
                actor_user_id: Some(command.actor_user_id),
            })
            .await?;
        let running_task = self
            .transition_task(
                &task,
                domain::PluginTaskStatus::Running,
                Some("running".to_string()),
                detail_json.clone(),
            )
            .await?;

        let installation_result = async {
            let manifest = load_plugin_manifest(&command.package_root)?;
            let plugin_code = plugin_code_from_plugin_id(&manifest.plugin_id)?;
            let install_path = self
                .install_root
                .join("installed")
                .join(&plugin_code)
                .join(&manifest.version);
            let package_archive_path = self
                .install_root
                .join("packages")
                .join(&plugin_code)
                .join(format!("{}.1flowbasepkg", manifest.plugin_id));
            if let Some(package_bytes) = source_metadata.package_bytes.as_ref() {
                if let Some(parent) = package_archive_path.parent() {
                    fs::create_dir_all(parent).with_context(|| {
                        format!(
                            "failed to create plugin package archive directory {}",
                            parent.display()
                        )
                    })?;
                }
                fs::write(&package_archive_path, package_bytes).with_context(|| {
                    format!(
                        "failed to persist plugin package archive at {}",
                        package_archive_path.display()
                    )
                })?;
            }
            copy_installation_artifact(Path::new(&command.package_root), &install_path)?;
            let manifest_fingerprint =
                compute_manifest_fingerprint(&install_path.join("manifest.yaml"))
                    .map_err(map_framework_error)?;
            if is_host_extension_manifest(&manifest) {
                ensure_root_actor(&actor)?;
                ensure_uploaded_host_extensions_enabled(self.allow_uploaded_host_extensions)?;
                let installation = self
                    .repository
                    .upsert_installation(&UpsertPluginInstallationInput {
                        installation_id: Uuid::now_v7(),
                        provider_code: plugin_code.clone(),
                        plugin_id: manifest.plugin_id.clone(),
                        plugin_version: manifest.version.clone(),
                        contract_version: manifest.contract_version.clone(),
                        protocol: manifest.runtime.protocol.clone(),
                        display_name: manifest.display_name.clone(),
                        source_kind: source_metadata.source_kind.clone(),
                        trust_level: source_metadata.trust_level.clone(),
                        verification_status: domain::PluginVerificationStatus::Valid,
                        desired_state: domain::PluginDesiredState::PendingRestart,
                        artifact_status: domain::PluginArtifactStatus::Ready,
                        runtime_status: domain::PluginRuntimeStatus::Inactive,
                        availability_status: derive_availability_status(
                            domain::PluginDesiredState::PendingRestart,
                            domain::PluginArtifactStatus::Ready,
                            domain::PluginRuntimeStatus::Inactive,
                        ),
                        package_path: source_metadata.package_bytes.as_ref().map(|_| {
                            package_archive_path.display().to_string()
                        }),
                        installed_path: install_path.display().to_string(),
                        checksum: source_metadata.checksum.clone(),
                        manifest_fingerprint: Some(manifest_fingerprint),
                        signature_status: source_metadata.signature_status.clone(),
                        signature_algorithm: source_metadata.signature_algorithm.clone(),
                        signing_key_id: source_metadata.signing_key_id.clone(),
                        last_load_error: None,
                        metadata_json: json!({}),
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
                            "restart_required": true,
                        }),
                    ))
                    .await?;
                return Ok::<domain::PluginInstallationRecord, anyhow::Error>(installation);
            }

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
                    display_name: installed_package.provider.display_name.clone(),
                    source_kind: source_metadata.source_kind.clone(),
                    trust_level: source_metadata.trust_level.clone(),
                    verification_status: domain::PluginVerificationStatus::Valid,
                    desired_state: domain::PluginDesiredState::Disabled,
                    artifact_status: domain::PluginArtifactStatus::Ready,
                    runtime_status: domain::PluginRuntimeStatus::Inactive,
                    availability_status: derive_availability_status(
                        domain::PluginDesiredState::Disabled,
                        domain::PluginArtifactStatus::Ready,
                        domain::PluginRuntimeStatus::Inactive,
                    ),
                    package_path: source_metadata.package_bytes.as_ref().map(|_| {
                        package_archive_path.display().to_string()
                    }),
                    installed_path: install_path.display().to_string(),
                    checksum: source_metadata.checksum.clone(),
                    manifest_fingerprint: Some(manifest_fingerprint),
                    signature_status: source_metadata.signature_status.clone(),
                    signature_algorithm: source_metadata.signature_algorithm.clone(),
                    signing_key_id: source_metadata.signing_key_id.clone(),
                    last_load_error: None,
                    metadata_json: json!({
                        "help_url": installed_package.provider.help_url,
                        "default_base_url": installed_package.provider.default_base_url,
                        "model_discovery_mode": format!("{:?}", installed_package.provider.model_discovery_mode).to_ascii_lowercase(),
                        "supported_model_types": ["llm"],
                    }),
                    actor_user_id: command.actor_user_id,
                })
                .await?;
            let manifest = load_plugin_manifest(&install_path)?;
            self.repository
                .replace_installation_node_contributions(
                    &build_node_contribution_sync_input(&installation, &manifest),
                )
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
                let installed_message = if is_host_extension_installation(&installation) {
                    "installed; restart required"
                } else {
                    "installed"
                };
                let task = self
                    .transition_task(
                        &running_task,
                        domain::PluginTaskStatus::Succeeded,
                        Some(installed_message.to_string()),
                        json!({
                            "installation_id": installation.id,
                            "provider_code": installation.provider_code,
                            "plugin_id": installation.plugin_id,
                            "installed_path": installation.installed_path,
                        }),
                    )
                    .await?;
                Ok(InstallPluginResult { installation, task })
            }
            Err(error) => {
                let _ = self
                    .transition_task(
                        &running_task,
                        domain::PluginTaskStatus::Failed,
                        Some(error.to_string()),
                        detail_json,
                    )
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
        if is_host_extension_installation(&installation) {
            return Err(ControlPlaneError::Conflict("plugin_installation_requires_restart").into());
        }

        let task_id = Uuid::now_v7();
        let task = self
            .repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: Some(command.installation_id),
                workspace_id: None,
                provider_code: installation.provider_code.clone(),
                task_kind: domain::PluginTaskKind::Enable,
                status: domain::PluginTaskStatus::Queued,
                status_message: Some("pending".to_string()),
                detail_json: json!({}),
                actor_user_id: Some(command.actor_user_id),
            })
            .await?;
        let running_task = self
            .transition_task(
                &task,
                domain::PluginTaskStatus::Running,
                Some("running".to_string()),
                json!({}),
            )
            .await?;

        let enable_result = async {
            let updated = self
                .repository
                .update_desired_state(&UpdatePluginDesiredStateInput {
                    installation_id: command.installation_id,
                    desired_state: domain::PluginDesiredState::ActiveRequested,
                    availability_status: derive_availability_status(
                        domain::PluginDesiredState::ActiveRequested,
                        installation.artifact_status,
                        installation.runtime_status,
                    ),
                })
                .await?;
            let loaded = match self.runtime.ensure_loaded(&updated).await {
                Ok(()) => {
                    self.repository
                        .update_runtime_snapshot(&UpdatePluginRuntimeSnapshotInput {
                            installation_id: updated.id,
                            runtime_status: domain::PluginRuntimeStatus::Active,
                            availability_status: derive_availability_status(
                                updated.desired_state,
                                updated.artifact_status,
                                domain::PluginRuntimeStatus::Active,
                            ),
                            last_load_error: None,
                        })
                        .await?
                }
                Err(error) => {
                    self.repository
                        .update_runtime_snapshot(&UpdatePluginRuntimeSnapshotInput {
                            installation_id: updated.id,
                            runtime_status: domain::PluginRuntimeStatus::LoadFailed,
                            availability_status: derive_availability_status(
                                updated.desired_state,
                                updated.artifact_status,
                                domain::PluginRuntimeStatus::LoadFailed,
                            ),
                            last_load_error: Some(error.to_string()),
                        })
                        .await?;
                    return Err(error);
                }
            };
            self.repository
                .append_audit_log(&audit_log(
                    Some(actor.current_workspace_id),
                    Some(command.actor_user_id),
                    "plugin_installation",
                    Some(loaded.id),
                    "plugin.enabled",
                    json!({
                        "provider_code": loaded.provider_code,
                    }),
                ))
                .await?;
            Ok::<domain::PluginInstallationRecord, anyhow::Error>(loaded)
        }
        .await;

        match enable_result {
            Ok(updated) => {
                self.transition_task(
                    &running_task,
                    domain::PluginTaskStatus::Succeeded,
                    Some("enabled".to_string()),
                    json!({
                        "installation_id": updated.id,
                        "enabled": !matches!(
                            updated.desired_state,
                            domain::PluginDesiredState::Disabled
                        ),
                    }),
                )
                .await
            }
            Err(error) => {
                let _ = self
                    .transition_task(
                        &running_task,
                        domain::PluginTaskStatus::Failed,
                        Some(error.to_string()),
                        json!({
                            "installation_id": command.installation_id,
                        }),
                    )
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
        if !is_model_provider_installation(&installation) {
            return Err(ControlPlaneError::Conflict("plugin_assignment_not_supported").into());
        }
        if matches!(
            installation.desired_state,
            domain::PluginDesiredState::Disabled
        ) {
            return Err(ControlPlaneError::Conflict("plugin_installation_disabled").into());
        }

        let task_id = Uuid::now_v7();
        let task = self
            .repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: Some(command.installation_id),
                workspace_id: Some(actor.current_workspace_id),
                provider_code: installation.provider_code.clone(),
                task_kind: domain::PluginTaskKind::Assign,
                status: domain::PluginTaskStatus::Queued,
                status_message: Some("pending".to_string()),
                detail_json: json!({}),
                actor_user_id: Some(command.actor_user_id),
            })
            .await?;
        let running_task = self
            .transition_task(
                &task,
                domain::PluginTaskStatus::Running,
                Some("running".to_string()),
                json!({}),
            )
            .await?;

        let assign_result = async {
            self.repository
                .create_assignment(&CreatePluginAssignmentInput {
                    installation_id: command.installation_id,
                    workspace_id: actor.current_workspace_id,
                    provider_code: installation.provider_code.clone(),
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
                self.transition_task(
                    &running_task,
                    domain::PluginTaskStatus::Succeeded,
                    Some("assigned".to_string()),
                    json!({
                        "installation_id": command.installation_id,
                        "workspace_id": actor.current_workspace_id,
                    }),
                )
                .await
            }
            Err(error) => {
                let _ = self
                    .transition_task(
                        &running_task,
                        domain::PluginTaskStatus::Failed,
                        Some(error.to_string()),
                        json!({
                            "installation_id": command.installation_id,
                            "workspace_id": actor.current_workspace_id,
                        }),
                    )
                    .await;
                Err(error)
            }
        }
    }

    pub async fn switch_version(
        &self,
        command: SwitchPluginVersionCommand,
    ) -> Result<domain::PluginTaskRecord> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let current = self
            .load_current_family_installation(actor.current_workspace_id, &command.provider_code)
            .await?;
        let target = self
            .repository
            .get_installation(command.target_installation_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
        if target.provider_code != command.provider_code {
            return Err(ControlPlaneError::InvalidInput("plugin_family_target_mismatch").into());
        }
        if current.id == target.id {
            return Err(ControlPlaneError::Conflict("plugin_version_already_current").into());
        }

        self.switch_family_installation(
            &actor,
            &command.provider_code,
            &current,
            &target,
            command.actor_user_id,
        )
        .await
    }

    pub async fn delete_family(
        &self,
        command: DeletePluginFamilyCommand,
    ) -> Result<domain::PluginTaskRecord> {
        let actor = load_actor_context_for_user(&self.repository, command.actor_user_id).await?;
        ensure_permission(&actor, "plugin_config.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let installations = self
            .repository
            .list_installations()
            .await?
            .into_iter()
            .filter(|installation| installation.provider_code == command.provider_code)
            .collect::<Vec<_>>();
        if installations.is_empty() {
            return Err(ControlPlaneError::NotFound("plugin_family").into());
        }

        let current_installation_id = self
            .repository
            .list_assignments(actor.current_workspace_id)
            .await?
            .into_iter()
            .find(|assignment| assignment.provider_code == command.provider_code)
            .map(|assignment| assignment.installation_id)
            .or_else(|| installations.first().map(|installation| installation.id));

        let task_id = Uuid::now_v7();
        let task = self
            .repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: current_installation_id,
                workspace_id: Some(actor.current_workspace_id),
                provider_code: command.provider_code.clone(),
                task_kind: domain::PluginTaskKind::Uninstall,
                status: domain::PluginTaskStatus::Queued,
                status_message: Some("pending".into()),
                detail_json: json!({}),
                actor_user_id: Some(command.actor_user_id),
            })
            .await?;
        let running_task = self
            .transition_task(
                &task,
                domain::PluginTaskStatus::Running,
                Some("running".into()),
                json!({
                    "provider_code": command.provider_code,
                    "installation_ids": installations
                        .iter()
                        .map(|installation| installation.id)
                        .collect::<Vec<_>>(),
                }),
            )
            .await?;

        let delete_result = async {
            let instances = self
                .repository
                .list_instances_by_provider_code(&command.provider_code)
                .await?;
            let mut referenced_flow_count = 0_u64;
            for instance in &instances {
                referenced_flow_count += self
                    .repository
                    .count_instance_references(instance.workspace_id, instance.id)
                    .await?;
            }

            for instance in &instances {
                self.repository
                    .delete_instance(instance.workspace_id, instance.id)
                    .await?;
            }

            let mut removed_paths = HashSet::<PathBuf>::new();
            for installation in &installations {
                self.repository.delete_installation(installation.id).await?;

                removed_paths.insert(PathBuf::from(&installation.installed_path));
                if let Some(package_path) = &installation.package_path {
                    removed_paths.insert(PathBuf::from(package_path));
                }
            }

            for path in &removed_paths {
                remove_path_if_exists(path)?;
            }

            self.repository
                .append_audit_log(&audit_log(
                    Some(actor.current_workspace_id),
                    Some(command.actor_user_id),
                    "plugin_family",
                    None,
                    "plugin.family_deleted",
                    json!({
                        "provider_code": command.provider_code,
                        "deleted_instance_count": instances.len(),
                        "deleted_installation_count": installations.len(),
                        "referenced_flow_count": referenced_flow_count,
                    }),
                ))
                .await?;

            Ok::<(usize, usize, u64), anyhow::Error>((
                instances.len(),
                installations.len(),
                referenced_flow_count,
            ))
        }
        .await;

        match delete_result {
            Ok((deleted_instance_count, deleted_installation_count, referenced_flow_count)) => {
                self.transition_task(
                    &running_task,
                    domain::PluginTaskStatus::Succeeded,
                    Some("deleted".into()),
                    json!({
                        "provider_code": command.provider_code,
                        "deleted_instance_count": deleted_instance_count,
                        "deleted_installation_count": deleted_installation_count,
                        "referenced_flow_count": referenced_flow_count,
                    }),
                )
                .await
            }
            Err(error) => {
                let _ = self
                    .transition_task(
                        &running_task,
                        domain::PluginTaskStatus::Failed,
                        Some(error.to_string()),
                        json!({
                            "provider_code": command.provider_code,
                        }),
                    )
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

    async fn load_current_family_installation(
        &self,
        workspace_id: Uuid,
        provider_code: &str,
    ) -> Result<domain::PluginInstallationRecord> {
        let assignment = self
            .repository
            .list_assignments(workspace_id)
            .await?
            .into_iter()
            .find(|item| item.provider_code == provider_code)
            .ok_or(ControlPlaneError::NotFound("plugin_assignment"))?;

        self.repository
            .get_installation(assignment.installation_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("plugin_installation").into())
    }

    async fn switch_family_installation(
        &self,
        actor: &domain::ActorContext,
        provider_code: &str,
        current: &domain::PluginInstallationRecord,
        target: &domain::PluginInstallationRecord,
        actor_user_id: Uuid,
    ) -> Result<domain::PluginTaskRecord> {
        if matches!(target.desired_state, domain::PluginDesiredState::Disabled) {
            self.enable_plugin(EnablePluginCommand {
                actor_user_id,
                installation_id: target.id,
            })
            .await?;
        }

        let task_id = Uuid::now_v7();
        let task = self
            .repository
            .create_task(&CreatePluginTaskInput {
                task_id,
                installation_id: Some(target.id),
                workspace_id: Some(actor.current_workspace_id),
                provider_code: provider_code.to_string(),
                task_kind: domain::PluginTaskKind::SwitchVersion,
                status: domain::PluginTaskStatus::Queued,
                status_message: Some("pending".into()),
                detail_json: json!({}),
                actor_user_id: Some(actor_user_id),
            })
            .await?;
        let running_task = self
            .transition_task(
                &task,
                domain::PluginTaskStatus::Running,
                Some("running".into()),
                json!({
                    "provider_code": provider_code,
                    "previous_installation_id": current.id,
                    "previous_version": current.plugin_version,
                    "target_installation_id": target.id,
                    "target_version": target.plugin_version,
                }),
            )
            .await?;

        let switch_result = async {
            let package = load_provider_package(&target.installed_path)?;
            let migrated_instances = self
                .repository
                .reassign_instances_to_installation(&ReassignModelProviderInstancesInput {
                    workspace_id: actor.current_workspace_id,
                    provider_code: provider_code.to_string(),
                    target_installation_id: target.id,
                    target_protocol: target.protocol.clone(),
                    updated_by: actor_user_id,
                })
                .await?;

            for instance in &migrated_instances {
                self.repository
                    .upsert_catalog_cache(&UpsertModelProviderCatalogCacheInput {
                        provider_instance_id: instance.id,
                        model_discovery_mode: map_model_discovery_mode(
                            package.provider.model_discovery_mode,
                        ),
                        refresh_status: domain::ModelProviderCatalogRefreshStatus::Idle,
                        source: map_catalog_source(package.provider.model_discovery_mode),
                        models_json: json!([]),
                        last_error_message: None,
                        refreshed_at: None,
                    })
                    .await?;
            }
            self.repository
                .create_assignment(&CreatePluginAssignmentInput {
                    installation_id: target.id,
                    workspace_id: actor.current_workspace_id,
                    provider_code: provider_code.to_string(),
                    actor_user_id,
                })
                .await?;
            self.repository
                .append_audit_log(&audit_log(
                    Some(actor.current_workspace_id),
                    Some(actor_user_id),
                    "plugin_assignment",
                    Some(target.id),
                    "plugin.version_switched",
                    json!({
                        "provider_code": provider_code,
                        "previous_installation_id": current.id,
                        "previous_version": current.plugin_version,
                        "target_installation_id": target.id,
                        "target_version": target.plugin_version,
                    }),
                ))
                .await?;
            self.repository
                .append_audit_log(&audit_log(
                    Some(actor.current_workspace_id),
                    Some(actor_user_id),
                    "model_provider_instance",
                    None,
                    "provider.instances_migrated_after_plugin_switch",
                    json!({
                        "provider_code": provider_code,
                        "migrated_instance_count": migrated_instances.len(),
                    }),
                ))
                .await?;
            Ok::<usize, anyhow::Error>(migrated_instances.len())
        }
        .await;

        match switch_result {
            Ok(migrated_instance_count) => {
                self.transition_task(
                    &running_task,
                    domain::PluginTaskStatus::Succeeded,
                    Some("switched".into()),
                    json!({
                        "provider_code": provider_code,
                        "previous_installation_id": current.id,
                        "previous_version": current.plugin_version,
                        "target_installation_id": target.id,
                        "target_version": target.plugin_version,
                        "migrated_instance_count": migrated_instance_count,
                    }),
                )
                .await
            }
            Err(error) => {
                let _ = self
                    .transition_task(
                        &running_task,
                        domain::PluginTaskStatus::Failed,
                        Some(error.to_string()),
                        json!({
                            "provider_code": provider_code,
                            "previous_installation_id": current.id,
                            "target_installation_id": target.id,
                        }),
                    )
                    .await;
                Err(error)
            }
        }
    }
}

fn provider_help_url(
    installation: &domain::PluginInstallationRecord,
    package: Option<&ProviderPackage>,
) -> Option<String> {
    package
        .and_then(|package| package.provider.help_url.clone())
        .or_else(|| metadata_string(&installation.metadata_json, "help_url"))
}

fn provider_default_base_url(
    installation: &domain::PluginInstallationRecord,
    package: Option<&ProviderPackage>,
) -> Option<String> {
    package
        .and_then(|package| package.provider.default_base_url.clone())
        .or_else(|| metadata_string(&installation.metadata_json, "default_base_url"))
}

fn provider_model_discovery_mode(
    installation: &domain::PluginInstallationRecord,
    package: Option<&ProviderPackage>,
) -> String {
    package
        .map(|package| format!("{:?}", package.provider.model_discovery_mode).to_ascii_lowercase())
        .or_else(|| metadata_string(&installation.metadata_json, "model_discovery_mode"))
        .unwrap_or_else(|| "unknown".to_string())
}

fn metadata_string(metadata: &serde_json::Value, key: &str) -> Option<String> {
    metadata.get(key)?.as_str().map(str::to_string)
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

fn load_plugin_manifest(path: impl AsRef<Path>) -> Result<PluginManifestV1> {
    let manifest_path = path.as_ref().join("manifest.yaml");
    let raw = fs::read_to_string(&manifest_path).with_context(|| {
        format!(
            "failed to read plugin manifest at {}",
            manifest_path.display()
        )
    })?;
    parse_plugin_manifest(&raw).map_err(map_framework_error)
}

fn build_node_contribution_sync_input(
    installation: &domain::PluginInstallationRecord,
    manifest: &PluginManifestV1,
) -> ReplaceInstallationNodeContributionsInput {
    ReplaceInstallationNodeContributionsInput {
        installation_id: installation.id,
        provider_code: installation.provider_code.clone(),
        plugin_id: installation.plugin_id.clone(),
        plugin_version: installation.plugin_version.clone(),
        entries: manifest
            .node_contributions
            .iter()
            .map(|entry| NodeContributionRegistryInput {
                contribution_code: entry.contribution_code.clone(),
                node_shell: entry.node_shell.clone(),
                category: entry.category.clone(),
                title: entry.title.clone(),
                description: entry.description.clone(),
                icon: entry.icon.clone(),
                schema_ui: entry.schema_ui.clone(),
                schema_version: entry.schema_version.clone(),
                output_schema: entry.output_schema.clone(),
                required_auth: entry.required_auth.clone(),
                visibility: entry.visibility.clone(),
                experimental: entry.experimental,
                dependency_installation_kind: entry.dependency.installation_kind.clone(),
                dependency_plugin_version_range: entry.dependency.plugin_version_range.clone(),
            })
            .collect(),
    }
}

fn map_model_discovery_mode(
    mode: plugin_framework::provider_contract::ModelDiscoveryMode,
) -> domain::ModelProviderDiscoveryMode {
    match mode {
        plugin_framework::provider_contract::ModelDiscoveryMode::Static => {
            domain::ModelProviderDiscoveryMode::Static
        }
        plugin_framework::provider_contract::ModelDiscoveryMode::Dynamic => {
            domain::ModelProviderDiscoveryMode::Dynamic
        }
        plugin_framework::provider_contract::ModelDiscoveryMode::Hybrid => {
            domain::ModelProviderDiscoveryMode::Hybrid
        }
    }
}

fn map_catalog_source(
    mode: plugin_framework::provider_contract::ModelDiscoveryMode,
) -> domain::ModelProviderCatalogSource {
    match mode {
        plugin_framework::provider_contract::ModelDiscoveryMode::Static => {
            domain::ModelProviderCatalogSource::Static
        }
        plugin_framework::provider_contract::ModelDiscoveryMode::Dynamic => {
            domain::ModelProviderCatalogSource::Dynamic
        }
        plugin_framework::provider_contract::ModelDiscoveryMode::Hybrid => {
            domain::ModelProviderCatalogSource::Hybrid
        }
    }
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
