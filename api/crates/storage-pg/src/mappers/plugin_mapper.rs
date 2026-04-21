use anyhow::{anyhow, Result};
use domain::{
    PluginArtifactStatus, PluginAssignmentRecord, PluginAvailabilityStatus, PluginDesiredState,
    PluginInstallationRecord, PluginRuntimeStatus, PluginTaskKind, PluginTaskRecord,
    PluginTaskStatus, PluginVerificationStatus,
};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct StoredPluginInstallationRow {
    pub id: Uuid,
    pub provider_code: String,
    pub plugin_id: String,
    pub plugin_version: String,
    pub contract_version: String,
    pub protocol: String,
    pub display_name: String,
    pub source_kind: String,
    pub trust_level: String,
    pub verification_status: String,
    pub desired_state: String,
    pub artifact_status: String,
    pub runtime_status: String,
    pub availability_status: String,
    pub package_path: Option<String>,
    pub installed_path: String,
    pub checksum: Option<String>,
    pub manifest_fingerprint: Option<String>,
    pub signature_status: Option<String>,
    pub signature_algorithm: Option<String>,
    pub signing_key_id: Option<String>,
    pub last_load_error: Option<String>,
    pub metadata_json: serde_json::Value,
    pub created_by: Uuid,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct StoredPluginAssignmentRow {
    pub id: Uuid,
    pub installation_id: Uuid,
    pub workspace_id: Uuid,
    pub provider_code: String,
    pub assigned_by: Uuid,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct StoredPluginTaskRow {
    pub id: Uuid,
    pub installation_id: Option<Uuid>,
    pub workspace_id: Option<Uuid>,
    pub provider_code: String,
    pub task_kind: String,
    pub status: String,
    pub status_message: Option<String>,
    pub detail_json: serde_json::Value,
    pub created_by: Option<Uuid>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

pub struct PgPluginMapper;

impl PgPluginMapper {
    pub fn to_installation_record(
        row: StoredPluginInstallationRow,
    ) -> Result<PluginInstallationRecord> {
        Ok(PluginInstallationRecord {
            id: row.id,
            provider_code: row.provider_code,
            plugin_id: row.plugin_id,
            plugin_version: row.plugin_version,
            contract_version: row.contract_version,
            protocol: row.protocol,
            display_name: row.display_name,
            source_kind: row.source_kind,
            trust_level: row.trust_level,
            verification_status: parse_verification_status(&row.verification_status)?,
            desired_state: parse_desired_state(&row.desired_state)?,
            artifact_status: parse_artifact_status(&row.artifact_status)?,
            runtime_status: parse_runtime_status(&row.runtime_status)?,
            availability_status: parse_availability_status(&row.availability_status)?,
            package_path: row.package_path,
            installed_path: row.installed_path,
            checksum: row.checksum,
            manifest_fingerprint: row.manifest_fingerprint,
            signature_status: row.signature_status,
            signature_algorithm: row.signature_algorithm,
            signing_key_id: row.signing_key_id,
            last_load_error: row.last_load_error,
            metadata_json: row.metadata_json,
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    pub fn to_assignment_record(row: StoredPluginAssignmentRow) -> Result<PluginAssignmentRecord> {
        Ok(PluginAssignmentRecord {
            id: row.id,
            installation_id: row.installation_id,
            workspace_id: row.workspace_id,
            provider_code: row.provider_code,
            assigned_by: row.assigned_by,
            created_at: row.created_at,
        })
    }

    pub fn to_task_record(row: StoredPluginTaskRow) -> Result<PluginTaskRecord> {
        Ok(PluginTaskRecord {
            id: row.id,
            installation_id: row.installation_id,
            workspace_id: row.workspace_id,
            provider_code: row.provider_code,
            task_kind: parse_task_kind(&row.task_kind)?,
            status: parse_task_status(&row.status)?,
            status_message: row.status_message,
            detail_json: row.detail_json,
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
            finished_at: row.finished_at,
        })
    }
}

pub fn parse_verification_status(value: &str) -> Result<PluginVerificationStatus> {
    match value {
        "pending" => Ok(PluginVerificationStatus::Pending),
        "valid" => Ok(PluginVerificationStatus::Valid),
        "invalid" => Ok(PluginVerificationStatus::Invalid),
        _ => Err(anyhow!("unknown plugin verification_status: {value}")),
    }
}

pub fn parse_desired_state(value: &str) -> Result<PluginDesiredState> {
    match value {
        "disabled" => Ok(PluginDesiredState::Disabled),
        "pending_restart" => Ok(PluginDesiredState::PendingRestart),
        "active_requested" => Ok(PluginDesiredState::ActiveRequested),
        _ => Err(anyhow!("unknown plugin desired_state: {value}")),
    }
}

pub fn parse_artifact_status(value: &str) -> Result<PluginArtifactStatus> {
    match value {
        "missing" => Ok(PluginArtifactStatus::Missing),
        "staged" => Ok(PluginArtifactStatus::Staged),
        "ready" => Ok(PluginArtifactStatus::Ready),
        "corrupted" => Ok(PluginArtifactStatus::Corrupted),
        "install_incomplete" => Ok(PluginArtifactStatus::InstallIncomplete),
        _ => Err(anyhow!("unknown plugin artifact_status: {value}")),
    }
}

pub fn parse_runtime_status(value: &str) -> Result<PluginRuntimeStatus> {
    match value {
        "inactive" => Ok(PluginRuntimeStatus::Inactive),
        "active" => Ok(PluginRuntimeStatus::Active),
        "load_failed" => Ok(PluginRuntimeStatus::LoadFailed),
        _ => Err(anyhow!("unknown plugin runtime_status: {value}")),
    }
}

pub fn parse_availability_status(value: &str) -> Result<PluginAvailabilityStatus> {
    match value {
        "disabled" => Ok(PluginAvailabilityStatus::Disabled),
        "pending_restart" => Ok(PluginAvailabilityStatus::PendingRestart),
        "artifact_missing" => Ok(PluginAvailabilityStatus::ArtifactMissing),
        "install_incomplete" => Ok(PluginAvailabilityStatus::InstallIncomplete),
        "load_failed" => Ok(PluginAvailabilityStatus::LoadFailed),
        "available" => Ok(PluginAvailabilityStatus::Available),
        _ => Err(anyhow!("unknown plugin availability_status: {value}")),
    }
}

pub fn parse_task_kind(value: &str) -> Result<PluginTaskKind> {
    match value {
        "install" => Ok(PluginTaskKind::Install),
        "upgrade" => Ok(PluginTaskKind::Upgrade),
        "uninstall" => Ok(PluginTaskKind::Uninstall),
        "enable" => Ok(PluginTaskKind::Enable),
        "disable" => Ok(PluginTaskKind::Disable),
        "assign" => Ok(PluginTaskKind::Assign),
        "unassign" => Ok(PluginTaskKind::Unassign),
        "switch_version" => Ok(PluginTaskKind::SwitchVersion),
        _ => Err(anyhow!("unknown plugin task_kind: {value}")),
    }
}

pub fn parse_task_status(value: &str) -> Result<PluginTaskStatus> {
    match value {
        "queued" => Ok(PluginTaskStatus::Queued),
        "running" => Ok(PluginTaskStatus::Running),
        "succeeded" => Ok(PluginTaskStatus::Succeeded),
        "failed" => Ok(PluginTaskStatus::Failed),
        "canceled" => Ok(PluginTaskStatus::Canceled),
        "timed_out" => Ok(PluginTaskStatus::TimedOut),
        _ => Err(anyhow!("unknown plugin task status: {value}")),
    }
}
