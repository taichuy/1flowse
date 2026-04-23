use anyhow::Result;
use domain::{DataModelScopeKind, FileTableScopeKind, SYSTEM_SCOPE_ID};
use uuid::Uuid;

use crate::{
    file_management::attachments_template_fields,
    ports::{
        AddModelFieldInput, CreateFileTableRegistrationInput, CreateModelDefinitionInput,
        FileManagementRepository, ModelDefinitionRepository,
    },
};

pub struct CreateWorkspaceFileTableCommand {
    pub actor_user_id: Uuid,
    pub workspace_id: Uuid,
    pub code: String,
    pub title: String,
    pub default_storage_id: Uuid,
}

pub struct FileManagementBootstrapService<R> {
    repository: R,
}

pub struct FileTableProvisioningService<R> {
    repository: R,
}

async fn provision_file_table<R>(
    repository: &R,
    actor_user_id: Uuid,
    model_scope_kind: DataModelScopeKind,
    model_scope_id: Uuid,
    code: String,
    title: String,
    file_table_scope_kind: FileTableScopeKind,
    file_table_scope_id: Uuid,
    bound_storage_id: Uuid,
    is_builtin: bool,
    is_default: bool,
) -> Result<domain::FileTableRecord>
where
    R: FileManagementRepository + ModelDefinitionRepository,
{
    let model = repository
        .create_model_definition(&CreateModelDefinitionInput {
            actor_user_id,
            scope_kind: model_scope_kind,
            scope_id: model_scope_id,
            code,
            title,
        })
        .await?;

    for field in attachments_template_fields() {
        repository
            .add_model_field(&AddModelFieldInput {
                actor_user_id,
                model_id: model.id,
                code: field.code,
                title: field.title,
                field_kind: field.field_kind,
                is_required: field.is_required,
                is_unique: false,
                default_value: None,
                display_interface: None,
                display_options: serde_json::json!({}),
                relation_target_model_id: None,
                relation_options: serde_json::json!({}),
            })
            .await?;
    }

    let published = repository
        .publish_model_definition(actor_user_id, model.id)
        .await?;

    repository
        .create_file_table_registration(&CreateFileTableRegistrationInput {
            file_table_id: Uuid::now_v7(),
            actor_user_id,
            code: published.code,
            title: published.title,
            scope_kind: file_table_scope_kind,
            scope_id: file_table_scope_id,
            model_definition_id: published.id,
            bound_storage_id,
            is_builtin,
            is_default,
        })
        .await
}

impl<R> FileManagementBootstrapService<R>
where
    R: FileManagementRepository + ModelDefinitionRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn ensure_builtin_attachments(
        &self,
        actor_user_id: Uuid,
        default_storage_id: Uuid,
        default_code: &str,
    ) -> Result<domain::FileTableRecord> {
        if let Some(existing) = self
            .repository
            .find_file_table_by_code(default_code)
            .await?
        {
            return Ok(existing);
        }

        provision_file_table(
            &self.repository,
            actor_user_id,
            DataModelScopeKind::System,
            SYSTEM_SCOPE_ID,
            default_code.to_string(),
            "Attachments".into(),
            FileTableScopeKind::System,
            SYSTEM_SCOPE_ID,
            default_storage_id,
            true,
            true,
        )
        .await
    }
}

impl<R> FileTableProvisioningService<R>
where
    R: FileManagementRepository + ModelDefinitionRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn create_workspace_file_table(
        &self,
        command: CreateWorkspaceFileTableCommand,
    ) -> Result<domain::FileTableRecord> {
        provision_file_table(
            &self.repository,
            command.actor_user_id,
            DataModelScopeKind::Workspace,
            command.workspace_id,
            command.code,
            command.title,
            FileTableScopeKind::Workspace,
            command.workspace_id,
            command.default_storage_id,
            false,
            false,
        )
        .await
    }
}
