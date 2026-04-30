use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use access_control::ensure_permission;
use anyhow::Result;
use async_trait::async_trait;
use domain::DataModelScopeKind;
use uuid::Uuid;

use crate::{
    audit::audit_log,
    errors::ControlPlaneError,
    ports::{
        AddModelFieldInput, CreateModelDefinitionInput, CreateScopeDataModelGrantInput,
        ModelDefinitionRepository, UpdateModelDefinitionInput, UpdateModelDefinitionStatusInput,
        UpdateModelFieldInput, UpdateScopeDataModelGrantInput,
    },
};

pub struct CreateModelDefinitionCommand {
    pub actor_user_id: Uuid,
    pub scope_kind: DataModelScopeKind,
    pub data_source_instance_id: Option<Uuid>,
    pub code: String,
    pub title: String,
    pub status: Option<domain::DataModelStatus>,
}

pub struct PublishModelCommand {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
}

pub struct UpdateModelDefinitionCommand {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub title: String,
}

pub struct UpdateModelDefinitionStatusCommand {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub status: domain::DataModelStatus,
    pub api_exposure_status: domain::ApiExposureStatus,
}

pub struct AddModelFieldCommand {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub code: String,
    pub title: String,
    pub field_kind: domain::ModelFieldKind,
    pub is_required: bool,
    pub is_unique: bool,
    pub default_value: Option<serde_json::Value>,
    pub display_interface: Option<String>,
    pub display_options: serde_json::Value,
    pub relation_target_model_id: Option<Uuid>,
    pub relation_options: serde_json::Value,
}

pub struct UpdateModelFieldCommand {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub field_id: Uuid,
    pub title: String,
    pub is_required: bool,
    pub is_unique: bool,
    pub default_value: Option<serde_json::Value>,
    pub display_interface: Option<String>,
    pub display_options: serde_json::Value,
    pub relation_options: serde_json::Value,
}

pub struct DeleteModelDefinitionCommand {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub confirmed: bool,
}

pub struct DeleteModelFieldCommand {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub field_id: Uuid,
    pub confirmed: bool,
}

pub struct PublishedModel {
    pub model: domain::ModelDefinitionRecord,
    pub resource: runtime_core::resource_descriptor::ResourceDescriptor,
}

pub struct ModelDefinitionService<R> {
    repository: R,
}

fn ensure_state_model_permission(
    actor: &domain::ActorContext,
    action: &str,
) -> Result<(), ControlPlaneError> {
    if actor.is_root
        || actor.has_permission(&format!("state_model.{action}.all"))
        || actor.has_permission(&format!("state_model.{action}.own"))
    {
        return Ok(());
    }

    Err(ControlPlaneError::PermissionDenied("permission_denied"))
}

impl<R> ModelDefinitionService<R>
where
    R: ModelDefinitionRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_models(
        &self,
        actor_user_id: Uuid,
    ) -> Result<Vec<domain::ModelDefinitionRecord>> {
        let actor = self
            .repository
            .load_actor_context_for_user(actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "view")?;
        self.repository
            .list_model_definitions(actor.current_workspace_id)
            .await
    }

    pub async fn create_model(
        &self,
        command: CreateModelDefinitionCommand,
    ) -> Result<domain::ModelDefinitionRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_permission(&actor, "state_model.create.all")
            .map_err(ControlPlaneError::PermissionDenied)?;
        let scope_id = match command.scope_kind {
            DataModelScopeKind::Workspace => actor.current_workspace_id,
            DataModelScopeKind::System => domain::SYSTEM_SCOPE_ID,
        };
        let defaults = match command.data_source_instance_id {
            Some(data_source_instance_id) => {
                self.repository
                    .get_data_source_defaults(actor.current_workspace_id, data_source_instance_id)
                    .await?
            }
            None => domain::DataSourceDefaults::default(),
        };
        let status = command.status.unwrap_or(defaults.data_model_status);
        let api_exposure_status =
            normalize_api_exposure_for_status(status, defaults.api_exposure_status)?;

        let model = self
            .repository
            .create_model_definition(&CreateModelDefinitionInput {
                actor_user_id: command.actor_user_id,
                scope_kind: command.scope_kind,
                scope_id,
                data_source_instance_id: command.data_source_instance_id,
                code: command.code,
                title: command.title,
                status,
                api_exposure_status,
                protection: domain::DataModelProtection::default(),
            })
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(model.id),
                "state_model.created",
                serde_json::json!({ "code": model.code }),
            ))
            .await?;

        Ok(model)
    }

    pub async fn update_model_status(
        &self,
        command: UpdateModelDefinitionStatusCommand,
    ) -> Result<domain::ModelDefinitionRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "manage")?;
        self.repository
            .get_model_definition(actor.current_workspace_id, command.model_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;

        let api_exposure_status =
            normalize_api_exposure_for_status(command.status, command.api_exposure_status)?;
        let model = self
            .repository
            .update_model_definition_status(&UpdateModelDefinitionStatusInput {
                actor_user_id: command.actor_user_id,
                workspace_id: actor.current_workspace_id,
                model_id: command.model_id,
                status: command.status,
                api_exposure_status,
            })
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(command.model_id),
                "state_model.status_updated",
                serde_json::json!({
                    "status": model.status.as_str(),
                    "api_exposure_status": model.api_exposure_status.as_str(),
                }),
            ))
            .await?;

        Ok(model)
    }

    pub async fn get_model(
        &self,
        actor_user_id: Uuid,
        model_id: Uuid,
    ) -> Result<domain::ModelDefinitionRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "view")?;

        self.repository
            .get_model_definition(actor.current_workspace_id, model_id)
            .await?
            .ok_or_else(|| ControlPlaneError::NotFound("model_definition").into())
    }

    pub async fn update_model(
        &self,
        command: UpdateModelDefinitionCommand,
    ) -> Result<domain::ModelDefinitionRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "manage")?;

        let model = self
            .repository
            .update_model_definition(&UpdateModelDefinitionInput {
                actor_user_id: command.actor_user_id,
                model_id: command.model_id,
                title: command.title,
            })
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(command.model_id),
                "state_model.updated",
                serde_json::json!({ "title": model.title }),
            ))
            .await?;

        Ok(model)
    }

    pub async fn add_field(
        &self,
        command: AddModelFieldCommand,
    ) -> Result<domain::ModelFieldRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "manage")?;

        let field = self
            .repository
            .add_model_field(&AddModelFieldInput {
                actor_user_id: command.actor_user_id,
                model_id: command.model_id,
                code: command.code,
                title: command.title,
                field_kind: command.field_kind,
                is_required: command.is_required,
                is_unique: command.is_unique,
                default_value: command.default_value,
                display_interface: command.display_interface,
                display_options: command.display_options,
                relation_target_model_id: command.relation_target_model_id,
                relation_options: command.relation_options,
            })
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(command.model_id),
                "state_model.field_created",
                serde_json::json!({ "field_code": field.code }),
            ))
            .await?;

        Ok(field)
    }

    pub async fn update_field(
        &self,
        command: UpdateModelFieldCommand,
    ) -> Result<domain::ModelFieldRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "manage")?;

        let field = self
            .repository
            .update_model_field(&UpdateModelFieldInput {
                actor_user_id: command.actor_user_id,
                model_id: command.model_id,
                field_id: command.field_id,
                title: command.title,
                is_required: command.is_required,
                is_unique: command.is_unique,
                default_value: command.default_value,
                display_interface: command.display_interface,
                display_options: command.display_options,
                relation_options: command.relation_options,
            })
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(command.model_id),
                "state_model.field_updated",
                serde_json::json!({ "field_id": command.field_id }),
            ))
            .await?;

        Ok(field)
    }

    pub async fn delete_model(&self, command: DeleteModelDefinitionCommand) -> Result<()> {
        if !command.confirmed {
            return Err(ControlPlaneError::InvalidInput("confirmation").into());
        }

        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "manage")?;

        self.repository
            .delete_model_definition(command.actor_user_id, command.model_id)
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(command.model_id),
                "state_model.deleted",
                serde_json::json!({}),
            ))
            .await?;

        Ok(())
    }

    pub async fn delete_field(&self, command: DeleteModelFieldCommand) -> Result<()> {
        if !command.confirmed {
            return Err(ControlPlaneError::InvalidInput("confirmation").into());
        }

        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_state_model_permission(&actor, "manage")?;

        self.repository
            .delete_model_field(command.actor_user_id, command.model_id, command.field_id)
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(command.model_id),
                "state_model.field_deleted",
                serde_json::json!({ "field_id": command.field_id }),
            ))
            .await?;

        Ok(())
    }

    pub async fn publish_model(&self, command: PublishModelCommand) -> Result<PublishedModel> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        ensure_permission(&actor, "state_model.manage.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        let model = self
            .repository
            .publish_model_definition(command.actor_user_id, command.model_id)
            .await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(actor.current_workspace_id),
                Some(command.actor_user_id),
                "state_model",
                Some(command.model_id),
                "state_model.published",
                serde_json::json!({}),
            ))
            .await?;

        Ok(PublishedModel {
            resource: runtime_core::resource_descriptor::ResourceDescriptor::runtime_model(
                &model.code,
                model.scope_kind,
            ),
            model,
        })
    }
}

#[derive(Default, Clone)]
pub struct InMemoryModelDefinitionRepository {
    models: Arc<Mutex<HashMap<Uuid, domain::ModelDefinitionRecord>>>,
    data_source_defaults: Arc<Mutex<HashMap<(Uuid, Uuid), domain::DataSourceDefaults>>>,
}

impl InMemoryModelDefinitionRepository {
    pub fn with_data_source_defaults(
        data_source_instance_id: Uuid,
        defaults: domain::DataSourceDefaults,
    ) -> Self {
        Self {
            models: Arc::default(),
            data_source_defaults: Arc::new(Mutex::new(HashMap::from([(
                (Uuid::nil(), data_source_instance_id),
                defaults,
            )]))),
        }
    }

    fn upsert_placeholder(&self, model_id: Uuid) -> domain::ModelDefinitionRecord {
        let mut models = self.models.lock().expect("in-memory model lock poisoned");
        let entry = models
            .entry(model_id)
            .or_insert_with(|| domain::ModelDefinitionRecord {
                id: model_id,
                scope_kind: DataModelScopeKind::Workspace,
                scope_id: Uuid::nil(),
                code: if model_id.is_nil() {
                    "nil".to_string()
                } else {
                    format!("model_{}", model_id.simple())
                },
                title: "Runtime Model".to_string(),
                physical_table_name: format!("rtm_workspace_00000000_{}", model_id.simple()),
                acl_namespace: "state_model.runtime_model".to_string(),
                audit_namespace: "audit.state_model.runtime_model".to_string(),
                fields: vec![],
                availability_status: domain::MetadataAvailabilityStatus::Available,
                data_source_instance_id: None,
                status: domain::DataModelStatus::Published,
                api_exposure_status: domain::ApiExposureStatus::PublishedNotExposed,
                protection: domain::DataModelProtection::default(),
            });
        entry.clone()
    }
}

#[async_trait]
impl ModelDefinitionRepository for InMemoryModelDefinitionRepository {
    async fn load_actor_context_for_user(
        &self,
        actor_user_id: Uuid,
    ) -> Result<domain::ActorContext> {
        Ok(domain::ActorContext::root(
            actor_user_id,
            Uuid::nil(),
            "root",
        ))
    }

    async fn list_model_definitions(
        &self,
        _workspace_id: Uuid,
    ) -> Result<Vec<domain::ModelDefinitionRecord>> {
        let models = self.models.lock().expect("in-memory model lock poisoned");
        Ok(models.values().cloned().collect())
    }

    async fn get_model_definition(
        &self,
        workspace_id: Uuid,
        model_id: Uuid,
    ) -> Result<Option<domain::ModelDefinitionRecord>> {
        let models = self.models.lock().expect("in-memory model lock poisoned");
        Ok(models
            .get(&model_id)
            .filter(|model| {
                workspace_id.is_nil()
                    || !matches!(model.scope_kind, DataModelScopeKind::Workspace)
                    || model.scope_id == workspace_id
            })
            .cloned())
    }

    async fn get_data_source_defaults(
        &self,
        workspace_id: Uuid,
        data_source_instance_id: Uuid,
    ) -> Result<domain::DataSourceDefaults> {
        self.data_source_defaults
            .lock()
            .expect("in-memory data source defaults lock poisoned")
            .get(&(workspace_id, data_source_instance_id))
            .copied()
            .ok_or_else(|| ControlPlaneError::NotFound("data_source_instance").into())
    }

    async fn create_model_definition(
        &self,
        input: &CreateModelDefinitionInput,
    ) -> Result<domain::ModelDefinitionRecord> {
        let model = domain::ModelDefinitionRecord {
            id: Uuid::now_v7(),
            scope_kind: input.scope_kind,
            scope_id: input.scope_id,
            data_source_instance_id: input.data_source_instance_id,
            code: input.code.clone(),
            title: input.title.clone(),
            physical_table_name: build_physical_table_name(input.scope_kind, &input.code),
            acl_namespace: format!("state_model.{}", input.code),
            audit_namespace: format!("audit.state_model.{}", input.code),
            fields: vec![],
            availability_status: domain::MetadataAvailabilityStatus::Available,
            status: input.status,
            api_exposure_status: input.api_exposure_status,
            protection: input.protection.clone(),
        };
        self.models
            .lock()
            .expect("in-memory model lock poisoned")
            .insert(model.id, model.clone());
        Ok(model)
    }

    async fn update_model_definition(
        &self,
        input: &UpdateModelDefinitionInput,
    ) -> Result<domain::ModelDefinitionRecord> {
        let mut models = self.models.lock().expect("in-memory model lock poisoned");
        let model = models
            .get_mut(&input.model_id)
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;
        model.title = input.title.clone();
        Ok(model.clone())
    }

    async fn update_model_definition_status(
        &self,
        input: &UpdateModelDefinitionStatusInput,
    ) -> Result<domain::ModelDefinitionRecord> {
        let mut models = self.models.lock().expect("in-memory model lock poisoned");
        let model = models
            .get_mut(&input.model_id)
            .filter(|model| {
                input.workspace_id.is_nil()
                    || !matches!(model.scope_kind, DataModelScopeKind::Workspace)
                    || model.scope_id == input.workspace_id
            })
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;
        model.status = input.status;
        model.api_exposure_status = input.api_exposure_status;
        Ok(model.clone())
    }

    async fn add_model_field(
        &self,
        input: &AddModelFieldInput,
    ) -> Result<domain::ModelFieldRecord> {
        let mut models = self.models.lock().expect("in-memory model lock poisoned");
        let model = models
            .get_mut(&input.model_id)
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;
        let field = domain::ModelFieldRecord {
            id: Uuid::now_v7(),
            data_model_id: input.model_id,
            code: input.code.clone(),
            title: input.title.clone(),
            physical_column_name: build_physical_column_name(&input.code),
            field_kind: input.field_kind,
            is_required: input.is_required,
            is_unique: input.is_unique,
            default_value: input.default_value.clone(),
            display_interface: input.display_interface.clone(),
            display_options: input.display_options.clone(),
            relation_target_model_id: input.relation_target_model_id,
            relation_options: input.relation_options.clone(),
            sort_order: model.fields.len() as i32,
            availability_status: domain::MetadataAvailabilityStatus::Available,
        };
        model.fields.push(field.clone());
        Ok(field)
    }

    async fn update_model_field(
        &self,
        input: &UpdateModelFieldInput,
    ) -> Result<domain::ModelFieldRecord> {
        let mut models = self.models.lock().expect("in-memory model lock poisoned");
        let model = models
            .get_mut(&input.model_id)
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;
        let field = model
            .fields
            .iter_mut()
            .find(|field| field.id == input.field_id)
            .ok_or(ControlPlaneError::NotFound("model_field"))?;
        field.title = input.title.clone();
        field.is_required = input.is_required;
        field.is_unique = input.is_unique;
        field.default_value = input.default_value.clone();
        field.display_interface = input.display_interface.clone();
        field.display_options = input.display_options.clone();
        field.relation_options = input.relation_options.clone();

        Ok(field.clone())
    }

    async fn delete_model_definition(&self, _actor_user_id: Uuid, model_id: Uuid) -> Result<()> {
        let removed = self
            .models
            .lock()
            .expect("in-memory model lock poisoned")
            .remove(&model_id);
        if removed.is_some() {
            Ok(())
        } else {
            Err(ControlPlaneError::NotFound("model_definition").into())
        }
    }

    async fn delete_model_field(
        &self,
        _actor_user_id: Uuid,
        model_id: Uuid,
        field_id: Uuid,
    ) -> Result<()> {
        let mut models = self.models.lock().expect("in-memory model lock poisoned");
        let model = models
            .get_mut(&model_id)
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;
        let original_len = model.fields.len();
        model.fields.retain(|field| field.id != field_id);
        if model.fields.len() == original_len {
            Err(ControlPlaneError::NotFound("model_field").into())
        } else {
            Ok(())
        }
    }

    async fn publish_model_definition(
        &self,
        _actor_user_id: Uuid,
        model_id: Uuid,
    ) -> Result<domain::ModelDefinitionRecord> {
        Ok(self.upsert_placeholder(model_id))
    }

    async fn create_scope_data_model_grant(
        &self,
        input: &CreateScopeDataModelGrantInput,
    ) -> Result<domain::ScopeDataModelGrantRecord> {
        self.models
            .lock()
            .expect("in-memory model lock poisoned")
            .get(&input.data_model_id)
            .filter(|model| matches!(model.scope_kind, DataModelScopeKind::System))
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;

        Ok(domain::ScopeDataModelGrantRecord {
            id: input.grant_id,
            scope_kind: input.scope_kind,
            scope_id: input.scope_id,
            data_model_id: input.data_model_id,
            enabled: input.enabled,
            permission_profile: input.permission_profile,
            created_by: input.created_by,
            created_at: time::OffsetDateTime::now_utc(),
            updated_at: time::OffsetDateTime::now_utc(),
        })
    }

    async fn update_scope_data_model_grant(
        &self,
        input: &UpdateScopeDataModelGrantInput,
    ) -> Result<domain::ScopeDataModelGrantRecord> {
        self.models
            .lock()
            .expect("in-memory model lock poisoned")
            .get(&input.data_model_id)
            .filter(|model| matches!(model.scope_kind, DataModelScopeKind::System))
            .ok_or(ControlPlaneError::NotFound("model_definition"))?;

        Ok(domain::ScopeDataModelGrantRecord {
            id: Uuid::now_v7(),
            scope_kind: input.scope_kind,
            scope_id: input.scope_id,
            data_model_id: input.data_model_id,
            enabled: input.enabled,
            permission_profile: input.permission_profile,
            created_by: None,
            created_at: time::OffsetDateTime::now_utc(),
            updated_at: time::OffsetDateTime::now_utc(),
        })
    }

    async fn list_scope_data_model_grants(
        &self,
        _scope_kind: DataModelScopeKind,
        _scope_id: Uuid,
    ) -> Result<Vec<domain::ScopeDataModelGrantRecord>> {
        Ok(Vec::new())
    }

    async fn append_audit_log(&self, _event: &domain::AuditLogRecord) -> Result<()> {
        Ok(())
    }
}

impl ModelDefinitionService<InMemoryModelDefinitionRepository> {
    pub fn for_tests() -> Self {
        Self::new(InMemoryModelDefinitionRepository::default())
    }
}

fn normalize_api_exposure_for_status(
    status: domain::DataModelStatus,
    exposure: domain::ApiExposureStatus,
) -> Result<domain::ApiExposureStatus> {
    let effective_exposure = if status == domain::DataModelStatus::Draft {
        domain::ApiExposureStatus::Draft
    } else {
        exposure
    };
    if domain::ApiExposureStatus::validate_for_status(
        status,
        effective_exposure,
        domain::ApiExposureReadiness::default(),
    )
    .is_rejected()
    {
        Err(ControlPlaneError::InvalidInput("api_exposure_status").into())
    } else {
        Ok(effective_exposure)
    }
}

fn build_physical_table_name(scope_kind: DataModelScopeKind, code: &str) -> String {
    let prefix = match scope_kind {
        DataModelScopeKind::Workspace => "workspace",
        DataModelScopeKind::System => "system",
    };
    let suffix = Uuid::now_v7().simple().to_string();
    let sanitized_code = code.replace('-', "_");

    format!(
        "rtm_{prefix}_{}_{}",
        &suffix[suffix.len() - 8..],
        sanitized_code
    )
}

fn build_physical_column_name(code: &str) -> String {
    code.replace('-', "_")
}
