use anyhow::Result;
use argon2::{
    password_hash::{PasswordHash, PasswordVerifier},
    Argon2,
};
use uuid::Uuid;

use crate::{
    audit::audit_log,
    errors::ControlPlaneError,
    ports::{AuthRepository, SessionStore},
};

pub struct ChangeOwnPasswordCommand {
    pub actor_user_id: Uuid,
    pub session_id: String,
    pub old_password: String,
    pub new_password_hash: String,
}

pub struct RevokeAllSessionsCommand {
    pub actor_user_id: Uuid,
    pub session_id: String,
}

pub struct LogoutCurrentSessionCommand {
    pub session_id: String,
}

pub struct SessionSecurityService<R, S> {
    repository: R,
    session_store: S,
}

impl<R, S> SessionSecurityService<R, S>
where
    R: AuthRepository,
    S: SessionStore,
{
    pub fn new(repository: R, session_store: S) -> Self {
        Self {
            repository,
            session_store,
        }
    }

    pub async fn logout_current_session(&self, command: LogoutCurrentSessionCommand) -> Result<()> {
        self.session_store.delete(&command.session_id).await
    }

    pub async fn revoke_all_sessions(&self, command: RevokeAllSessionsCommand) -> Result<()> {
        let workspace_id = self
            .session_store
            .get(&command.session_id)
            .await?
            .map(|session| session.current_workspace_id);
        self.repository
            .bump_session_version(command.actor_user_id, command.actor_user_id)
            .await?;
        self.session_store.delete(&command.session_id).await?;
        self.repository
            .append_audit_log(&audit_log(
                workspace_id,
                Some(command.actor_user_id),
                "user",
                Some(command.actor_user_id),
                "session.revoke_all",
                serde_json::json!({}),
            ))
            .await?;
        Ok(())
    }

    pub async fn change_own_password(&self, command: ChangeOwnPasswordCommand) -> Result<()> {
        let user = self
            .repository
            .find_user_by_id(command.actor_user_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("user"))?;
        let workspace_id = self
            .session_store
            .get(&command.session_id)
            .await?
            .map(|session| session.current_workspace_id);
        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|err| anyhow::anyhow!("invalid password hash: {err}"))?;
        Argon2::default()
            .verify_password(command.old_password.as_bytes(), &parsed_hash)
            .map_err(|_| ControlPlaneError::InvalidInput("old_password"))?;

        self.repository
            .update_password_hash(
                command.actor_user_id,
                &command.new_password_hash,
                command.actor_user_id,
            )
            .await?;
        self.session_store.delete(&command.session_id).await?;
        self.repository
            .append_audit_log(&audit_log(
                workspace_id,
                Some(command.actor_user_id),
                "user",
                Some(command.actor_user_id),
                "user.password_changed",
                serde_json::json!({}),
            ))
            .await?;

        Ok(())
    }
}
