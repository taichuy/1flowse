use access_control::ensure_permission;
use anyhow::Result;
use domain::{ActorContext, WorkspaceRecord};
use uuid::Uuid;

use crate::{errors::ControlPlaneError, ports::WorkspaceRepository};

pub struct UpdateWorkspaceCommand {
    pub actor: ActorContext,
    pub workspace_id: Uuid,
    pub name: String,
    pub logo_url: Option<String>,
    pub introduction: String,
}

pub struct WorkspaceService<R> {
    repository: R,
}

impl<R> WorkspaceService<R>
where
    R: WorkspaceRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn get_workspace(&self, workspace_id: Uuid) -> Result<WorkspaceRecord> {
        self.repository
            .get_workspace(workspace_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("workspace").into())
    }

    pub async fn list_accessible_workspaces(&self, user_id: Uuid) -> Result<Vec<WorkspaceRecord>> {
        self.repository.list_accessible_workspaces(user_id).await
    }

    pub async fn get_accessible_workspace(
        &self,
        user_id: Uuid,
        workspace_id: Uuid,
    ) -> Result<WorkspaceRecord> {
        self.repository
            .get_accessible_workspace(user_id, workspace_id)
            .await?
            .ok_or(ControlPlaneError::PermissionDenied("workspace_access_denied").into())
    }

    pub async fn update_workspace(
        &self,
        command: UpdateWorkspaceCommand,
    ) -> Result<WorkspaceRecord> {
        ensure_permission(&command.actor, "workspace.configure.all")
            .map_err(ControlPlaneError::PermissionDenied)?;

        self.repository
            .update_workspace(
                command.actor.user_id,
                command.workspace_id,
                &command.name,
                command.logo_url.as_deref(),
                &command.introduction,
            )
            .await
    }
}
