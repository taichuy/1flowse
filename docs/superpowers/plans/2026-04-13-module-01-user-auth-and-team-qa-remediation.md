# 01 User Auth And Team QA Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the module 01 backend QA gaps around session lifecycle, password rotation, member action routes, and the module-owned OpenAPI contract without mixing in model ACL or runtime registry work.

**Architecture:** Keep the existing `api-server -> control-plane -> storage-pg/storage-redis` layering. Add one focused `SessionSecurityService` inside `control-plane` for current-user password/session actions, keep member administration in `MemberService`, and normalize all module 01 mutation routes to `/actions/*` while letting `api-server` own cookie clearing and OpenAPI aggregation.

**Tech Stack:** Rust stable, Axum, utoipa, SQLx/PostgreSQL, Redis or in-memory session store, argon2

**Source Specs:** `docs/superpowers/specs/1flowse/2026-04-13-backend-qa-remediation-design.md`, `docs/superpowers/specs/1flowse/modules/01-user-auth-and-team/README.md`, `docs/superpowers/specs/1flowse/2026-04-12-auth-team-access-control-backend-design.md`

**Approval:** User reviewed the current backend QA remediation discussion and requested splitting it into module-scoped backend plans starting with module 01 on `2026-04-13 14`.

---

## Scope Split

This plan intentionally implements only the module 01 slice of the total QA remediation work.

- In scope:
  - `DELETE /api/console/session`
  - `POST /api/console/session/actions/revoke-all`
  - `POST /api/console/me/actions/change-password`
  - `POST /api/console/members/:id/actions/disable`
  - `POST /api/console/members/:id/actions/reset-password`
  - Module 01 OpenAPI cleanup for `session`, `me`, and `members`
  - Session invalidation regressions tied to password reset, password change, disable, and revoke-all
- Out of scope:
  - `state_model` / `state_data` ACL closure
  - `GET /api/console/models/:id` permission repair
  - Runtime registry refresh relocation
  - Runtime route or model-definition OpenAPI cleanup outside module 01

## File Structure

**Create**
- `api/crates/control-plane/src/session_security.rs`
- `api/crates/control-plane/src/_tests/session_security_service_tests.rs`
- `api/apps/api-server/src/_tests/me_routes.rs`

**Modify**
- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/_tests/mod.rs`
- `api/apps/api-server/src/lib.rs`
- `api/apps/api-server/src/routes/me.rs`
- `api/apps/api-server/src/routes/members.rs`
- `api/apps/api-server/src/routes/session.rs`
- `api/apps/api-server/src/_tests/mod.rs`
- `api/apps/api-server/src/_tests/member_routes.rs`
- `api/apps/api-server/src/_tests/session_routes.rs`
- `api/apps/api-server/tests/health_routes.rs`

**Notes**
- Do not reopen login-provider, bootstrap, or role-template design in this plan.
- `DELETE /api/console/session` is the only module 01 endpoint that must actively clear the browser cookie; `change-password` and `revoke-all` may leave a stale cookie because `session_version` makes it unusable on the next request.
- `ResetMemberPasswordBody` must move from `password` to `new_password` to match the spec wording and keep member reset distinct from self-service password change.
- Old mutation paths such as `/members/:id/reset-password` and `/members/:id/disable` must be removed, not kept as silent aliases.

### Task 1: Add The Module 01 Session Security Service

**Files:**
- Create: `api/crates/control-plane/src/session_security.rs`
- Create: `api/crates/control-plane/src/_tests/session_security_service_tests.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

- [ ] **Step 1: Write the failing service tests**

Create `api/crates/control-plane/src/_tests/session_security_service_tests.rs`:

```rust
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use anyhow::Result;
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, SaltString},
    Argon2, PasswordVerifier,
};
use async_trait::async_trait;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{
    ports::{AuthRepository, SessionStore},
    session_security::{ChangeOwnPasswordCommand, RevokeAllSessionsCommand, SessionSecurityService},
};
use domain::{
    ActorContext, AuditLogRecord, AuthenticatorRecord, BoundRole, PermissionDefinition,
    RoleScopeKind, SessionRecord, UserRecord, UserStatus,
};

fn hash_password(password: &str) -> String {
    let salt = SaltString::from_b64("dGVzdHRlc3RzYWx0MTIzNA").unwrap();
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string()
}

#[derive(Clone)]
struct MemoryAuthRepository {
    user: Arc<RwLock<UserRecord>>,
    updated_hashes: Arc<RwLock<Vec<String>>>,
    bump_calls: Arc<AtomicUsize>,
}

impl MemoryAuthRepository {
    fn new(password: &str) -> Self {
        Self {
            user: Arc::new(RwLock::new(UserRecord {
                id: Uuid::now_v7(),
                account: "root".into(),
                email: "root@example.com".into(),
                phone: None,
                password_hash: hash_password(password),
                name: "Root".into(),
                nickname: "Root".into(),
                avatar_url: None,
                introduction: String::new(),
                default_display_role: Some("root".into()),
                email_login_enabled: true,
                phone_login_enabled: false,
                status: UserStatus::Active,
                session_version: 1,
                roles: vec![BoundRole {
                    code: "root".into(),
                    scope_kind: RoleScopeKind::App,
                    team_id: None,
                }],
            })),
            updated_hashes: Arc::new(RwLock::new(Vec::new())),
            bump_calls: Arc::new(AtomicUsize::new(0)),
        }
    }

    async fn current_hash(&self) -> String {
        self.user.read().await.password_hash.clone()
    }

    fn bump_count(&self) -> usize {
        self.bump_calls.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl AuthRepository for MemoryAuthRepository {
    async fn find_authenticator(&self, _name: &str) -> Result<Option<AuthenticatorRecord>> {
        Ok(None)
    }

    async fn find_user_for_password_login(&self, _identifier: &str) -> Result<Option<UserRecord>> {
        Ok(None)
    }

    async fn find_user_by_id(&self, _user_id: Uuid) -> Result<Option<UserRecord>> {
        Ok(Some(self.user.read().await.clone()))
    }

    async fn load_actor_context(
        &self,
        user_id: Uuid,
        team_id: Uuid,
        display_role: Option<&str>,
    ) -> Result<ActorContext> {
        Ok(ActorContext {
            user_id,
            team_id,
            effective_display_role: display_role.unwrap_or("root").to_string(),
            is_root: true,
            permissions: ["user.manage.all".to_string()].into_iter().collect(),
        })
    }

    async fn update_password_hash(
        &self,
        user_id: Uuid,
        password_hash: &str,
        _actor_id: Uuid,
    ) -> Result<i64> {
        let mut user = self.user.write().await;
        assert_eq!(user.id, user_id);
        user.password_hash = password_hash.to_string();
        user.session_version += 1;
        self.updated_hashes.write().await.push(password_hash.to_string());
        Ok(user.session_version)
    }

    async fn bump_session_version(&self, user_id: Uuid, _actor_id: Uuid) -> Result<i64> {
        let mut user = self.user.write().await;
        assert_eq!(user.id, user_id);
        user.session_version += 1;
        self.bump_calls.fetch_add(1, Ordering::SeqCst);
        Ok(user.session_version)
    }

    async fn list_permissions(&self) -> Result<Vec<PermissionDefinition>> {
        Ok(Vec::new())
    }

    async fn append_audit_log(&self, _event: &AuditLogRecord) -> Result<()> {
        Ok(())
    }
}

#[derive(Default, Clone)]
struct MemorySessionStore {
    deleted: Arc<RwLock<Vec<String>>>,
}

impl MemorySessionStore {
    async fn deleted_sessions(&self) -> Vec<String> {
        self.deleted.read().await.clone()
    }
}

#[async_trait]
impl SessionStore for MemorySessionStore {
    async fn put(&self, _session: SessionRecord) -> Result<()> {
        Ok(())
    }

    async fn get(&self, _session_id: &str) -> Result<Option<SessionRecord>> {
        Ok(None)
    }

    async fn delete(&self, session_id: &str) -> Result<()> {
        self.deleted.write().await.push(session_id.to_string());
        Ok(())
    }

    async fn touch(&self, _session_id: &str, _expires_at_unix: i64) -> Result<()> {
        Ok(())
    }
}

#[tokio::test]
async fn change_password_rejects_wrong_old_password() {
    let repository = MemoryAuthRepository::new("change-me");
    let sessions = MemorySessionStore::default();
    let user_id = repository.user.read().await.id;
    let service = SessionSecurityService::new(repository.clone(), sessions.clone());

    let error = service
        .change_own_password(ChangeOwnPasswordCommand {
            actor_user_id: user_id,
            session_id: "session-1".into(),
            old_password: "wrong-password".into(),
            new_password_hash: hash_password("next-pass"),
        })
        .await
        .unwrap_err();

    assert!(error.to_string().contains("old_password"));
    assert_eq!(sessions.deleted_sessions().await, Vec::<String>::new());
    assert!(Argon2::default()
        .verify_password(
            "change-me".as_bytes(),
            &PasswordHash::new(&repository.current_hash().await).unwrap(),
        )
        .is_ok());
}

#[tokio::test]
async fn revoke_all_bumps_session_version_and_deletes_current_session() {
    let repository = MemoryAuthRepository::new("change-me");
    let sessions = MemorySessionStore::default();
    let user_id = repository.user.read().await.id;
    let service = SessionSecurityService::new(repository.clone(), sessions.clone());

    service
        .revoke_all_sessions(RevokeAllSessionsCommand {
            actor_user_id: user_id,
            session_id: "session-1".into(),
        })
        .await
        .unwrap();

    assert_eq!(repository.bump_count(), 1);
    assert_eq!(sessions.deleted_sessions().await, vec!["session-1".to_string()]);
}
```

Update `api/crates/control-plane/src/_tests/mod.rs`:

```rust
mod bootstrap_tests;
mod member_service_tests;
mod model_definition_service_tests;
mod role_service_tests;
mod session_security_service_tests;
mod support;
```

- [ ] **Step 2: Run the focused service tests and confirm failure**

Run: `cargo test -p control-plane change_password_rejects_wrong_old_password -- --exact`

Expected: FAIL because `control_plane::session_security` and its command types do not exist yet.

Run: `cargo test -p control-plane revoke_all_bumps_session_version_and_deletes_current_session -- --exact`

Expected: FAIL because `SessionSecurityService` is not exported.

- [ ] **Step 3: Implement the service and export it**

Create `api/crates/control-plane/src/session_security.rs`:

```rust
use anyhow::Result;
use argon2::{
    password_hash::PasswordHash,
    Argon2, PasswordVerifier,
};

use crate::{
    audit::audit_log,
    errors::ControlPlaneError,
    ports::{AuthRepository, SessionStore},
};

pub struct ChangeOwnPasswordCommand {
    pub actor_user_id: uuid::Uuid,
    pub session_id: String,
    pub old_password: String,
    pub new_password_hash: String,
}

pub struct RevokeAllSessionsCommand {
    pub actor_user_id: uuid::Uuid,
    pub session_id: String,
}

pub struct LogoutCurrentSessionCommand {
    pub session_id: String,
}

pub struct SessionSecurityService<R, S> {
    repository: R,
    sessions: S,
}

impl<R, S> SessionSecurityService<R, S>
where
    R: AuthRepository,
    S: SessionStore,
{
    pub fn new(repository: R, sessions: S) -> Self {
        Self {
            repository,
            sessions,
        }
    }

    pub async fn logout_current_session(
        &self,
        command: LogoutCurrentSessionCommand,
    ) -> Result<()> {
        self.sessions.delete(&command.session_id).await
    }

    pub async fn revoke_all_sessions(
        &self,
        command: RevokeAllSessionsCommand,
    ) -> Result<()> {
        self.repository
            .bump_session_version(command.actor_user_id, command.actor_user_id)
            .await?;
        self.sessions.delete(&command.session_id).await?;
        self.repository
            .append_audit_log(&audit_log(
                Some(command.actor_user_id),
                "session",
                None,
                "session.revoke_all",
                serde_json::json!({}),
            ))
            .await?;
        Ok(())
    }

    pub async fn change_own_password(
        &self,
        command: ChangeOwnPasswordCommand,
    ) -> Result<()> {
        let user = self
            .repository
            .find_user_by_id(command.actor_user_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("user"))?;
        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|_| ControlPlaneError::InvalidInput("old_password"))?;
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
        self.sessions.delete(&command.session_id).await?;
        self.repository
            .append_audit_log(&audit_log(
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
```

Update `api/crates/control-plane/src/lib.rs`:

```rust
extern crate self as control_plane;

pub mod audit;
pub mod auth;
pub mod bootstrap;
pub mod errors;
pub mod member;
pub mod model_definition;
pub mod ports;
pub mod profile;
pub mod role;
pub mod session_security;
pub mod team;

pub fn crate_name() -> &'static str {
    "control-plane"
}

#[cfg(test)]
pub mod _tests;
```

- [ ] **Step 4: Run the service tests and confirm they pass**

Run: `cargo test -p control-plane change_password_rejects_wrong_old_password -- --exact`

Expected: PASS

Run: `cargo test -p control-plane revoke_all_bumps_session_version_and_deletes_current_session -- --exact`

Expected: PASS

- [ ] **Step 5: Commit the service slice**

```bash
git add api/crates/control-plane/src/session_security.rs api/crates/control-plane/src/lib.rs api/crates/control-plane/src/_tests/mod.rs api/crates/control-plane/src/_tests/session_security_service_tests.rs
git commit -m "feat: add module 01 session security service"
```

### Task 2: Rewire Module 01 Console Routes And OpenAPI

**Files:**
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/routes/me.rs`
- Modify: `api/apps/api-server/src/routes/members.rs`
- Modify: `api/apps/api-server/src/routes/session.rs`
- Create: `api/apps/api-server/src/_tests/me_routes.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`
- Modify: `api/apps/api-server/src/_tests/member_routes.rs`
- Modify: `api/apps/api-server/src/_tests/session_routes.rs`
- Modify: `api/apps/api-server/tests/health_routes.rs`

- [ ] **Step 1: Write the failing route and OpenAPI regressions**

Create `api/apps/api-server/src/_tests/me_routes.rs`:

```rust
use crate::_tests::support::{login_and_capture_cookie, test_app};
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn change_password_route_rotates_credentials_and_invalidates_old_session() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/me/actions/change-password")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "old_password": "change-me",
                        "new_password": "next-pass"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let old_session_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/session")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(old_session_response.status(), StatusCode::UNAUTHORIZED);

    let relogin = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/public/auth/providers/password-local/sign-in")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "identifier": "root",
                        "password": "next-pass"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(relogin.status(), StatusCode::OK);
}
```

Update `api/apps/api-server/src/_tests/mod.rs`:

```rust
mod auth_routes;
mod config_tests;
mod me_routes;
mod member_routes;
mod model_definition_routes;
mod role_routes;
mod runtime_model_routes;
mod session_routes;
mod support;
mod team_routes;
```

Replace `api/apps/api-server/src/_tests/session_routes.rs` with:

```rust
use crate::_tests::support::{login_and_capture_cookie, test_app};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn session_route_returns_wrapped_actor_payload() {
    let app = test_app().await;
    let (cookie, _) = login_and_capture_cookie(&app, "root", "change-me").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/session")
                .header("cookie", cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(payload.get("data").is_some());
    assert!(payload.get("meta").is_some());
    assert_eq!(payload["data"]["actor"]["account"], "root");
}

#[tokio::test]
async fn delete_session_route_clears_current_session() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/console/session")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let after_logout = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/session")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(after_logout.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn revoke_all_route_invalidates_current_session() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/session/actions/revoke-all")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let stale_request = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/session")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(stale_request.status(), StatusCode::UNAUTHORIZED);
}
```

Replace `api/apps/api-server/src/_tests/member_routes.rs` with:

```rust
use crate::_tests::support::{login_and_capture_cookie, test_app};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn member_routes_use_action_paths_and_reset_member_session() {
    let app = test_app().await;
    let (root_cookie, root_csrf) = login_and_capture_cookie(&app, "root", "change-me").await;

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/members")
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "account": "manager-1",
                        "email": "manager-1@example.com",
                        "phone": "13800000000",
                        "password": "temp-pass",
                        "name": "Manager 1",
                        "nickname": "Manager 1",
                        "introduction": "",
                        "email_login_enabled": true,
                        "phone_login_enabled": false
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::CREATED);
    let create_body = to_bytes(create_response.into_body(), usize::MAX).await.unwrap();
    let created_member: serde_json::Value = serde_json::from_slice(&create_body).unwrap();
    let member_id = created_member["data"]["id"].as_str().unwrap();

    let (member_cookie, _) = login_and_capture_cookie(&app, "manager-1", "temp-pass").await;

    let old_route = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/members/{member_id}/reset-password"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "new_password": "should-not-work" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(old_route.status(), StatusCode::NOT_FOUND);

    let reset_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/members/{member_id}/actions/reset-password"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .header("content-type", "application/json")
                .body(Body::from(json!({ "new_password": "next-pass" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(reset_response.status(), StatusCode::NO_CONTENT);

    let stale_member_session = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/console/session")
                .header("cookie", &member_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(stale_member_session.status(), StatusCode::UNAUTHORIZED);

    let disable_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/console/members/{member_id}/actions/disable"))
                .header("cookie", &root_cookie)
                .header("x-csrf-token", &root_csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(disable_response.status(), StatusCode::NO_CONTENT);
}
```

Update `api/apps/api-server/tests/health_routes.rs`:

```rust
use api_server::app;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn health_route_returns_ok_payload() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(payload["service"], "api-server");
    assert_eq!(payload["status"], "ok");
}

#[tokio::test]
async fn openapi_route_exposes_api_title() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(payload["info"]["title"], "1Flowse API");
}

#[tokio::test]
async fn openapi_uses_action_paths_for_module_01_mutations() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: Value = serde_json::from_slice(&body).unwrap();
    let paths = payload["paths"].as_object().unwrap();

    assert!(paths.contains_key("/api/console/session"));
    assert!(paths.contains_key("/api/console/session/actions/revoke-all"));
    assert!(paths.contains_key("/api/console/me/actions/change-password"));
    assert!(paths.contains_key("/api/console/members/{id}/actions/disable"));
    assert!(paths.contains_key("/api/console/members/{id}/actions/reset-password"));
    assert!(!paths.contains_key("/api/console/members/{id}/disable"));
    assert!(!paths.contains_key("/api/console/members/{id}/reset-password"));
}
```

- [ ] **Step 2: Run the focused route tests and confirm failure**

Run: `cargo test -p api-server delete_session_route_clears_current_session -- --exact`

Expected: FAIL because `DELETE /api/console/session` is not registered.

Run: `cargo test -p api-server change_password_route_rotates_credentials_and_invalidates_old_session -- --exact`

Expected: FAIL because `/api/console/me/actions/change-password` does not exist.

Run: `cargo test -p api-server member_routes_use_action_paths_and_reset_member_session -- --exact`

Expected: FAIL because the route still lives at `/members/:id/reset-password` and the request body still expects `password`.

Run: `cargo test -p api-server openapi_uses_action_paths_for_module_01_mutations -- --exact`

Expected: FAIL because `ApiDoc` still exposes the old module 01 mutation paths.

- [ ] **Step 3: Implement the route contract, cookie clearing, and OpenAPI registration**

Update `api/apps/api-server/src/routes/session.rs`:

```rust
use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use axum_extra::extract::cookie::{time::Duration, Cookie, CookieJar, SameSite};
use serde::Serialize;
use utoipa::ToSchema;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{require_csrf::require_csrf, require_session::require_session},
    response::ApiSuccess,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionResponse {
    pub actor: serde_json::Value,
}

fn expired_session_cookie(cookie_name: &str) -> Cookie<'static> {
    Cookie::build((cookie_name.to_string(), String::new()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(Duration::seconds(0))
        .build()
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/session", get(get_session).delete(delete_session))
        .route("/session/actions/revoke-all", post(revoke_all_sessions))
}

#[utoipa::path(
    get,
    path = "/api/console/session",
    responses((status = 200, body = SessionResponse), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn get_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<SessionResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;

    Ok(Json(ApiSuccess::new(SessionResponse {
        actor: serde_json::json!({
            "id": context.user.id,
            "account": context.user.account,
            "effective_display_role": context.actor.effective_display_role,
        }),
    })))
}

#[utoipa::path(
    delete,
    path = "/api/console/session",
    responses((status = 204), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn delete_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<(CookieJar, StatusCode), ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    control_plane::session_security::SessionSecurityService::new(
        state.store.clone(),
        state.session_store.clone(),
    )
    .logout_current_session(control_plane::session_security::LogoutCurrentSessionCommand {
        session_id: context.session.session_id,
    })
    .await?;

    Ok((
        CookieJar::new().remove(expired_session_cookie(&state.cookie_name)),
        StatusCode::NO_CONTENT,
    ))
}

#[utoipa::path(
    post,
    path = "/api/console/session/actions/revoke-all",
    responses((status = 204), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn revoke_all_sessions(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<StatusCode, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    control_plane::session_security::SessionSecurityService::new(
        state.store.clone(),
        state.session_store.clone(),
    )
    .revoke_all_sessions(control_plane::session_security::RevokeAllSessionsCommand {
        actor_user_id: context.user.id,
        session_id: context.session.session_id,
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
```

Update `api/apps/api-server/src/routes/me.rs`:

```rust
use std::sync::Arc;

use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use control_plane::{profile::ProfileService, session_security::ChangeOwnPasswordCommand};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::{require_csrf::require_csrf, require_session::require_session},
    response::ApiSuccess,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct MeResponse {
    pub id: String,
    pub account: String,
    pub email: String,
    pub nickname: String,
    pub name: String,
    pub effective_display_role: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ChangePasswordBody {
    pub old_password: String,
    pub new_password: String,
}

fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|err| anyhow::anyhow!("failed to hash password: {err}"))?
        .to_string())
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/me", get(get_me))
        .route("/me/actions/change-password", post(change_password))
}

#[utoipa::path(
    get,
    path = "/api/console/me",
    responses((status = 200, body = MeResponse), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn get_me(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<ApiSuccess<MeResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    let profile = ProfileService::new(state.store.clone())
        .get_me(context.user.id, context.session.team_id)
        .await?;
    let mut permissions = profile.actor.permissions.into_iter().collect::<Vec<_>>();
    permissions.sort();

    Ok(Json(ApiSuccess::new(MeResponse {
        id: profile.user.id.to_string(),
        account: profile.user.account,
        email: profile.user.email,
        nickname: profile.user.nickname,
        name: profile.user.name,
        effective_display_role: profile.actor.effective_display_role,
        permissions,
    })))
}

#[utoipa::path(
    post,
    path = "/api/console/me/actions/change-password",
    request_body = ChangePasswordBody,
    responses((status = 204), (status = 400, body = crate::error_response::ErrorBody), (status = 401, body = crate::error_response::ErrorBody))
)]
pub async fn change_password(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<ChangePasswordBody>,
) -> Result<StatusCode, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    control_plane::session_security::SessionSecurityService::new(
        state.store.clone(),
        state.session_store.clone(),
    )
    .change_own_password(ChangeOwnPasswordCommand {
        actor_user_id: context.user.id,
        session_id: context.session.session_id,
        old_password: body.old_password,
        new_password_hash: hash_password(&body.new_password)?,
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
```

Update `api/apps/api-server/src/routes/members.rs` so only the route contract changes:

```rust
pub struct ResetMemberPasswordBody {
    pub new_password: String,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/members", get(list_members).post(create_member))
        .route("/members/:id/actions/disable", post(disable_member))
        .route("/members/:id/actions/reset-password", post(reset_member))
        .route("/members/:id/roles", put(replace_member_roles))
}

#[utoipa::path(
    post,
    path = "/api/console/members/{id}/actions/disable",
    params(("id" = String, Path, description = "Member user id")),
    responses((status = 204), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn disable_member(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(member_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    MemberService::new(state.store.clone())
        .disable_member(DisableMemberCommand {
            actor_user_id: context.user.id,
            target_user_id: parse_member_id(&member_id)?,
        })
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/console/members/{id}/actions/reset-password",
    request_body = ResetMemberPasswordBody,
    params(("id" = String, Path, description = "Member user id")),
    responses((status = 204), (status = 403, body = crate::error_response::ErrorBody))
)]
pub async fn reset_member(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(member_id): Path<String>,
    Json(body): Json<ResetMemberPasswordBody>,
) -> Result<StatusCode, ApiError> {
    let context = require_session(&state, &headers).await?;
    require_csrf(&headers, &context.session)?;

    MemberService::new(state.store.clone())
        .reset_member_password(ResetMemberPasswordCommand {
            actor_user_id: context.user.id,
            target_user_id: parse_member_id(&member_id)?,
            password_hash: hash_password(&body.new_password)?,
        })
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
```

Update `api/apps/api-server/src/lib.rs` so the OpenAPI list matches the new handlers:

```rust
#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        console_health,
        routes::auth::list_providers,
        routes::auth::sign_in,
        routes::me::get_me,
        routes::me::change_password,
        routes::session::get_session,
        routes::session::delete_session,
        routes::session::revoke_all_sessions,
        routes::team::get_team,
        routes::team::patch_team,
        routes::members::list_members,
        routes::members::create_member,
        routes::members::disable_member,
        routes::members::reset_member,
        routes::members::replace_member_roles,
        routes::model_definitions::create_model,
        routes::model_definitions::list_models,
        routes::roles::list_roles,
        routes::roles::create_role,
        routes::roles::update_role,
        routes::roles::delete_role,
        routes::roles::get_role_permissions,
        routes::roles::replace_role_permissions,
        routes::permissions::list_permissions,
    ),
    components(schemas(
        HealthResponse,
        routes::auth::LoginBody,
        routes::auth::AuthProviderResponse,
        routes::auth::LoginResponse,
        routes::me::ChangePasswordBody,
        routes::me::MeResponse,
        routes::members::CreateMemberBody,
        routes::members::MemberResponse,
        routes::members::ReplaceMemberRolesBody,
        routes::members::ResetMemberPasswordBody,
        routes::model_definitions::CreateModelDefinitionBody,
        routes::model_definitions::ModelDefinitionResponse,
        routes::permissions::PermissionResponse,
        routes::roles::CreateRoleBody,
        routes::roles::ReplaceRolePermissionsBody,
        routes::roles::RolePermissionsResponse,
        routes::roles::RoleResponse,
        routes::roles::UpdateRoleBody,
        routes::session::SessionResponse,
        routes::team::PatchTeamBody,
        routes::team::TeamResponse,
        error_response::ErrorBody,
    )),
    info(title = "1Flowse API", version = "0.1.0")
)]
pub struct ApiDoc;
```

- [ ] **Step 4: Run the route and OpenAPI regressions**

Run: `cargo test -p api-server delete_session_route_clears_current_session -- --exact`

Expected: PASS

Run: `cargo test -p api-server revoke_all_route_invalidates_current_session -- --exact`

Expected: PASS

Run: `cargo test -p api-server change_password_route_rotates_credentials_and_invalidates_old_session -- --exact`

Expected: PASS

Run: `cargo test -p api-server member_routes_use_action_paths_and_reset_member_session -- --exact`

Expected: PASS

Run: `cargo test -p api-server openapi_uses_action_paths_for_module_01_mutations -- --exact`

Expected: PASS

- [ ] **Step 5: Commit the module 01 route slice**

```bash
git add api/apps/api-server/src/lib.rs api/apps/api-server/src/routes/session.rs api/apps/api-server/src/routes/me.rs api/apps/api-server/src/routes/members.rs api/apps/api-server/src/_tests/mod.rs api/apps/api-server/src/_tests/session_routes.rs api/apps/api-server/src/_tests/me_routes.rs api/apps/api-server/src/_tests/member_routes.rs api/apps/api-server/tests/health_routes.rs
git commit -m "feat: close module 01 session and route contracts"
```

### Task 3: Run The Module 01 Verification Sweep

**Files:**
- Test: `api/crates/control-plane/src/_tests/session_security_service_tests.rs`
- Test: `api/apps/api-server/src/_tests/session_routes.rs`
- Test: `api/apps/api-server/src/_tests/me_routes.rs`
- Test: `api/apps/api-server/src/_tests/member_routes.rs`
- Test: `api/apps/api-server/tests/health_routes.rs`

- [ ] **Step 1: Run the control-plane module 01 tests as a group**

Run: `cargo test -p control-plane session_security -- --nocapture`

Expected: PASS with the new session security tests included.

- [ ] **Step 2: Run the api-server module 01 route tests as a group**

Run: `cargo test -p api-server session_route_returns_wrapped_actor_payload -- --exact --nocapture`

Expected: PASS

Run: `cargo test -p api-server delete_session_route_clears_current_session -- --exact --nocapture`

Expected: PASS

Run: `cargo test -p api-server revoke_all_route_invalidates_current_session -- --exact --nocapture`

Expected: PASS

Run: `cargo test -p api-server change_password_route_rotates_credentials_and_invalidates_old_session -- --exact --nocapture`

Expected: PASS

Run: `cargo test -p api-server member_routes_use_action_paths_and_reset_member_session -- --exact --nocapture`

Expected: PASS for all module 01 route regressions.

- [ ] **Step 3: Run the OpenAPI assertion**

Run: `cargo test -p api-server openapi_uses_action_paths_for_module_01_mutations -- --exact`

Expected: PASS and confirm the old member mutation paths are gone from `/openapi.json`.

- [ ] **Step 4: Run the unified backend verification**

Run: `node scripts/node/verify-backend.js`

Expected: PASS with the normal backend verification summary.

- [ ] **Step 5: Commit the verified module 01 batch**

```bash
git add .
git commit -m "test: verify module 01 qa remediation"
```

Plan complete and saved to `docs/superpowers/plans/2026-04-13-module-01-user-auth-and-team-qa-remediation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Use `superpowers:subagent-driven-development` to execute one task at a time with review checkpoints.
2. **Inline Execution** - Use `superpowers:executing-plans` to execute this plan in the current session with batch checkpoints.
