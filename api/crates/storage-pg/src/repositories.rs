use std::collections::BTreeSet;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use control_plane::{
    errors::ControlPlaneError,
    ports::{
        AuthRepository, BootstrapRepository, CreateMemberInput, MemberRepository, RoleRepository,
        TeamRepository,
    },
};
use domain::{
    ActorContext, AuditLogRecord, AuthenticatorRecord, BoundRole, PermissionDefinition,
    RoleScopeKind, TeamRecord, UserRecord, UserStatus,
};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Clone)]
pub struct PgControlPlaneStore {
    pool: PgPool,
}

impl PgControlPlaneStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn upsert_authenticator(&self, authenticator: &AuthenticatorRecord) -> Result<()> {
        BootstrapRepository::upsert_authenticator(self, authenticator).await
    }

    pub async fn upsert_permission_catalog(
        &self,
        permissions: &[PermissionDefinition],
    ) -> Result<()> {
        BootstrapRepository::upsert_permission_catalog(self, permissions).await
    }

    pub async fn upsert_team(&self, team_name: &str) -> Result<TeamRecord> {
        BootstrapRepository::upsert_team(self, team_name).await
    }

    pub async fn upsert_builtin_roles(&self, team_id: Uuid) -> Result<()> {
        BootstrapRepository::upsert_builtin_roles(self, team_id).await
    }

    pub async fn upsert_root_user(
        &self,
        team_id: Uuid,
        account: &str,
        email: &str,
        password_hash: &str,
        name: &str,
        nickname: &str,
    ) -> Result<UserRecord> {
        BootstrapRepository::upsert_root_user(
            self,
            team_id,
            account,
            email,
            password_hash,
            name,
            nickname,
        )
        .await
    }

    pub async fn find_authenticator(&self, name: &str) -> Result<Option<AuthenticatorRecord>> {
        AuthRepository::find_authenticator(self, name).await
    }

    pub async fn find_user_for_password_login(
        &self,
        identifier: &str,
    ) -> Result<Option<UserRecord>> {
        AuthRepository::find_user_for_password_login(self, identifier).await
    }

    pub async fn find_user_by_id(&self, user_id: Uuid) -> Result<Option<UserRecord>> {
        AuthRepository::find_user_by_id(self, user_id).await
    }

    pub async fn load_actor_context(
        &self,
        user_id: Uuid,
        team_id: Uuid,
        display_role: Option<&str>,
    ) -> Result<ActorContext> {
        AuthRepository::load_actor_context(self, user_id, team_id, display_role).await
    }

    pub async fn update_password_hash(
        &self,
        user_id: Uuid,
        password_hash: &str,
        actor_id: Uuid,
    ) -> Result<i64> {
        AuthRepository::update_password_hash(self, user_id, password_hash, actor_id).await
    }

    pub async fn bump_session_version(&self, user_id: Uuid, actor_id: Uuid) -> Result<i64> {
        AuthRepository::bump_session_version(self, user_id, actor_id).await
    }

    pub async fn list_permissions(&self) -> Result<Vec<PermissionDefinition>> {
        AuthRepository::list_permissions(self).await
    }

    pub async fn append_audit_log(&self, event: &AuditLogRecord) -> Result<()> {
        AuthRepository::append_audit_log(self, event).await
    }

    pub async fn get_team(&self, team_id: Uuid) -> Result<Option<TeamRecord>> {
        TeamRepository::get_team(self, team_id).await
    }

    pub async fn update_team(
        &self,
        actor_user_id: Uuid,
        team_id: Uuid,
        name: &str,
        logo_url: Option<&str>,
        introduction: &str,
    ) -> Result<TeamRecord> {
        TeamRepository::update_team(self, actor_user_id, team_id, name, logo_url, introduction)
            .await
    }
}

fn decode_user_status(value: String) -> UserStatus {
    match value.as_str() {
        "active" => UserStatus::Active,
        _ => UserStatus::Disabled,
    }
}

fn decode_role_scope_kind(value: &str) -> RoleScopeKind {
    match value {
        "app" => RoleScopeKind::App,
        _ => RoleScopeKind::Team,
    }
}

#[derive(Debug, Clone)]
struct StoredRole {
    id: Uuid,
    code: String,
    name: String,
    scope_kind: RoleScopeKind,
    is_builtin: bool,
    is_editable: bool,
}

async fn primary_team_id(pool: &PgPool) -> Result<Uuid> {
    sqlx::query_scalar("select id from teams order by created_at asc limit 1")
        .fetch_optional(pool)
        .await?
        .ok_or(ControlPlaneError::NotFound("team").into())
}

async fn team_id_for_user(pool: &PgPool, user_id: Uuid) -> Result<Uuid> {
    if let Some(team_id) = sqlx::query_scalar(
        r#"
        select team_id
        from team_memberships
        where user_id = $1
        order by created_at asc
        limit 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    {
        Ok(team_id)
    } else {
        primary_team_id(pool).await
    }
}

async fn is_root_user(pool: &PgPool, user_id: Uuid) -> Result<bool> {
    sqlx::query_scalar(
        r#"
        select exists(
          select 1
          from user_role_bindings urb
          join roles r on r.id = urb.role_id
          where urb.user_id = $1
            and r.scope_kind = 'app'
            and r.code = 'root'
        )
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

fn stored_role_from_row(row: sqlx::postgres::PgRow) -> StoredRole {
    let scope_kind: String = row.get("scope_kind");

    StoredRole {
        id: row.get("id"),
        code: row.get("code"),
        name: row.get("name"),
        scope_kind: decode_role_scope_kind(&scope_kind),
        is_builtin: row.get("is_builtin"),
        is_editable: row.get("is_editable"),
    }
}

async fn find_role_by_code(
    pool: &PgPool,
    team_id: Uuid,
    role_code: &str,
) -> Result<Option<StoredRole>> {
    let row = sqlx::query(
        r#"
        select id, code, name, scope_kind, is_builtin, is_editable
        from roles
        where (scope_kind = 'app' and code = $1)
           or (scope_kind = 'team' and team_id = $2 and code = $1)
        order by scope_kind asc
        limit 1
        "#,
    )
    .bind(role_code)
    .bind(team_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(stored_role_from_row))
}

async fn permission_codes_for_role(pool: &PgPool, role_id: Uuid) -> Result<Vec<String>> {
    sqlx::query_scalar(
        r#"
        select pd.code
        from role_permissions rp
        join permission_definitions pd on pd.id = rp.permission_id
        where rp.role_id = $1
        order by pd.code asc
        "#,
    )
    .bind(role_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn load_bound_roles(pool: &PgPool, user_id: Uuid) -> Result<Vec<BoundRole>> {
    let rows = sqlx::query(
        r#"
        select r.code, r.scope_kind, r.team_id
        from user_role_bindings urb
        join roles r on r.id = urb.role_id
        where urb.user_id = $1
        order by r.scope_kind asc, r.code asc
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| BoundRole {
            code: row.get("code"),
            scope_kind: decode_role_scope_kind(row.get::<String, _>("scope_kind").as_str()),
            team_id: row.get("team_id"),
        })
        .collect())
}

async fn map_user_row(pool: &PgPool, row: sqlx::postgres::PgRow) -> Result<UserRecord> {
    let user_id = row.get("id");

    Ok(UserRecord {
        id: user_id,
        account: row.get("account"),
        email: row.get("email"),
        phone: row.get("phone"),
        password_hash: row.get("password_hash"),
        name: row.get("name"),
        nickname: row.get("nickname"),
        avatar_url: row.get("avatar_url"),
        introduction: row.get("introduction"),
        default_display_role: row.get("default_display_role"),
        email_login_enabled: row.get("email_login_enabled"),
        phone_login_enabled: row.get("phone_login_enabled"),
        status: decode_user_status(row.get("status")),
        session_version: row.get("session_version"),
        roles: load_bound_roles(pool, user_id).await?,
    })
}

#[async_trait]
impl BootstrapRepository for PgControlPlaneStore {
    async fn upsert_authenticator(&self, authenticator: &AuthenticatorRecord) -> Result<()> {
        sqlx::query(
            r#"
            insert into authenticators (id, name, auth_type, title, enabled, is_builtin, sort_order, options)
            values ($1, $2, $3, $4, $5, $6, 0, $7)
            on conflict (name) do update
              set auth_type = excluded.auth_type,
                  title = excluded.title,
                  enabled = excluded.enabled,
                  is_builtin = excluded.is_builtin,
                  options = excluded.options,
                  updated_at = now()
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(&authenticator.name)
        .bind(&authenticator.auth_type)
        .bind(&authenticator.title)
        .bind(authenticator.enabled)
        .bind(authenticator.is_builtin)
        .bind(&authenticator.options)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_permission_catalog(&self, permissions: &[PermissionDefinition]) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        for permission in permissions {
            sqlx::query(
                r#"
                insert into permission_definitions (id, resource, action, scope, code, name, introduction)
                values ($1, $2, $3, $4, $5, $6, '')
                on conflict (code) do update
                  set resource = excluded.resource,
                      action = excluded.action,
                      scope = excluded.scope,
                      name = excluded.name,
                      updated_at = now()
                "#,
            )
            .bind(Uuid::now_v7())
            .bind(&permission.resource)
            .bind(&permission.action)
            .bind(&permission.scope)
            .bind(&permission.code)
            .bind(&permission.name)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn upsert_team(&self, team_name: &str) -> Result<TeamRecord> {
        let existing = sqlx::query(
            "select id, name, logo_url, introduction from teams order by created_at asc limit 1",
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = existing {
            return Ok(TeamRecord {
                id: row.get("id"),
                name: row.get("name"),
                logo_url: row.get("logo_url"),
                introduction: row.get("introduction"),
            });
        }

        let id = Uuid::now_v7();
        sqlx::query(
            "insert into teams (id, name, logo_url, introduction) values ($1, $2, null, '')",
        )
        .bind(id)
        .bind(team_name)
        .execute(&self.pool)
        .await?;

        Ok(TeamRecord {
            id,
            name: team_name.to_string(),
            logo_url: None,
            introduction: String::new(),
        })
    }

    async fn upsert_builtin_roles(&self, team_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        for role in access_control::builtin_role_templates() {
            let scope_kind = match role.scope_kind {
                RoleScopeKind::App => "app",
                RoleScopeKind::Team => "team",
            };
            let scoped_team_id = if matches!(role.scope_kind, RoleScopeKind::Team) {
                Some(team_id)
            } else {
                None
            };

            let inserted_role_id: Option<Uuid> = sqlx::query_scalar(
                r#"
                insert into roles (id, scope_kind, team_id, code, name, introduction, is_builtin, is_editable, system_kind)
                values ($1, $2, $3, $4, $5, '', $6, $7, $8)
                on conflict do nothing
                returning id
                "#,
            )
            .bind(Uuid::now_v7())
            .bind(scope_kind)
            .bind(scoped_team_id)
            .bind(&role.code)
            .bind(&role.name)
            .bind(role.is_builtin)
            .bind(role.is_editable)
            .bind(&role.code)
            .fetch_optional(&mut *tx)
            .await?;

            let role_id: Uuid = match role.scope_kind {
                RoleScopeKind::App => {
                    sqlx::query_scalar(
                        "select id from roles where scope_kind = 'app' and code = $1",
                    )
                    .bind(&role.code)
                    .fetch_one(&mut *tx)
                    .await?
                }
                RoleScopeKind::Team => sqlx::query_scalar(
                    "select id from roles where scope_kind = 'team' and team_id = $1 and code = $2",
                )
                .bind(team_id)
                .bind(&role.code)
                .fetch_one(&mut *tx)
                .await?,
            };

            if inserted_role_id.is_some() {
                for permission_code in role.permissions {
                    sqlx::query(
                        r#"
                        insert into role_permissions (id, role_id, permission_id)
                        select $1, $2, id
                        from permission_definitions
                        where code = $3
                        on conflict (role_id, permission_id) do nothing
                        "#,
                    )
                    .bind(Uuid::now_v7())
                    .bind(role_id)
                    .bind(permission_code)
                    .execute(&mut *tx)
                    .await?;
                }
            }
        }

        tx.commit().await?;
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
        if let Some(user) = self.find_user_for_password_login(account).await? {
            return Ok(user);
        }

        let user_id = Uuid::now_v7();
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            insert into users (
                id, account, email, phone, password_hash, name, nickname, avatar_url, introduction,
                default_display_role, email_login_enabled, phone_login_enabled, status, session_version
            )
            values ($1, $2, $3, null, $4, $5, $6, null, '', 'root', true, false, 'active', 1)
            "#,
        )
        .bind(user_id)
        .bind(account)
        .bind(email)
        .bind(password_hash)
        .bind(name)
        .bind(nickname)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "insert into team_memberships (id, team_id, user_id, introduction) values ($1, $2, $3, '') on conflict (team_id, user_id) do nothing",
        )
        .bind(Uuid::now_v7())
        .bind(team_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            insert into user_role_bindings (id, user_id, role_id)
            select $1, $2, id from roles where code = 'root' and scope_kind = 'app'
            on conflict (user_id, role_id) do nothing
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        self.find_user_by_id(user_id)
            .await?
            .ok_or_else(|| anyhow!("root user missing after bootstrap"))
    }
}

#[async_trait]
impl AuthRepository for PgControlPlaneStore {
    async fn find_authenticator(&self, name: &str) -> Result<Option<AuthenticatorRecord>> {
        let row = sqlx::query(
            "select name, auth_type, title, enabled, is_builtin, options from authenticators where name = $1",
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| AuthenticatorRecord {
            name: row.get("name"),
            auth_type: row.get("auth_type"),
            title: row.get("title"),
            enabled: row.get("enabled"),
            is_builtin: row.get("is_builtin"),
            options: row.get("options"),
        }))
    }

    async fn find_user_for_password_login(&self, identifier: &str) -> Result<Option<UserRecord>> {
        let lowered = identifier.trim().to_lowercase();
        let row = sqlx::query(
            r#"
            select
              u.id, u.account, u.email, u.phone, u.password_hash, u.name, u.nickname, u.avatar_url,
              u.introduction, u.default_display_role, u.email_login_enabled, u.phone_login_enabled,
              u.status, u.session_version
            from users u
            where lower(u.account) = $1
               or (u.email_login_enabled = true and lower(u.email) = $1)
               or (u.phone_login_enabled = true and lower(coalesce(u.phone, '')) = $1)
            limit 1
            "#,
        )
        .bind(lowered)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(map_user_row(&self.pool, row).await?)),
            None => Ok(None),
        }
    }

    async fn find_user_by_id(&self, user_id: Uuid) -> Result<Option<UserRecord>> {
        let row = sqlx::query(
            r#"
            select id, account, email, phone, password_hash, name, nickname, avatar_url,
                   introduction, default_display_role, email_login_enabled, phone_login_enabled,
                   status, session_version
            from users where id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(map_user_row(&self.pool, row).await?)),
            None => Ok(None),
        }
    }

    async fn load_actor_context(
        &self,
        user_id: Uuid,
        team_id: Uuid,
        display_role: Option<&str>,
    ) -> Result<ActorContext> {
        let codes: Vec<String> = sqlx::query_scalar(
            r#"
            select r.code
            from user_role_bindings urb
            join roles r on r.id = urb.role_id
            where urb.user_id = $1 and (r.scope_kind = 'app' or r.team_id = $2)
            order by r.scope_kind asc, r.code asc
            "#,
        )
        .bind(user_id)
        .bind(team_id)
        .fetch_all(&self.pool)
        .await?;

        let permissions: Vec<String> = sqlx::query_scalar(
            r#"
            select distinct pd.code
            from user_role_bindings urb
            join roles r on r.id = urb.role_id
            join role_permissions rp on rp.role_id = r.id
            join permission_definitions pd on pd.id = rp.permission_id
            where urb.user_id = $1 and (r.scope_kind = 'app' or r.team_id = $2)
            order by pd.code asc
            "#,
        )
        .bind(user_id)
        .bind(team_id)
        .fetch_all(&self.pool)
        .await?;

        let effective_display_role = display_role
            .map(str::to_string)
            .or_else(|| codes.first().cloned())
            .unwrap_or_else(|| "manager".to_string());

        Ok(ActorContext {
            user_id,
            team_id,
            effective_display_role,
            is_root: codes.iter().any(|code| code == "root"),
            permissions: permissions.into_iter().collect(),
        })
    }

    async fn update_password_hash(
        &self,
        user_id: Uuid,
        password_hash: &str,
        actor_id: Uuid,
    ) -> Result<i64> {
        let row = sqlx::query(
            r#"
            update users
            set password_hash = $2,
                session_version = session_version + 1,
                updated_by = $3,
                updated_at = now()
            where id = $1
            returning session_version
            "#,
        )
        .bind(user_id)
        .bind(password_hash)
        .bind(actor_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.get("session_version"))
    }

    async fn bump_session_version(&self, user_id: Uuid, actor_id: Uuid) -> Result<i64> {
        let row = sqlx::query(
            r#"
            update users
            set session_version = session_version + 1,
                updated_by = $2,
                updated_at = now()
            where id = $1
            returning session_version
            "#,
        )
        .bind(user_id)
        .bind(actor_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.get("session_version"))
    }

    async fn list_permissions(&self) -> Result<Vec<PermissionDefinition>> {
        let rows = sqlx::query(
            "select code, resource, action, scope, name from permission_definitions order by code asc",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| PermissionDefinition {
                code: row.get("code"),
                resource: row.get("resource"),
                action: row.get("action"),
                scope: row.get("scope"),
                name: row.get("name"),
            })
            .collect())
    }

    async fn append_audit_log(&self, event: &AuditLogRecord) -> Result<()> {
        sqlx::query(
            r#"
            insert into audit_logs (id, team_id, actor_user_id, target_type, target_id, event_code, payload, created_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(event.id)
        .bind(event.team_id)
        .bind(event.actor_user_id)
        .bind(&event.target_type)
        .bind(event.target_id)
        .bind(&event.event_code)
        .bind(&event.payload)
        .bind(event.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

#[async_trait]
impl TeamRepository for PgControlPlaneStore {
    async fn get_team(&self, team_id: Uuid) -> Result<Option<TeamRecord>> {
        let row = sqlx::query("select id, name, logo_url, introduction from teams where id = $1")
            .bind(team_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|row| TeamRecord {
            id: row.get("id"),
            name: row.get("name"),
            logo_url: row.get("logo_url"),
            introduction: row.get("introduction"),
        }))
    }

    async fn update_team(
        &self,
        actor_user_id: Uuid,
        team_id: Uuid,
        name: &str,
        logo_url: Option<&str>,
        introduction: &str,
    ) -> Result<TeamRecord> {
        let row = sqlx::query(
            r#"
            update teams
            set name = $2,
                logo_url = $3,
                introduction = $4,
                updated_by = $5,
                updated_at = now()
            where id = $1
            returning id, name, logo_url, introduction
            "#,
        )
        .bind(team_id)
        .bind(name)
        .bind(logo_url)
        .bind(introduction)
        .bind(actor_user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(TeamRecord {
            id: row.get("id"),
            name: row.get("name"),
            logo_url: row.get("logo_url"),
            introduction: row.get("introduction"),
        })
    }
}

#[async_trait]
impl MemberRepository for PgControlPlaneStore {
    async fn load_actor_context_for_user(&self, actor_user_id: Uuid) -> Result<ActorContext> {
        let team_id = team_id_for_user(&self.pool, actor_user_id).await?;
        AuthRepository::load_actor_context(self, actor_user_id, team_id, None).await
    }

    async fn create_member_with_default_role(
        &self,
        input: &CreateMemberInput,
    ) -> Result<UserRecord> {
        let team_id = primary_team_id(&self.pool).await?;
        let manager_role_id: Uuid = sqlx::query_scalar(
            "select id from roles where scope_kind = 'team' and team_id = $1 and code = 'manager'",
        )
        .bind(team_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ControlPlaneError::NotFound("manager_role"))?;
        let user_id = Uuid::now_v7();
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            insert into users (
                id, account, email, phone, password_hash, name, nickname, avatar_url, introduction,
                default_display_role, email_login_enabled, phone_login_enabled, status, session_version,
                created_by, updated_by
            )
            values (
                $1, $2, $3, $4, $5, $6, $7, null, $8,
                'manager', $9, $10, 'active', 1, $11, $11
            )
            "#,
        )
        .bind(user_id)
        .bind(&input.account)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(&input.password_hash)
        .bind(&input.name)
        .bind(&input.nickname)
        .bind(&input.introduction)
        .bind(input.email_login_enabled)
        .bind(input.phone_login_enabled)
        .bind(input.actor_user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            insert into team_memberships (id, team_id, user_id, introduction, created_by, updated_by)
            values ($1, $2, $3, $4, $5, $5)
            on conflict (team_id, user_id) do nothing
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(team_id)
        .bind(user_id)
        .bind(&input.introduction)
        .bind(input.actor_user_id)
        .execute(&mut *tx)
        .await?;

        for (subject_type, subject_value) in [
            ("account", Some(input.account.as_str())),
            ("email", Some(input.email.as_str())),
            ("phone", input.phone.as_deref()),
        ] {
            if let Some(subject_value) = subject_value {
                sqlx::query(
                    r#"
                    insert into user_auth_identities (
                        id, user_id, authenticator_name, subject_type, subject_value, metadata,
                        created_by, updated_by
                    )
                    values ($1, $2, 'password-local', $3, $4, '{}'::jsonb, $5, $5)
                    on conflict (authenticator_name, subject_type, lower(subject_value)) do nothing
                    "#,
                )
                .bind(Uuid::now_v7())
                .bind(user_id)
                .bind(subject_type)
                .bind(subject_value)
                .bind(input.actor_user_id)
                .execute(&mut *tx)
                .await?;
            }
        }

        sqlx::query(
            r#"
            insert into user_role_bindings (id, user_id, role_id, created_by, updated_by)
            values ($1, $2, $3, $4, $4)
            on conflict (user_id, role_id) do nothing
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(user_id)
        .bind(manager_role_id)
        .bind(input.actor_user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        self.find_user_by_id(user_id)
            .await?
            .ok_or_else(|| anyhow!("member missing after creation"))
    }

    async fn disable_member(&self, actor_user_id: Uuid, target_user_id: Uuid) -> Result<()> {
        if is_root_user(&self.pool, target_user_id).await? {
            return Err(ControlPlaneError::PermissionDenied("root_user_immutable").into());
        }

        let result = sqlx::query(
            r#"
            update users
            set status = 'disabled',
                session_version = session_version + 1,
                updated_by = $2,
                updated_at = now()
            where id = $1
            "#,
        )
        .bind(target_user_id)
        .bind(actor_user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ControlPlaneError::NotFound("user").into());
        }

        Ok(())
    }

    async fn reset_member_password(
        &self,
        actor_user_id: Uuid,
        target_user_id: Uuid,
        password_hash: &str,
    ) -> Result<()> {
        if is_root_user(&self.pool, target_user_id).await? {
            return Err(ControlPlaneError::PermissionDenied("root_user_immutable").into());
        }

        let result = sqlx::query(
            r#"
            update users
            set password_hash = $2,
                session_version = session_version + 1,
                updated_by = $3,
                updated_at = now()
            where id = $1
            "#,
        )
        .bind(target_user_id)
        .bind(password_hash)
        .bind(actor_user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ControlPlaneError::NotFound("user").into());
        }

        Ok(())
    }

    async fn replace_member_roles(
        &self,
        actor_user_id: Uuid,
        target_user_id: Uuid,
        role_codes: &[String],
    ) -> Result<()> {
        if is_root_user(&self.pool, target_user_id).await? {
            return Err(ControlPlaneError::PermissionDenied("root_user_immutable").into());
        }

        let team_id = primary_team_id(&self.pool).await?;
        let normalized_codes = role_codes
            .iter()
            .map(|code| code.trim())
            .filter(|code| !code.is_empty())
            .map(str::to_string)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();

        let mut role_ids = Vec::new();
        for role_code in &normalized_codes {
            let role_id: Uuid = sqlx::query_scalar(
                "select id from roles where scope_kind = 'team' and team_id = $1 and code = $2",
            )
            .bind(team_id)
            .bind(role_code)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(ControlPlaneError::InvalidInput("role_code"))?;
            role_ids.push(role_id);
        }

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"
            delete from user_role_bindings urb
            using roles r
            where urb.role_id = r.id
              and urb.user_id = $1
              and r.scope_kind = 'team'
              and r.team_id = $2
            "#,
        )
        .bind(target_user_id)
        .bind(team_id)
        .execute(&mut *tx)
        .await?;

        for role_id in role_ids {
            sqlx::query(
                r#"
                insert into user_role_bindings (id, user_id, role_id, created_by, updated_by)
                values ($1, $2, $3, $4, $4)
                on conflict (user_id, role_id) do nothing
                "#,
            )
            .bind(Uuid::now_v7())
            .bind(target_user_id)
            .bind(role_id)
            .bind(actor_user_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn list_members(&self) -> Result<Vec<UserRecord>> {
        let team_id = primary_team_id(&self.pool).await?;
        let rows = sqlx::query(
            r#"
            select
              u.id, u.account, u.email, u.phone, u.password_hash, u.name, u.nickname, u.avatar_url,
              u.introduction, u.default_display_role, u.email_login_enabled, u.phone_login_enabled,
              u.status, u.session_version
            from team_memberships tm
            join users u on u.id = tm.user_id
            where tm.team_id = $1
            order by tm.created_at asc, u.created_at asc
            "#,
        )
        .bind(team_id)
        .fetch_all(&self.pool)
        .await?;

        let mut members = Vec::with_capacity(rows.len());
        for row in rows {
            members.push(map_user_row(&self.pool, row).await?);
        }

        Ok(members)
    }

    async fn append_audit_log(&self, event: &AuditLogRecord) -> Result<()> {
        AuthRepository::append_audit_log(self, event).await
    }
}

#[async_trait]
impl RoleRepository for PgControlPlaneStore {
    async fn load_actor_context_for_user(&self, actor_user_id: Uuid) -> Result<ActorContext> {
        let team_id = team_id_for_user(&self.pool, actor_user_id).await?;
        AuthRepository::load_actor_context(self, actor_user_id, team_id, None).await
    }

    async fn list_roles(&self) -> Result<Vec<domain::RoleTemplate>> {
        let team_id = primary_team_id(&self.pool).await?;
        let rows = sqlx::query(
            r#"
            select id, code, name, scope_kind, is_builtin, is_editable
            from roles
            where scope_kind = 'app' or team_id = $1
            order by scope_kind asc, code asc
            "#,
        )
        .bind(team_id)
        .fetch_all(&self.pool)
        .await?;

        let mut roles = Vec::with_capacity(rows.len());
        for row in rows {
            let role = stored_role_from_row(row);
            roles.push(domain::RoleTemplate {
                code: role.code,
                name: role.name,
                scope_kind: role.scope_kind,
                is_builtin: role.is_builtin,
                is_editable: role.is_editable,
                permissions: permission_codes_for_role(&self.pool, role.id).await?,
            });
        }

        Ok(roles)
    }

    async fn create_team_role(
        &self,
        actor_user_id: Uuid,
        code: &str,
        name: &str,
        introduction: &str,
    ) -> Result<()> {
        let team_id = primary_team_id(&self.pool).await?;
        if find_role_by_code(&self.pool, team_id, code)
            .await?
            .is_some()
        {
            return Err(ControlPlaneError::Conflict("role_code").into());
        }

        sqlx::query(
            r#"
            insert into roles (
                id, scope_kind, team_id, code, name, introduction, is_builtin, is_editable,
                created_by, updated_by
            )
            values ($1, 'team', $2, $3, $4, $5, false, true, $6, $6)
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(team_id)
        .bind(code)
        .bind(name)
        .bind(introduction)
        .bind(actor_user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_team_role(
        &self,
        actor_user_id: Uuid,
        role_code: &str,
        name: &str,
        introduction: &str,
    ) -> Result<()> {
        let team_id = primary_team_id(&self.pool).await?;
        let role = find_role_by_code(&self.pool, team_id, role_code)
            .await?
            .ok_or(ControlPlaneError::NotFound("role"))?;
        if role.code == "root" || !role.is_editable || matches!(role.scope_kind, RoleScopeKind::App)
        {
            return Err(ControlPlaneError::PermissionDenied("root_role_immutable").into());
        }

        let result = sqlx::query(
            r#"
            update roles
            set name = $2,
                introduction = $3,
                updated_by = $4,
                updated_at = now()
            where id = $1
            "#,
        )
        .bind(role.id)
        .bind(name)
        .bind(introduction)
        .bind(actor_user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(ControlPlaneError::NotFound("role").into());
        }

        Ok(())
    }

    async fn delete_team_role(&self, _actor_user_id: Uuid, role_code: &str) -> Result<()> {
        let team_id = primary_team_id(&self.pool).await?;
        let role = find_role_by_code(&self.pool, team_id, role_code)
            .await?
            .ok_or(ControlPlaneError::NotFound("role"))?;
        if role.code == "root" || role.is_builtin || matches!(role.scope_kind, RoleScopeKind::App) {
            return Err(ControlPlaneError::PermissionDenied("builtin_role_immutable").into());
        }

        let binding_count: i64 =
            sqlx::query_scalar("select count(*) from user_role_bindings where role_id = $1")
                .bind(role.id)
                .fetch_one(&self.pool)
                .await?;
        if binding_count > 0 {
            return Err(ControlPlaneError::Conflict("role_in_use").into());
        }

        sqlx::query("delete from roles where id = $1")
            .bind(role.id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn replace_role_permissions(
        &self,
        actor_user_id: Uuid,
        role_code: &str,
        permission_codes: &[String],
    ) -> Result<()> {
        let team_id = primary_team_id(&self.pool).await?;
        let role = find_role_by_code(&self.pool, team_id, role_code)
            .await?
            .ok_or(ControlPlaneError::NotFound("role"))?;
        if role.code == "root" || !role.is_editable {
            return Err(ControlPlaneError::PermissionDenied("root_role_immutable").into());
        }

        let normalized_codes = permission_codes
            .iter()
            .map(|code| code.trim())
            .filter(|code| !code.is_empty())
            .map(str::to_string)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let mut permission_ids = Vec::with_capacity(normalized_codes.len());
        for permission_code in &normalized_codes {
            let permission_id: Uuid =
                sqlx::query_scalar("select id from permission_definitions where code = $1")
                    .bind(permission_code)
                    .fetch_optional(&self.pool)
                    .await?
                    .ok_or(ControlPlaneError::InvalidInput("permission_code"))?;
            permission_ids.push(permission_id);
        }

        let mut tx = self.pool.begin().await?;
        sqlx::query("delete from role_permissions where role_id = $1")
            .bind(role.id)
            .execute(&mut *tx)
            .await?;

        for permission_id in permission_ids {
            sqlx::query(
                r#"
                insert into role_permissions (id, role_id, permission_id, created_by, updated_by)
                values ($1, $2, $3, $4, $4)
                on conflict (role_id, permission_id) do nothing
                "#,
            )
            .bind(Uuid::now_v7())
            .bind(role.id)
            .bind(permission_id)
            .bind(actor_user_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn list_role_permissions(&self, role_code: &str) -> Result<Vec<String>> {
        let team_id = primary_team_id(&self.pool).await?;
        let role = find_role_by_code(&self.pool, team_id, role_code)
            .await?
            .ok_or(ControlPlaneError::NotFound("role"))?;

        permission_codes_for_role(&self.pool, role.id).await
    }

    async fn append_audit_log(&self, event: &AuditLogRecord) -> Result<()> {
        AuthRepository::append_audit_log(self, event).await
    }
}
