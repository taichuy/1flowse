use anyhow::Result;
use domain::{ActorContext, UserRecord};
use uuid::Uuid;

use crate::ports::{AuthRepository, UpdateProfileInput};

pub struct MeProfile {
    pub user: UserRecord,
    pub actor: ActorContext,
}

pub struct UpdateMeCommand {
    pub actor_user_id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub nickname: String,
    pub email: String,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub introduction: String,
}

pub struct ProfileService<R> {
    repository: R,
}

impl<R> ProfileService<R>
where
    R: AuthRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    async fn load_profile(
        &self,
        user: UserRecord,
        tenant_id: Uuid,
        workspace_id: Uuid,
    ) -> Result<MeProfile> {
        let actor = self
            .repository
            .load_actor_context(
                user.id,
                tenant_id,
                workspace_id,
                user.default_display_role.as_deref(),
            )
            .await?;

        Ok(MeProfile { user, actor })
    }

    pub async fn get_me(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        workspace_id: Uuid,
    ) -> Result<MeProfile> {
        let user = self
            .repository
            .find_user_by_id(user_id)
            .await?
            .ok_or(crate::errors::ControlPlaneError::NotFound("user"))?;

        self.load_profile(user, tenant_id, workspace_id).await
    }

    pub async fn update_me(&self, command: UpdateMeCommand) -> Result<MeProfile> {
        let user = self
            .repository
            .update_profile(&UpdateProfileInput {
                actor_user_id: command.actor_user_id,
                user_id: command.actor_user_id,
                name: command.name,
                nickname: command.nickname,
                email: command.email,
                phone: command.phone,
                avatar_url: command.avatar_url,
                introduction: command.introduction,
            })
            .await?;

        self.load_profile(user, command.tenant_id, command.workspace_id)
            .await
    }
}
