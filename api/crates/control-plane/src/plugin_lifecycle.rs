use domain::{
    PluginArtifactStatus, PluginAvailabilityStatus, PluginDesiredState, PluginInstallationRecord,
    PluginRuntimeStatus,
};
use plugin_framework::{
    reconcile_provider_artifact, ArtifactReconcileInput, ArtifactReconcileOutcome,
};
use uuid::Uuid;

use crate::{
    errors::ControlPlaneError,
    ports::{PluginRepository, UpdatePluginArtifactSnapshotInput},
};

pub fn derive_availability_status(
    desired_state: PluginDesiredState,
    artifact_status: PluginArtifactStatus,
    runtime_status: PluginRuntimeStatus,
) -> PluginAvailabilityStatus {
    match desired_state {
        PluginDesiredState::Disabled => PluginAvailabilityStatus::Disabled,
        PluginDesiredState::PendingRestart => {
            if artifact_status == PluginArtifactStatus::Ready {
                PluginAvailabilityStatus::PendingRestart
            } else {
                PluginAvailabilityStatus::ArtifactMissing
            }
        }
        PluginDesiredState::ActiveRequested => match artifact_status {
            PluginArtifactStatus::Missing => PluginAvailabilityStatus::ArtifactMissing,
            PluginArtifactStatus::Staged
            | PluginArtifactStatus::InstallIncomplete
            | PluginArtifactStatus::Corrupted => PluginAvailabilityStatus::InstallIncomplete,
            PluginArtifactStatus::Ready => match runtime_status {
                PluginRuntimeStatus::Active => PluginAvailabilityStatus::Available,
                PluginRuntimeStatus::LoadFailed => PluginAvailabilityStatus::LoadFailed,
                PluginRuntimeStatus::Inactive => PluginAvailabilityStatus::InstallIncomplete,
            },
        },
    }
}

pub async fn reconcile_installation_snapshot<R>(
    repository: &R,
    installation_id: Uuid,
) -> anyhow::Result<PluginInstallationRecord>
where
    R: PluginRepository + ?Sized,
{
    let installation = repository
        .get_installation(installation_id)
        .await?
        .ok_or(ControlPlaneError::NotFound("plugin_installation"))?;
    let reconcile = reconcile_provider_artifact(ArtifactReconcileInput {
        package_path: installation
            .package_path
            .as_deref()
            .map(std::path::Path::new),
        installed_path: std::path::Path::new(&installation.installed_path),
        expected_artifact_sha256: installation.checksum.as_deref(),
        expected_manifest_fingerprint: installation.manifest_fingerprint.as_deref(),
    })?;
    let artifact_status = match reconcile.outcome {
        ArtifactReconcileOutcome::Missing => PluginArtifactStatus::Missing,
        ArtifactReconcileOutcome::InstallIncomplete => PluginArtifactStatus::InstallIncomplete,
        ArtifactReconcileOutcome::Ready => PluginArtifactStatus::Ready,
        ArtifactReconcileOutcome::Corrupted => PluginArtifactStatus::Corrupted,
    };
    let availability_status = derive_availability_status(
        installation.desired_state,
        artifact_status,
        installation.runtime_status,
    );
    let manifest_fingerprint = reconcile
        .manifest_fingerprint
        .or_else(|| installation.manifest_fingerprint.clone());
    if installation.artifact_status == artifact_status
        && installation.availability_status == availability_status
        && installation.manifest_fingerprint == manifest_fingerprint
    {
        return Ok(installation);
    }

    repository
        .update_artifact_snapshot(&UpdatePluginArtifactSnapshotInput {
            installation_id,
            artifact_status,
            availability_status,
            package_path: installation.package_path.clone(),
            installed_path: installation.installed_path.clone(),
            checksum: installation.checksum.clone(),
            manifest_fingerprint,
        })
        .await
}
