use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::ports::{BootstrapRepository, CreateMemberInput, MemberRepository, RoleRepository};
use domain::{
    ActorContext, AuditLogRecord, AuthenticatorRecord, BoundRole, PermissionDefinition,
    RoleScopeKind, RoleTemplate, TeamRecord, UserRecord, UserStatus,
};

#[derive(Default, Clone)]
pub struct MemoryBootstrapRepository {
    inner: Arc<MemoryBootstrapRepositoryInner>,
}

#[derive(Default)]
struct MemoryBootstrapRepositoryInner {
    authenticator_upserts: AtomicUsize,
    root_user_creates: AtomicUsize,
    team: RwLock<Option<TeamRecord>>,
    root_user: RwLock<Option<UserRecord>>,
}

impl MemoryBootstrapRepository {
    pub fn authenticator_upserts(&self) -> usize {
        self.inner.authenticator_upserts.load(Ordering::SeqCst)
    }

    pub fn root_user_creates(&self) -> usize {
        self.inner.root_user_creates.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl BootstrapRepository for MemoryBootstrapRepository {
    async fn upsert_authenticator(&self, _authenticator: &AuthenticatorRecord) -> Result<()> {
        self.inner
            .authenticator_upserts
            .fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    async fn upsert_permission_catalog(&self, _permissions: &[PermissionDefinition]) -> Result<()> {
        Ok(())
    }

    async fn upsert_team(&self, team_name: &str) -> Result<TeamRecord> {
        if let Some(team) = self.inner.team.read().await.clone() {
            return Ok(team);
        }

        let team = TeamRecord {
            id: Uuid::now_v7(),
            name: team_name.to_string(),
            logo_url: None,
            introduction: String::new(),
        };
        *self.inner.team.write().await = Some(team.clone());
        Ok(team)
    }

    async fn upsert_builtin_roles(&self, _team_id: Uuid) -> Result<()> {
        Ok(())
    }

    async fn upsert_root_user(
        &self,
        team_id: Uuid,
        account: &str,
        email: &str,
        password_hash: &str,
        name: &str,
        nickname: &str,
    ) -> Result<UserRecord> {
        if let Some(user) = self.inner.root_user.read().await.clone() {
            return Ok(user);
        }

        self.inner.root_user_creates.fetch_add(1, Ordering::SeqCst);
        let user = UserRecord {
            id: Uuid::now_v7(),
            account: account.to_string(),
            email: email.to_string(),
            phone: None,
            password_hash: password_hash.to_string(),
            name: name.to_string(),
            nickname: nickname.to_string(),
            avatar_url: None,
            introduction: String::new(),
            default_display_role: Some("root".to_string()),
            email_login_enabled: true,
            phone_login_enabled: false,
            status: UserStatus::Active,
            session_version: 1,
            roles: vec![BoundRole {
                code: "root".to_string(),
                scope_kind: RoleScopeKind::App,
                team_id: Some(team_id),
            }],
        };
        *self.inner.root_user.write().await = Some(user.clone());
        Ok(user)
    }
}

#[derive(Debug, Clone)]
pub struct CreatedMember {
    pub role_codes: Vec<String>,
}

#[derive(Clone)]
pub struct MemoryMemberRepository {
    root_user_id: Uuid,
    created_members: Arc<RwLock<Vec<CreatedMember>>>,
    audit_events: Arc<RwLock<Vec<String>>>,
}

impl Default for MemoryMemberRepository {
    fn default() -> Self {
        Self {
            root_user_id: Uuid::now_v7(),
            created_members: Arc::new(RwLock::new(Vec::new())),
            audit_events: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl MemoryMemberRepository {
    pub fn root_user_id(&self) -> Uuid {
        self.root_user_id
    }

    pub fn created_members(&self) -> Vec<CreatedMember> {
        self.created_members
            .try_read()
            .expect("created_members lock should be free in assertions")
            .clone()
    }

    pub fn audit_events(&self) -> Vec<String> {
        self.audit_events
            .try_read()
            .expect("audit_events lock should be free in assertions")
            .clone()
    }
}

#[async_trait]
impl MemberRepository for MemoryMemberRepository {
    async fn load_actor_context_for_user(&self, actor_user_id: Uuid) -> Result<ActorContext> {
        Ok(ActorContext::root(actor_user_id, Uuid::nil(), "root"))
    }

    async fn create_member_with_default_role(
        &self,
        _input: &CreateMemberInput,
    ) -> Result<UserRecord> {
        self.created_members.write().await.push(CreatedMember {
            role_codes: vec!["manager".to_string()],
        });
        Ok(UserRecord {
            id: Uuid::now_v7(),
            account: "manager-1".to_string(),
            email: "manager-1@example.com".to_string(),
            phone: Some("13800000000".to_string()),
            password_hash: "hash".to_string(),
            name: "Manager 1".to_string(),
            nickname: "Manager 1".to_string(),
            avatar_url: None,
            introduction: String::new(),
            default_display_role: Some("manager".to_string()),
            email_login_enabled: true,
            phone_login_enabled: false,
            status: UserStatus::Active,
            session_version: 1,
            roles: vec![BoundRole {
                code: "manager".to_string(),
                scope_kind: RoleScopeKind::Team,
                team_id: Some(Uuid::nil()),
            }],
        })
    }

    async fn disable_member(&self, _actor_user_id: Uuid, _target_user_id: Uuid) -> Result<()> {
        Ok(())
    }

    async fn reset_member_password(
        &self,
        _actor_user_id: Uuid,
        _target_user_id: Uuid,
        _password_hash: &str,
    ) -> Result<()> {
        Ok(())
    }

    async fn replace_member_roles(
        &self,
        _actor_user_id: Uuid,
        _target_user_id: Uuid,
        _role_codes: &[String],
    ) -> Result<()> {
        Ok(())
    }

    async fn list_members(&self) -> Result<Vec<UserRecord>> {
        Ok(Vec::new())
    }

    async fn append_audit_log(&self, event: &AuditLogRecord) -> Result<()> {
        self.audit_events
            .write()
            .await
            .push(event.event_code.clone());
        Ok(())
    }
}

#[derive(Clone)]
pub struct MemoryRoleRepository {
    root_user_id: Uuid,
    roles: Arc<RwLock<Vec<RoleTemplate>>>,
}

impl Default for MemoryRoleRepository {
    fn default() -> Self {
        Self {
            root_user_id: Uuid::now_v7(),
            roles: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl MemoryRoleRepository {
    pub fn root_user_id(&self) -> Uuid {
        self.root_user_id
    }
}

#[async_trait]
impl RoleRepository for MemoryRoleRepository {
    async fn load_actor_context_for_user(&self, actor_user_id: Uuid) -> Result<ActorContext> {
        Ok(ActorContext::root(actor_user_id, Uuid::nil(), "root"))
    }

    async fn list_roles(&self) -> Result<Vec<RoleTemplate>> {
        Ok(self.roles.read().await.clone())
    }

    async fn create_team_role(
        &self,
        _actor_user_id: Uuid,
        code: &str,
        name: &str,
        _introduction: &str,
    ) -> Result<()> {
        self.roles.write().await.push(RoleTemplate {
            code: code.to_string(),
            name: name.to_string(),
            scope_kind: RoleScopeKind::Team,
            is_builtin: false,
            is_editable: true,
            permissions: Vec::new(),
        });
        Ok(())
    }

    async fn update_team_role(
        &self,
        _actor_user_id: Uuid,
        _role_code: &str,
        _name: &str,
        _introduction: &str,
    ) -> Result<()> {
        Ok(())
    }

    async fn delete_team_role(&self, _actor_user_id: Uuid, _role_code: &str) -> Result<()> {
        Ok(())
    }

    async fn replace_role_permissions(
        &self,
        _actor_user_id: Uuid,
        role_code: &str,
        permission_codes: &[String],
    ) -> Result<()> {
        if let Some(role) = self
            .roles
            .write()
            .await
            .iter_mut()
            .find(|role| role.code == role_code)
        {
            role.permissions = permission_codes.to_vec();
        }
        Ok(())
    }

    async fn list_role_permissions(&self, role_code: &str) -> Result<Vec<String>> {
        Ok(self
            .roles
            .read()
            .await
            .iter()
            .find(|role| role.code == role_code)
            .map(|role| role.permissions.clone())
            .unwrap_or_default())
    }

    async fn append_audit_log(&self, _event: &AuditLogRecord) -> Result<()> {
        Ok(())
    }
}
