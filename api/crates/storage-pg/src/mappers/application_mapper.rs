use anyhow::{anyhow, Result};
use domain::{
    ApplicationApiSection, ApplicationLogsSection, ApplicationMonitoringSection,
    ApplicationOrchestrationSection, ApplicationRecord, ApplicationSections, ApplicationType,
};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct StoredApplicationRow {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub application_type: String,
    pub name: String,
    pub description: String,
    pub icon: Option<String>,
    pub icon_type: Option<String>,
    pub icon_background: Option<String>,
    pub created_by: Uuid,
    pub updated_at: OffsetDateTime,
}

pub struct PgApplicationMapper;

impl PgApplicationMapper {
    pub fn to_application_record(row: StoredApplicationRow) -> Result<ApplicationRecord> {
        let application_type = parse_application_type(&row.application_type)?;

        Ok(ApplicationRecord {
            id: row.id,
            workspace_id: row.workspace_id,
            application_type,
            name: row.name,
            description: row.description,
            icon: row.icon,
            icon_type: row.icon_type,
            icon_background: row.icon_background,
            created_by: row.created_by,
            updated_at: row.updated_at,
            sections: planned_sections(application_type),
        })
    }
}

pub fn parse_application_type(value: &str) -> Result<ApplicationType> {
    match value {
        "agent_flow" => Ok(ApplicationType::AgentFlow),
        "workflow" => Ok(ApplicationType::Workflow),
        _ => Err(anyhow!("unknown application_type: {value}")),
    }
}

pub fn planned_sections(application_type: ApplicationType) -> ApplicationSections {
    ApplicationSections {
        orchestration: ApplicationOrchestrationSection {
            status: "planned".to_string(),
            subject_kind: application_type.as_str().to_string(),
            subject_status: "unconfigured".to_string(),
            current_subject_id: None,
            current_draft_id: None,
        },
        api: ApplicationApiSection {
            status: "planned".to_string(),
            credential_kind: "application_api_key".to_string(),
            invoke_routing_mode: "api_key_bound_application".to_string(),
            invoke_path_template: None,
            api_capability_status: "planned".to_string(),
            credentials_status: "planned".to_string(),
        },
        logs: ApplicationLogsSection {
            status: "planned".to_string(),
            runs_capability_status: "planned".to_string(),
            run_object_kind: "application_run".to_string(),
            log_retention_status: "planned".to_string(),
        },
        monitoring: ApplicationMonitoringSection {
            status: "planned".to_string(),
            metrics_capability_status: "planned".to_string(),
            metrics_object_kind: "application_metrics".to_string(),
            tracing_config_status: "planned".to_string(),
        },
    }
}
