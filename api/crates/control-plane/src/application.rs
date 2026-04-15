use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use access_control::ensure_permission;
use anyhow::Result;
use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    audit::audit_log,
    errors::ControlPlaneError,
    ports::{ApplicationRepository, ApplicationVisibility, CreateApplicationInput},
};

pub struct CreateApplicationCommand {
    pub actor_user_id: Uuid,
    pub application_type: domain::ApplicationType,
    pub name: String,
    pub description: String,
    pub icon: Option<String>,
    pub icon_type: Option<String>,
    pub icon_background: Option<String>,
}

pub struct ApplicationService<R> {
    repository: R,
}

impl<R> ApplicationService<R>
where
    R: ApplicationRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_applications(
        &self,
        actor_user_id: Uuid,
    ) -> Result<Vec<domain::ApplicationRecord>> {
        let actor = self
            .repository
            .load_actor_context_for_user(actor_user_id)
            .await?;
        let visibility = resolve_application_visibility(&actor)?;

        self.repository
            .list_applications(actor.current_workspace_id, actor_user_id, visibility)
            .await
    }

    pub async fn create_application(
        &self,
        command: CreateApplicationCommand,
    ) -> Result<domain::ApplicationRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_permission(&actor, "application.create.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let created = self
            .repository
            .create_application(&CreateApplicationInput {
                actor_user_id: command.actor_user_id,
                workspace_id: actor.current_workspace_id,
                application_type: command.application_type,
                name: command.name,
                description: command.description,
                icon: command.icon,
                icon_type: command.icon_type,
                icon_background: command.icon_background,
            })
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "application",
                Some(created.id),
                "application.created",
                serde_json::json!({
                    "application_type": created.application_type.as_str(),
                    "name": created.name,
                }),
            ))
            .await?;

        Ok(created)
    }

    pub async fn get_application(
        &self,
        actor_user_id: Uuid,
        application_id: Uuid,
    ) -> Result<domain::ApplicationRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(actor_user_id)
            .await?;
        let visibility = resolve_application_visibility(&actor)?;
        let application = self
            .repository
            .get_application(actor.current_workspace_id, application_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("application"))?;

        if matches!(visibility, ApplicationVisibility::Own)
            && application.created_by != actor_user_id
        {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        Ok(application)
    }
}

fn resolve_application_visibility(
    actor: &domain::ActorContext,
) -> Result<ApplicationVisibility, ControlPlaneError> {
    if actor.is_root || actor.has_permission("application.view.all") {
        return Ok(ApplicationVisibility::All);
    }

    if actor.has_permission("application.view.own") {
        return Ok(ApplicationVisibility::Own);
    }

    Err(ControlPlaneError::PermissionDenied("permission_denied"))
}

#[derive(Default)]
struct InMemoryApplicationRepositoryInner {
    applications: HashMap<Uuid, domain::ApplicationRecord>,
    permissions: Vec<String>,
    workspace_id: Uuid,
    tenant_id: Uuid,
    audit_events: Vec<String>,
}

#[derive(Clone)]
pub struct InMemoryApplicationRepository {
    inner: Arc<Mutex<InMemoryApplicationRepositoryInner>>,
}

impl InMemoryApplicationRepository {
    pub fn with_permissions(permissions: Vec<&str>) -> Self {
        Self {
            inner: Arc::new(Mutex::new(InMemoryApplicationRepositoryInner {
                applications: HashMap::new(),
                permissions: permissions.into_iter().map(str::to_string).collect(),
                workspace_id: Uuid::nil(),
                tenant_id: Uuid::nil(),
                audit_events: Vec::new(),
            })),
        }
    }

    fn insert_application(&self, actor_user_id: Uuid, name: &str) -> domain::ApplicationRecord {
        let mut inner = self
            .inner
            .lock()
            .expect("in-memory app repo mutex poisoned");
        let application = build_application_record(
            Uuid::now_v7(),
            CreateApplicationInput {
                actor_user_id,
                workspace_id: inner.workspace_id,
                application_type: domain::ApplicationType::AgentFlow,
                name: name.to_string(),
                description: String::new(),
                icon: None,
                icon_type: None,
                icon_background: None,
            },
        );
        inner
            .applications
            .insert(application.id, application.clone());
        application
    }
}

#[async_trait]
impl ApplicationRepository for InMemoryApplicationRepository {
    async fn load_actor_context_for_user(
        &self,
        actor_user_id: Uuid,
    ) -> Result<domain::ActorContext> {
        let inner = self
            .inner
            .lock()
            .expect("in-memory app repo mutex poisoned");

        Ok(domain::ActorContext::scoped_in_scope(
            actor_user_id,
            inner.tenant_id,
            inner.workspace_id,
            "manager",
            inner.permissions.iter().cloned(),
        ))
    }

    async fn list_applications(
        &self,
        workspace_id: Uuid,
        actor_user_id: Uuid,
        visibility: ApplicationVisibility,
    ) -> Result<Vec<domain::ApplicationRecord>> {
        let mut applications = self
            .inner
            .lock()
            .expect("in-memory app repo mutex poisoned")
            .applications
            .values()
            .filter(|application| application.workspace_id == workspace_id)
            .filter(|application| {
                matches!(visibility, ApplicationVisibility::All)
                    || application.created_by == actor_user_id
            })
            .cloned()
            .collect::<Vec<_>>();
        applications.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then(right.id.cmp(&left.id))
        });

        Ok(applications)
    }

    async fn create_application(
        &self,
        input: &CreateApplicationInput,
    ) -> Result<domain::ApplicationRecord> {
        let application = build_application_record(Uuid::now_v7(), input.clone());
        self.inner
            .lock()
            .expect("in-memory app repo mutex poisoned")
            .applications
            .insert(application.id, application.clone());

        Ok(application)
    }

    async fn get_application(
        &self,
        workspace_id: Uuid,
        application_id: Uuid,
    ) -> Result<Option<domain::ApplicationRecord>> {
        let application = self
            .inner
            .lock()
            .expect("in-memory app repo mutex poisoned")
            .applications
            .get(&application_id)
            .cloned()
            .filter(|application| application.workspace_id == workspace_id);

        Ok(application)
    }

    async fn append_audit_log(&self, event: &domain::AuditLogRecord) -> Result<()> {
        self.inner
            .lock()
            .expect("in-memory app repo mutex poisoned")
            .audit_events
            .push(event.event_code.clone());
        Ok(())
    }
}

fn build_application_record(id: Uuid, input: CreateApplicationInput) -> domain::ApplicationRecord {
    domain::ApplicationRecord {
        id,
        workspace_id: input.workspace_id,
        application_type: input.application_type,
        name: input.name,
        description: input.description,
        icon: input.icon,
        icon_type: input.icon_type,
        icon_background: input.icon_background,
        created_by: input.actor_user_id,
        updated_at: time::OffsetDateTime::now_utc(),
        sections: planned_sections(input.application_type),
    }
}

fn planned_sections(application_type: domain::ApplicationType) -> domain::ApplicationSections {
    domain::ApplicationSections {
        orchestration: domain::ApplicationOrchestrationSection {
            status: "planned".to_string(),
            subject_kind: application_type.as_str().to_string(),
            subject_status: "unconfigured".to_string(),
            current_subject_id: None,
            current_draft_id: None,
        },
        api: domain::ApplicationApiSection {
            status: "planned".to_string(),
            credential_kind: "application_api_key".to_string(),
            invoke_routing_mode: "api_key_bound_application".to_string(),
            invoke_path_template: None,
            api_capability_status: "planned".to_string(),
            credentials_status: "planned".to_string(),
        },
        logs: domain::ApplicationLogsSection {
            status: "planned".to_string(),
            runs_capability_status: "planned".to_string(),
            run_object_kind: "application_run".to_string(),
            log_retention_status: "planned".to_string(),
        },
        monitoring: domain::ApplicationMonitoringSection {
            status: "planned".to_string(),
            metrics_capability_status: "planned".to_string(),
            metrics_object_kind: "application_metrics".to_string(),
            tracing_config_status: "planned".to_string(),
        },
    }
}

impl ApplicationService<InMemoryApplicationRepository> {
    pub fn for_tests() -> Self {
        Self::new(InMemoryApplicationRepository::with_permissions(vec![
            "application.view.all",
            "application.create.all",
        ]))
    }

    pub fn for_tests_with_permissions(permissions: Vec<&str>) -> Self {
        Self::new(InMemoryApplicationRepository::with_permissions(permissions))
    }

    pub fn seed_foreign_application(&self, name: &str) -> domain::ApplicationRecord {
        self.repository.insert_application(Uuid::now_v7(), name)
    }
}
