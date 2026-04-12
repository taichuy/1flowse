# Backend Kernel And Quality Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the current Rust backend with the new backend interface kernel and backend engineering quality specs by normalizing public auth/session APIs, introducing resource-kernel and dynamic-model foundations, formalizing runtime/plugin capability boundaries, and splitting oversized storage logic into repository/mapper modules.

**Architecture:** Keep the existing `api-server + control-plane + storage-*` foundation, but move the codebase toward `router() + nest()` registration, wrapped API responses, explicit repository/mapper boundaries, and dedicated `runtime-core` / `plugin-framework` foundation modules. This plan intentionally starts from the already-implemented auth/team/access-control slice instead of rebuilding the backend from scratch.

**Tech Stack:** Rust stable, Axum, Tokio, SQLx, Redis, utoipa, tracing, Node.js scripts

**Source Specs:** `docs/superpowers/specs/1flowse/2026-04-12-backend-interface-kernel-design.md`, `docs/superpowers/specs/1flowse/2026-04-12-backend-engineering-quality-design.md`

**Approval:** User approved continuing from the specs into an implementation plan on `2026-04-12 23`.

---

## Scope Split

The two backend specs cover several subsystems. This plan keeps them in one execution stream only because they form one backend foundation slice:

1. Public auth/session and response normalization
2. Repository and mapper boundary cleanup
3. Plugin taxonomy and assignment/binding semantics
4. Resource kernel + dynamic modeling foundation
5. Runtime capability slots and backend verification tooling

This plan does **not** yet implement business-specific runtime records, external publish protocols, or full plugin installation APIs. Those should follow only after this foundation is stable.

## File Structure

**Create**
- `api/apps/api-server/src/response.rs`
- `api/apps/api-server/src/routes/session.rs`
- `api/apps/api-server/src/routes/model_definitions.rs`
- `api/apps/api-server/src/routes/runtime_models.rs`
- `api/apps/api-server/src/_tests/session_routes.rs`
- `api/apps/api-server/src/_tests/model_definition_routes.rs`
- `api/apps/api-server/src/_tests/runtime_model_routes.rs`
- `api/crates/domain/src/resource.rs`
- `api/crates/domain/src/modeling.rs`
- `api/crates/domain/src/_tests/resource_tests.rs`
- `api/crates/runtime-core/src/resource_descriptor.rs`
- `api/crates/runtime-core/src/resource_registry.rs`
- `api/crates/runtime-core/src/model_metadata.rs`
- `api/crates/runtime-core/src/runtime_engine.rs`
- `api/crates/runtime-core/src/capability_slots.rs`
- `api/crates/runtime-core/src/_tests/mod.rs`
- `api/crates/runtime-core/src/_tests/resource_registry_tests.rs`
- `api/crates/runtime-core/src/_tests/runtime_engine_tests.rs`
- `api/crates/plugin-framework/src/capability_kind.rs`
- `api/crates/plugin-framework/src/assignment.rs`
- `api/crates/plugin-framework/src/_tests/mod.rs`
- `api/crates/plugin-framework/src/_tests/assignment_tests.rs`
- `api/crates/storage-pg/src/auth_repository.rs`
- `api/crates/storage-pg/src/member_repository.rs`
- `api/crates/storage-pg/src/role_repository.rs`
- `api/crates/storage-pg/src/team_repository.rs`
- `api/crates/storage-pg/src/model_definition_repository.rs`
- `api/crates/storage-pg/src/mappers/mod.rs`
- `api/crates/storage-pg/src/mappers/auth_mapper.rs`
- `api/crates/storage-pg/src/mappers/member_mapper.rs`
- `api/crates/storage-pg/src/mappers/role_mapper.rs`
- `api/crates/storage-pg/src/mappers/team_mapper.rs`
- `api/crates/storage-pg/src/mappers/model_definition_mapper.rs`
- `api/crates/storage-pg/src/_tests/member_mapper_tests.rs`
- `api/crates/storage-pg/src/_tests/model_definition_repository_tests.rs`
- `api/crates/control-plane/src/model_definition.rs`
- `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`
- `api/crates/storage-pg/migrations/20260412230000_create_model_definition_tables.sql`
- `scripts/node/verify-backend.js`
- `api/README.md`

**Modify**
- `api/Cargo.toml`
- `api/apps/api-server/src/lib.rs`
- `api/apps/api-server/src/routes/mod.rs`
- `api/apps/api-server/src/routes/auth.rs`
- `api/apps/api-server/src/routes/me.rs`
- `api/apps/api-server/src/routes/team.rs`
- `api/apps/api-server/src/routes/members.rs`
- `api/apps/api-server/src/routes/roles.rs`
- `api/apps/api-server/src/routes/permissions.rs`
- `api/apps/api-server/src/_tests/mod.rs`
- `api/apps/api-server/src/_tests/auth_routes.rs`
- `api/apps/api-server/src/_tests/member_routes.rs`
- `api/apps/api-server/src/_tests/support.rs`
- `api/crates/domain/src/lib.rs`
- `api/crates/runtime-core/Cargo.toml`
- `api/crates/runtime-core/src/lib.rs`
- `api/crates/plugin-framework/Cargo.toml`
- `api/crates/plugin-framework/src/lib.rs`
- `api/crates/control-plane/Cargo.toml`
- `api/crates/control-plane/src/lib.rs`
- `api/crates/storage-pg/Cargo.toml`
- `api/crates/storage-pg/src/lib.rs`
- `api/crates/storage-pg/src/repositories.rs`

**Notes**
- `api/crates/storage-pg/src/repositories.rs` is already `1266` lines, so the split is not optional if we want to stay ahead of the file-size rule and keep repository/mapper boundaries explicit.
- Existing auth/team/access-control behavior should remain green while paths and wrappers move.
- New tests must continue living under `_tests` directories to align with the repository rule.

### Task 1: Normalize Public Auth, Session, ApiSuccess, And Router Registration

**Files:**
- Create: `api/apps/api-server/src/response.rs`
- Create: `api/apps/api-server/src/routes/session.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/routes/mod.rs`
- Modify: `api/apps/api-server/src/routes/auth.rs`
- Modify: `api/apps/api-server/src/routes/me.rs`
- Modify: `api/apps/api-server/src/routes/team.rs`
- Modify: `api/apps/api-server/src/routes/members.rs`
- Modify: `api/apps/api-server/src/routes/roles.rs`
- Modify: `api/apps/api-server/src/routes/permissions.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`
- Modify: `api/apps/api-server/src/_tests/auth_routes.rs`
- Modify: `api/apps/api-server/src/_tests/member_routes.rs`
- Create: `api/apps/api-server/src/_tests/session_routes.rs`
- Modify: `api/apps/api-server/src/_tests/support.rs`

- [ ] **Step 1: Write the failing route tests**

Create `api/apps/api-server/src/_tests/session_routes.rs`:

```rust
use crate::_tests::support::{login_and_capture_cookie, test_app};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
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
```

Update `api/apps/api-server/src/_tests/auth_routes.rs` to use the hosted-provider path and wrapped payload:

```rust
#[tokio::test]
async fn public_auth_sign_in_sets_cookie_and_returns_wrapped_payload() {
    let app = test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/public/auth/providers/password-local/sign-in")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "identifier": "root@example.com",
                        "password": "change-me"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers().get("set-cookie").is_some());

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload["data"]["csrf_token"].is_string());
    assert!(payload["meta"].is_null());
}
```

Update `api/apps/api-server/src/_tests/member_routes.rs` to assert wrapped list/create responses:

```rust
assert_eq!(create_response.status(), StatusCode::CREATED);
let body = to_bytes(create_response.into_body(), usize::MAX).await.unwrap();
let created_member: serde_json::Value = serde_json::from_slice(&body).unwrap();
let member_id = created_member["data"]["id"].as_str().unwrap();

assert_eq!(list_response.status(), StatusCode::OK);
let list_body = to_bytes(list_response.into_body(), usize::MAX).await.unwrap();
let list_payload: serde_json::Value = serde_json::from_slice(&list_body).unwrap();
assert!(list_payload["data"].is_array());
assert!(list_payload["meta"].is_null());
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `cargo test -p api-server public_auth_sign_in_sets_cookie_and_returns_wrapped_payload -- --exact`

Expected: FAIL because the current login route is still `/api/console/auth/login` and does not wrap responses.

Run: `cargo test -p api-server session_route_returns_wrapped_actor_payload -- --exact`

Expected: FAIL because `/api/console/session` does not exist.

- [ ] **Step 3: Implement wrapped responses, public auth/session endpoints, and router() modules**

Create `api/apps/api-server/src/response.rs`:

```rust
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiSuccess<T> {
    pub data: T,
    pub meta: Option<serde_json::Value>,
}

impl<T> ApiSuccess<T> {
    pub fn new(data: T) -> Self {
        Self { data, meta: None }
    }
}
```

Create `api/apps/api-server/src/routes/session.rs`:

```rust
use std::sync::Arc;

use axum::{extract::State, http::HeaderMap, Json, Router, routing::get};
use serde::Serialize;
use utoipa::ToSchema;

use crate::{
    app_state::ApiState,
    error_response::ApiError,
    middleware::require_session::require_session,
    response::ApiSuccess,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionResponse {
    pub actor: serde_json::Value,
}

pub fn router() -> Router<Arc<ApiState>> {
    Router::new().route("/session", get(get_session))
}

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
```

Update `api/apps/api-server/src/routes/auth.rs` so it exports `router()` and uses the hosted-provider path:

```rust
pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/providers", get(list_providers))
        .route("/providers/password-local/sign-in", post(sign_in))
}
```

Update `api/apps/api-server/src/lib.rs` to register routers with `nest()` instead of hand-writing long route chains:

```rust
let console_router = Router::new()
    .nest("/api/console", routes::me::router())
    .nest("/api/console", routes::team::router())
    .nest("/api/console", routes::members::router())
    .nest("/api/console", routes::roles::router())
    .nest("/api/console", routes::permissions::router())
    .nest("/api/console", routes::session::router())
    .nest("/api/public/auth", routes::auth::router())
    .with_state(state);
```

Wrap all non-`204` route responses with `Json(ApiSuccess::new(...))`.

- [ ] **Step 4: Run the route test slice**

Run: `cargo test -p api-server --lib -- --nocapture`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/apps/api-server/src/lib.rs \
  api/apps/api-server/src/response.rs \
  api/apps/api-server/src/routes \
  api/apps/api-server/src/_tests
git commit -m "refactor: normalize auth routes and api success wrapper"
```

### Task 2: Split Storage-Pg Into Repository Modules And Mappers

**Files:**
- Create: `api/crates/storage-pg/src/auth_repository.rs`
- Create: `api/crates/storage-pg/src/member_repository.rs`
- Create: `api/crates/storage-pg/src/role_repository.rs`
- Create: `api/crates/storage-pg/src/team_repository.rs`
- Create: `api/crates/storage-pg/src/model_definition_repository.rs`
- Create: `api/crates/storage-pg/src/mappers/mod.rs`
- Create: `api/crates/storage-pg/src/mappers/auth_mapper.rs`
- Create: `api/crates/storage-pg/src/mappers/member_mapper.rs`
- Create: `api/crates/storage-pg/src/mappers/role_mapper.rs`
- Create: `api/crates/storage-pg/src/mappers/team_mapper.rs`
- Create: `api/crates/storage-pg/src/mappers/model_definition_mapper.rs`
- Create: `api/crates/storage-pg/src/_tests/member_mapper_tests.rs`
- Modify: `api/crates/storage-pg/src/lib.rs`
- Modify: `api/crates/storage-pg/src/repositories.rs`

- [ ] **Step 1: Write the failing mapper test**

Create `api/crates/storage-pg/src/_tests/member_mapper_tests.rs`:

```rust
use domain::{RoleScopeKind, UserStatus};
use storage_pg::mappers::member_mapper::{PgMemberMapper, StoredMemberRow};
use uuid::Uuid;

#[test]
fn member_mapper_preserves_roles_and_status() {
    let row = StoredMemberRow {
        id: Uuid::now_v7(),
        account: "manager-1".into(),
        email: "manager-1@example.com".into(),
        phone: None,
        password_hash: "hash".into(),
        name: "Manager".into(),
        nickname: "Manager".into(),
        introduction: String::new(),
        default_display_role: Some("manager".into()),
        email_login_enabled: true,
        phone_login_enabled: false,
        status: "active".into(),
        roles: vec![("manager".into(), RoleScopeKind::Team, Some(Uuid::nil()))],
    };

    let user = PgMemberMapper::to_user_record(row);

    assert!(matches!(user.status, UserStatus::Active));
    assert_eq!(user.roles.len(), 1);
    assert_eq!(user.roles[0].code, "manager");
}
```

- [ ] **Step 2: Run the focused mapper test and confirm failure**

Run: `cargo test -p storage-pg member_mapper_preserves_roles_and_status -- --exact`

Expected: FAIL because `mappers::member_mapper` and `StoredMemberRow` do not exist.

- [ ] **Step 3: Split the storage layer into repository + mapper modules**

Create `api/crates/storage-pg/src/mappers/member_mapper.rs`:

```rust
use domain::{BoundRole, RoleScopeKind, UserRecord, UserStatus};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct StoredMemberRow {
    pub id: Uuid,
    pub account: String,
    pub email: String,
    pub phone: Option<String>,
    pub password_hash: String,
    pub name: String,
    pub nickname: String,
    pub introduction: String,
    pub default_display_role: Option<String>,
    pub email_login_enabled: bool,
    pub phone_login_enabled: bool,
    pub status: String,
    pub roles: Vec<(String, RoleScopeKind, Option<Uuid>)>,
}

pub struct PgMemberMapper;

impl PgMemberMapper {
    pub fn to_user_record(row: StoredMemberRow) -> UserRecord {
        UserRecord {
            id: row.id,
            account: row.account,
            email: row.email,
            phone: row.phone,
            password_hash: row.password_hash,
            name: row.name,
            nickname: row.nickname,
            avatar_url: None,
            introduction: row.introduction,
            default_display_role: row.default_display_role,
            email_login_enabled: row.email_login_enabled,
            phone_login_enabled: row.phone_login_enabled,
            status: if row.status == "active" {
                UserStatus::Active
            } else {
                UserStatus::Disabled
            },
            session_version: 1,
            roles: row
                .roles
                .into_iter()
                .map(|(code, scope_kind, team_id)| BoundRole {
                    code,
                    scope_kind,
                    team_id,
                })
                .collect(),
        }
    }
}
```

Update `api/crates/storage-pg/src/lib.rs`:

```rust
pub mod auth_repository;
pub mod member_repository;
pub mod role_repository;
pub mod team_repository;
pub mod model_definition_repository;
pub mod mappers;
pub mod repositories;
```

Trim `api/crates/storage-pg/src/repositories.rs` into a facade that re-exports the split modules instead of remaining the single implementation dump:

```rust
pub use crate::{
    auth_repository::*,
    member_repository::*,
    model_definition_repository::*,
    role_repository::*,
    team_repository::*,
};
```

Move existing SQL and helper functions into the new repository files, and route all domain conversions through the new `Pg*Mapper` modules.

- [ ] **Step 4: Run mapper and storage tests**

Run: `cargo test -p storage-pg member_mapper_preserves_roles_and_status -- --exact`

Run: `cargo test -p storage-pg`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/crates/storage-pg/src/lib.rs \
  api/crates/storage-pg/src/repositories.rs \
  api/crates/storage-pg/src/*repository.rs \
  api/crates/storage-pg/src/mappers \
  api/crates/storage-pg/src/_tests/member_mapper_tests.rs
git commit -m "refactor: split storage pg repositories and mappers"
```

### Task 3: Formalize Runtime Extension And Capability Plugin Taxonomy

**Files:**
- Create: `api/crates/plugin-framework/src/capability_kind.rs`
- Create: `api/crates/plugin-framework/src/assignment.rs`
- Create: `api/crates/plugin-framework/src/_tests/mod.rs`
- Create: `api/crates/plugin-framework/src/_tests/assignment_tests.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`
- Modify: `api/crates/plugin-framework/Cargo.toml`

- [ ] **Step 1: Write the failing plugin assignment tests**

Create `api/crates/plugin-framework/src/_tests/assignment_tests.rs`:

```rust
use plugin_framework::{
    assignment::{BindingTarget, PluginAssignment},
    capability_kind::PluginConsumptionKind,
};
use uuid::Uuid;

#[test]
fn runtime_extension_requires_binding_target() {
    let assignment = PluginAssignment::new(
        Uuid::now_v7(),
        PluginConsumptionKind::RuntimeExtension,
        None,
    );

    assert!(assignment.is_err());
}

#[test]
fn capability_plugin_can_be_assigned_to_single_app_then_selected_in_config() {
    let assignment = PluginAssignment::new(
        Uuid::now_v7(),
        PluginConsumptionKind::CapabilityPlugin,
        Some(BindingTarget::App(Uuid::nil())),
    )
    .unwrap();

    assert!(assignment.requires_explicit_selection);
}
```

- [ ] **Step 2: Run the focused plugin tests and confirm failure**

Run: `cargo test -p plugin-framework runtime_extension_requires_binding_target -- --exact`

Expected: FAIL because `capability_kind` and `assignment` modules do not exist.

- [ ] **Step 3: Implement the plugin consumption taxonomy**

Create `api/crates/plugin-framework/src/capability_kind.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PluginConsumptionKind {
    HostExtension,
    RuntimeExtension,
    CapabilityPlugin,
}
```

Create `api/crates/plugin-framework/src/assignment.rs`:

```rust
use anyhow::{anyhow, Result};
use uuid::Uuid;

use crate::capability_kind::PluginConsumptionKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BindingTarget {
    Team(Uuid),
    App(Uuid),
    Model(Uuid),
}

#[derive(Debug, Clone)]
pub struct PluginAssignment {
    pub plugin_id: Uuid,
    pub kind: PluginConsumptionKind,
    pub binding_target: Option<BindingTarget>,
    pub requires_explicit_selection: bool,
}

impl PluginAssignment {
    pub fn new(
        plugin_id: Uuid,
        kind: PluginConsumptionKind,
        binding_target: Option<BindingTarget>,
    ) -> Result<Self> {
        if matches!(kind, PluginConsumptionKind::RuntimeExtension) && binding_target.is_none() {
            return Err(anyhow!("runtime extension requires model or app binding"));
        }

        Ok(Self {
            plugin_id,
            kind,
            binding_target,
            requires_explicit_selection: matches!(kind, PluginConsumptionKind::CapabilityPlugin),
        })
    }
}
```

Update `api/crates/plugin-framework/src/lib.rs`:

```rust
pub mod assignment;
pub mod capability_kind;

pub use assignment::*;
pub use capability_kind::*;

#[cfg(test)]
pub mod _tests;
```

- [ ] **Step 4: Run the plugin-framework test slice**

Run: `cargo test -p plugin-framework -- --nocapture`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/crates/plugin-framework/Cargo.toml \
  api/crates/plugin-framework/src/lib.rs \
  api/crates/plugin-framework/src/capability_kind.rs \
  api/crates/plugin-framework/src/assignment.rs \
  api/crates/plugin-framework/src/_tests
git commit -m "feat: add runtime extension and capability plugin taxonomy"
```

### Task 4: Add Resource Kernel And Dynamic Modeling Foundation

**Files:**
- Create: `api/crates/domain/src/resource.rs`
- Create: `api/crates/domain/src/modeling.rs`
- Create: `api/crates/domain/src/_tests/resource_tests.rs`
- Create: `api/crates/runtime-core/src/resource_descriptor.rs`
- Create: `api/crates/runtime-core/src/resource_registry.rs`
- Create: `api/crates/runtime-core/src/model_metadata.rs`
- Create: `api/crates/runtime-core/src/_tests/mod.rs`
- Create: `api/crates/runtime-core/src/_tests/resource_registry_tests.rs`
- Create: `api/crates/control-plane/src/model_definition.rs`
- Create: `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`
- Create: `api/crates/storage-pg/src/model_definition_repository.rs`
- Create: `api/crates/storage-pg/src/mappers/model_definition_mapper.rs`
- Create: `api/crates/storage-pg/src/_tests/model_definition_repository_tests.rs`
- Create: `api/crates/storage-pg/migrations/20260412230000_create_model_definition_tables.sql`
- Create: `api/apps/api-server/src/routes/model_definitions.rs`
- Create: `api/apps/api-server/src/_tests/model_definition_routes.rs`
- Modify: `api/crates/domain/src/lib.rs`
- Modify: `api/crates/runtime-core/Cargo.toml`
- Modify: `api/crates/runtime-core/src/lib.rs`
- Modify: `api/crates/control-plane/Cargo.toml`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/apps/api-server/src/routes/mod.rs`
- Modify: `api/apps/api-server/src/lib.rs`

- [ ] **Step 1: Write the failing resource-kernel tests**

Create `api/crates/runtime-core/src/_tests/resource_registry_tests.rs`:

```rust
use runtime_core::{
    resource_descriptor::{Exposure, Plane, ResourceDescriptor, ResourceKind, TenantScope, TrustLevel},
    resource_registry::ResourceRegistry,
};

#[test]
fn host_only_registry_rejects_runtime_extension_resource_registration() {
    let mut registry = ResourceRegistry::default();
    let descriptor = ResourceDescriptor::new(
        "members",
        ResourceKind::Static,
        Plane::Control,
        Exposure::Console,
        TenantScope::System,
        TrustLevel::RuntimeExtension,
    );

    assert!(registry.register(descriptor).is_err());
}
```

Create `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`:

```rust
use control_plane::model_definition::{ModelDefinitionService, PublishModelCommand};
use runtime_core::resource_descriptor::ResourceKind;

#[tokio::test]
async fn publish_model_returns_runtime_resource_descriptor() {
    let service = ModelDefinitionService::for_tests();
    let published = service
        .publish_model(PublishModelCommand {
            actor_user_id: uuid::Uuid::nil(),
            model_id: uuid::Uuid::nil(),
        })
        .await
        .unwrap();

    assert_eq!(published.resource.kind, ResourceKind::RuntimeModel);
    assert_eq!(published.resource.code, "models.runtime.nil");
}
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `cargo test -p runtime-core host_only_registry_rejects_runtime_extension_resource_registration -- --exact`

Expected: FAIL because `runtime-core` only has the stub crate.

Run: `cargo test -p control-plane publish_model_returns_runtime_resource_descriptor -- --exact`

Expected: FAIL because `model_definition` service does not exist.

- [ ] **Step 3: Implement the resource descriptor, registry, and model publish flow**

Create `api/crates/runtime-core/src/resource_descriptor.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResourceKind {
    Static,
    ModelDefinition,
    RuntimeModel,
    Virtual,
    Plugin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Plane {
    Public,
    Control,
    Runtime,
    Internal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Exposure {
    Internal,
    Console,
    Public,
    Callback,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TenantScope {
    System,
    Team,
    App,
    User,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustLevel {
    Core,
    HostExtension,
    RuntimeExtension,
    CapabilityPlugin,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceDescriptor {
    pub code: String,
    pub kind: ResourceKind,
    pub plane: Plane,
    pub exposure: Exposure,
    pub tenant_scope: TenantScope,
    pub trust_level: TrustLevel,
}
```

Create `api/crates/runtime-core/src/resource_registry.rs` with a `register()` method that rejects everything except `Core` and `HostExtension` for externally visible resources.

Create `api/crates/control-plane/src/model_definition.rs` with a `ModelDefinitionService` and `PublishModelCommand` that persists metadata, then returns a `PublishedModel` containing a runtime `ResourceDescriptor`.

Add `api/crates/storage-pg/migrations/20260412230000_create_model_definition_tables.sql` for:

```sql
create table model_definitions (
  id uuid primary key,
  code text not null unique,
  name text not null,
  status text not null,
  published_version bigint,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table model_definition_versions (
  id uuid primary key,
  model_id uuid not null references model_definitions(id) on delete cascade,
  version bigint not null,
  payload jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(model_id, version)
);
```

Create `api/apps/api-server/src/routes/model_definitions.rs` and expose:

```rust
pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/models", get(list_models).post(create_model))
        .route("/models/:id/actions/publish", post(publish_model))
}
```

- [ ] **Step 4: Run the resource/modeling test slice**

Run: `cargo test -p runtime-core host_only_registry_rejects_runtime_extension_resource_registration -- --exact`

Run: `cargo test -p control-plane publish_model_returns_runtime_resource_descriptor -- --exact`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/crates/domain/src/resource.rs \
  api/crates/domain/src/modeling.rs \
  api/crates/runtime-core \
  api/crates/control-plane/src/model_definition.rs \
  api/crates/control-plane/src/_tests/model_definition_service_tests.rs \
  api/crates/storage-pg/src/model_definition_repository.rs \
  api/crates/storage-pg/src/mappers/model_definition_mapper.rs \
  api/crates/storage-pg/migrations/20260412230000_create_model_definition_tables.sql \
  api/apps/api-server/src/routes/model_definitions.rs \
  api/apps/api-server/src/_tests/model_definition_routes.rs
git commit -m "feat: add resource kernel and model definition foundation"
```

### Task 5: Add Runtime Capability Slots, Runtime Routes, And Backend Verification Tooling

**Files:**
- Create: `api/crates/runtime-core/src/runtime_engine.rs`
- Create: `api/crates/runtime-core/src/capability_slots.rs`
- Create: `api/crates/runtime-core/src/_tests/runtime_engine_tests.rs`
- Create: `api/apps/api-server/src/routes/runtime_models.rs`
- Create: `api/apps/api-server/src/_tests/runtime_model_routes.rs`
- Create: `scripts/node/verify-backend.js`
- Create: `api/README.md`
- Modify: `api/crates/runtime-core/src/lib.rs`
- Modify: `api/apps/api-server/src/routes/mod.rs`
- Modify: `api/apps/api-server/src/lib.rs`

- [ ] **Step 1: Write the failing runtime-slot tests**

Create `api/crates/runtime-core/src/_tests/runtime_engine_tests.rs`:

```rust
use runtime_core::runtime_engine::{
    InMemoryRuntimeEngine, RuntimeCreateInput, RuntimeQueryInput,
};
use uuid::Uuid;

#[tokio::test]
async fn runtime_engine_applies_scope_and_default_slots_before_create() {
    let engine = InMemoryRuntimeEngine::for_tests();

    let created = engine
        .create_record(RuntimeCreateInput {
            actor_user_id: Uuid::nil(),
            model_code: "orders".into(),
            payload: serde_json::json!({ "title": "A-001" }),
        })
        .await
        .unwrap();

    assert_eq!(created["owner_id"], serde_json::json!(Uuid::nil()));
}

#[tokio::test]
async fn runtime_engine_applies_scope_resolver_to_queries() {
    let engine = InMemoryRuntimeEngine::for_tests();

    let scope = engine
        .resolve_scope(RuntimeQueryInput {
            actor_user_id: Uuid::nil(),
            model_code: "orders".into(),
        })
        .await
        .unwrap();

    assert_eq!(scope.scope_code, "own");
}
```

- [ ] **Step 2: Run the focused runtime tests and confirm failure**

Run: `cargo test -p runtime-core runtime_engine_applies_scope_and_default_slots_before_create -- --exact`

Expected: FAIL because `runtime_engine` does not exist.

- [ ] **Step 3: Implement runtime slots, runtime routes, and the verification script**

Create `api/crates/runtime-core/src/capability_slots.rs`:

```rust
use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ScopeResolution {
    pub scope_code: String,
}

#[async_trait]
pub trait QueryScopeResolver: Send + Sync {
    async fn resolve(&self, actor_user_id: Uuid, model_code: &str) -> anyhow::Result<ScopeResolution>;
}

#[async_trait]
pub trait RecordValidator: Send + Sync {
    async fn validate(&self, actor_user_id: Uuid, model_code: &str, payload: &Value) -> anyhow::Result<()>;
}

#[async_trait]
pub trait DefaultValueResolver: Send + Sync {
    async fn apply(&self, actor_user_id: Uuid, model_code: &str, payload: Value) -> anyhow::Result<Value>;
}
```

Create `api/crates/runtime-core/src/runtime_engine.rs` with an `InMemoryRuntimeEngine::for_tests()` that wires a default value resolver and query scope resolver for the tests.

Create `api/apps/api-server/src/routes/runtime_models.rs`:

```rust
pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/runtime/models/:model_code/records", get(list_records).post(create_record))
        .route(
            "/runtime/models/:model_code/records/:id/actions/:action_code",
            post(run_action),
        )
}
```

Create `scripts/node/verify-backend.js`:

```js
#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const commands = [
  ["cargo", ["fmt", "--all", "--check"]],
  ["cargo", ["clippy", "--workspace", "--all-targets", "--", "-D", "warnings"]],
  ["cargo", ["test", "--workspace"]],
  ["cargo", ["check", "--workspace"]],
];

for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: "api" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
```

Create `api/README.md` with a short module map and:

````md
## Verification

Run from the repository root:

```bash
node scripts/node/verify-backend.js
```
````

- [ ] **Step 4: Run the runtime and verification slice**

Run: `cargo test -p runtime-core -- --nocapture`

Run: `node scripts/node/verify-backend.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/crates/runtime-core/src/runtime_engine.rs \
  api/crates/runtime-core/src/capability_slots.rs \
  api/crates/runtime-core/src/_tests/runtime_engine_tests.rs \
  api/apps/api-server/src/routes/runtime_models.rs \
  api/apps/api-server/src/_tests/runtime_model_routes.rs \
  scripts/node/verify-backend.js \
  api/README.md
git commit -m "feat: add runtime slots and backend verification tooling"
```

## Self-Review Checklist

- Resource/kernel changes map back to the interface spec sections on `host-extension`, `runtime extension`, `capability plugin`, and runtime routes.
- Repository/mapper split directly addresses the engineering-quality spec sections on layering, naming, and file-size pressure.
- The plan intentionally does not promise business-specific runtime records or publish adapters beyond the foundation slice above.
- No task depends on a file path that is not introduced earlier or listed in the file structure.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-12-backend-kernel-and-quality-alignment.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
