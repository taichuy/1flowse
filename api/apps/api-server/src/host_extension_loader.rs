use std::{fs, path::Path};

use anyhow::{bail, Context, Result};
use control_plane::{
    host_extension::{is_host_extension_installation, is_host_extension_manifest},
    plugin_lifecycle::{derive_availability_status, reconcile_installation_snapshot},
    ports::{PluginRepository, UpdatePluginDesiredStateInput, UpdatePluginRuntimeSnapshotInput},
};
use domain::{PluginArtifactStatus, PluginDesiredState, PluginRuntimeStatus};
use plugin_framework::{
    scan_host_extension_dropins_with_policy, HostExtensionDropinPolicy, HostExtensionDropinScan,
};

use crate::app_state::ApiState;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct HostExtensionStartupSummary {
    pub detected_dropin_count: usize,
    pub pending_restart_count: usize,
    pub loaded_count: usize,
    pub failed_count: usize,
    pub skipped_count: usize,
    pub warnings: Vec<String>,
}

pub async fn load_host_extensions_at_startup(
    state: &ApiState,
) -> Result<HostExtensionStartupSummary> {
    let detected = scan_host_extensions_from_dropins(state)?;
    let pending = state.store.list_pending_restart_host_extensions().await?;
    let mut summary = HostExtensionStartupSummary {
        detected_dropin_count: detected.installations.len(),
        pending_restart_count: pending.len(),
        loaded_count: 0,
        failed_count: 0,
        skipped_count: 0,
        warnings: detected.warnings,
    };

    for installation in pending {
        match activate_pending_restart_installation(state, installation.id).await? {
            ActivationOutcome::Loaded => summary.loaded_count += 1,
            ActivationOutcome::Failed => summary.failed_count += 1,
            ActivationOutcome::Skipped => summary.skipped_count += 1,
        }
    }

    Ok(summary)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ActivationOutcome {
    Loaded,
    Failed,
    Skipped,
}

fn scan_host_extensions_from_dropins(state: &ApiState) -> Result<HostExtensionDropinScan> {
    let dropin_root = Path::new(&state.host_extension_dropin_root);
    if !dropin_root.exists() {
        return Ok(HostExtensionDropinScan {
            installations: Vec::new(),
            warnings: Vec::new(),
        });
    }
    if !dropin_root.is_dir() {
        bail!(
            "host extension dropin root must be a directory: {}",
            dropin_root.display()
        );
    }

    scan_host_extension_dropins_with_policy(
        dropin_root,
        HostExtensionDropinPolicy {
            allow_unverified_filesystem_dropins: state.allow_unverified_filesystem_dropins,
        },
    )
    .map_err(anyhow::Error::from)
}

async fn activate_pending_restart_installation(
    state: &ApiState,
    installation_id: uuid::Uuid,
) -> Result<ActivationOutcome> {
    let installation = reconcile_installation_snapshot(&state.store, installation_id).await?;
    if !is_host_extension_installation(&installation) {
        return Ok(ActivationOutcome::Skipped);
    }
    if installation.artifact_status != PluginArtifactStatus::Ready {
        return Ok(ActivationOutcome::Skipped);
    }

    let desired_state = PluginDesiredState::ActiveRequested;
    let installation = state
        .store
        .update_desired_state(&UpdatePluginDesiredStateInput {
            installation_id,
            desired_state,
            availability_status: derive_availability_status(
                desired_state,
                installation.artifact_status,
                installation.runtime_status,
            ),
        })
        .await?;

    match validate_host_extension_installation(&installation) {
        Ok(()) => {
            state
                .store
                .update_runtime_snapshot(&UpdatePluginRuntimeSnapshotInput {
                    installation_id,
                    runtime_status: PluginRuntimeStatus::Active,
                    availability_status: derive_availability_status(
                        desired_state,
                        installation.artifact_status,
                        PluginRuntimeStatus::Active,
                    ),
                    last_load_error: None,
                })
                .await?;
            Ok(ActivationOutcome::Loaded)
        }
        Err(error) => {
            state
                .store
                .update_runtime_snapshot(&UpdatePluginRuntimeSnapshotInput {
                    installation_id,
                    runtime_status: PluginRuntimeStatus::LoadFailed,
                    availability_status: derive_availability_status(
                        desired_state,
                        installation.artifact_status,
                        PluginRuntimeStatus::LoadFailed,
                    ),
                    last_load_error: Some(error.to_string()),
                })
                .await?;
            Ok(ActivationOutcome::Failed)
        }
    }
}

fn validate_host_extension_installation(
    installation: &domain::PluginInstallationRecord,
) -> Result<()> {
    let install_root = Path::new(&installation.installed_path);
    let manifest_path = install_root.join("manifest.yaml");
    let manifest_raw = fs::read_to_string(&manifest_path)
        .with_context(|| format!("failed to read {}", manifest_path.display()))?;
    let manifest = plugin_framework::parse_plugin_manifest(&manifest_raw)
        .with_context(|| format!("failed to parse {}", manifest_path.display()))?;
    if !is_host_extension_manifest(&manifest) {
        bail!(
            "installation {} is not a host extension manifest",
            installation.plugin_id
        );
    }

    let entry_path = install_root.join(&manifest.runtime.entry);
    if !entry_path.is_file() {
        bail!("host extension entry not found at {}", entry_path.display());
    }

    Ok(())
}
