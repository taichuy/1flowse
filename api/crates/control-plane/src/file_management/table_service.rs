use anyhow::Result;
use uuid::Uuid;

use crate::{
    errors::ControlPlaneError,
    file_management::{CreateWorkspaceFileTableCommand, FileTableProvisioningService},
    ports::{
        DeleteFileTableInput, FileManagementRepository, ModelDefinitionRepository,
        UpdateFileStorageBindingInput,
    },
};

pub struct BindFileTableStorageCommand {
    pub actor_user_id: Uuid,
    pub file_table_id: Uuid,
    pub bound_storage_id: Uuid,
}

pub struct CreateFileTableCommand {
    pub actor_user_id: Uuid,
    pub code: String,
    pub title: String,
}

pub struct DeleteFileTableCommand {
    pub actor_user_id: Uuid,
    pub file_table_id: Uuid,
}

pub struct FileTableService<R> {
    repository: R,
}

impl<R> FileTableService<R>
where
    R: FileManagementRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_tables(&self, actor_user_id: Uuid) -> Result<Vec<domain::FileTableRecord>> {
        let actor = self
            .repository
            .load_actor_context_for_user(actor_user_id)
            .await?;
        if !actor.is_root
            && !actor.has_permission("file_table.view.all")
            && !actor.has_permission("file_table.view.own")
        {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        self.repository
            .list_visible_file_tables(actor.current_workspace_id)
            .await
    }

    pub async fn bind_storage(
        &self,
        command: BindFileTableStorageCommand,
    ) -> Result<domain::FileTableRecord> {
        let actor = FileManagementRepository::load_actor_context_for_user(
            &self.repository,
            command.actor_user_id,
        )
        .await?;
        if !actor.is_root {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        self.repository
            .update_file_table_binding(&UpdateFileStorageBindingInput {
                actor_user_id: command.actor_user_id,
                file_table_id: command.file_table_id,
                bound_storage_id: command.bound_storage_id,
            })
            .await
    }

    pub async fn delete_table(&self, command: DeleteFileTableCommand) -> Result<()> {
        let actor = FileManagementRepository::load_actor_context_for_user(
            &self.repository,
            command.actor_user_id,
        )
        .await?;
        if !actor.is_root {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        self.repository
            .delete_file_table(&DeleteFileTableInput {
                actor_user_id: command.actor_user_id,
                file_table_id: command.file_table_id,
            })
            .await
    }
}

impl<R> FileTableService<R>
where
    R: FileManagementRepository + ModelDefinitionRepository + Clone,
{
    pub async fn create_table(
        &self,
        command: CreateFileTableCommand,
    ) -> Result<domain::FileTableRecord> {
        let actor = FileManagementRepository::load_actor_context_for_user(
            &self.repository,
            command.actor_user_id,
        )
        .await?;
        if !actor.is_root && !actor.has_permission("file_table.create.all") {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        let default_storage = self
            .repository
            .get_default_file_storage()
            .await?
            .ok_or(ControlPlaneError::NotFound("file_storage"))?;

        FileTableProvisioningService::new(self.repository.clone())
            .create_workspace_file_table(CreateWorkspaceFileTableCommand {
                actor_user_id: command.actor_user_id,
                workspace_id: actor.current_workspace_id,
                code: command.code,
                title: command.title,
                default_storage_id: default_storage.id,
            })
            .await
    }
}
