use anyhow::Result;
use uuid::Uuid;

use crate::{
    errors::ControlPlaneError,
    ports::{
        CreateFileStorageInput, DeleteFileStorageInput, FileManagementRepository,
        UpdateFileStorageInput,
    },
};

pub struct CreateFileStorageCommand {
    pub actor_user_id: Uuid,
    pub code: String,
    pub title: String,
    pub driver_type: String,
    pub enabled: bool,
    pub is_default: bool,
    pub config_json: serde_json::Value,
    pub rule_json: serde_json::Value,
}

pub struct UpdateFileStorageCommand {
    pub actor_user_id: Uuid,
    pub file_storage_id: Uuid,
    pub title: String,
    pub enabled: bool,
    pub is_default: bool,
    pub config_json: serde_json::Value,
    pub rule_json: serde_json::Value,
}

pub struct DeleteFileStorageCommand {
    pub actor_user_id: Uuid,
    pub file_storage_id: Uuid,
}

pub struct FileStorageService<R> {
    repository: R,
}

impl<R> FileStorageService<R>
where
    R: FileManagementRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_storages(
        &self,
        actor_user_id: Uuid,
    ) -> Result<Vec<domain::FileStorageRecord>> {
        let actor = self
            .repository
            .load_actor_context_for_user(actor_user_id)
            .await?;
        if !actor.is_root {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        self.repository.list_file_storages().await
    }

    pub async fn create_storage(
        &self,
        command: CreateFileStorageCommand,
    ) -> Result<domain::FileStorageRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        if !actor.is_root {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        self.repository
            .create_file_storage(&CreateFileStorageInput {
                storage_id: Uuid::now_v7(),
                actor_user_id: command.actor_user_id,
                code: command.code,
                title: command.title,
                driver_type: command.driver_type,
                enabled: command.enabled,
                is_default: command.is_default,
                config_json: command.config_json,
                rule_json: command.rule_json,
            })
            .await
    }

    pub async fn update_storage(
        &self,
        command: UpdateFileStorageCommand,
    ) -> Result<domain::FileStorageRecord> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        if !actor.is_root {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        self.repository
            .update_file_storage(&UpdateFileStorageInput {
                actor_user_id: command.actor_user_id,
                file_storage_id: command.file_storage_id,
                title: command.title,
                enabled: command.enabled,
                is_default: command.is_default,
                config_json: command.config_json,
                rule_json: command.rule_json,
            })
            .await
    }

    pub async fn delete_storage(&self, command: DeleteFileStorageCommand) -> Result<()> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        if !actor.is_root {
            return Err(ControlPlaneError::PermissionDenied("permission_denied").into());
        }

        self.repository
            .delete_file_storage(&DeleteFileStorageInput {
                actor_user_id: command.actor_user_id,
                file_storage_id: command.file_storage_id,
            })
            .await
    }
}
