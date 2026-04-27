# External Bridge Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地外部 agent observed-facts-only 审计、telemetry bridge 可信等级、插件运行时隔离矩阵，以及 system_agent 的触发器、身份、审批和审计边界。

**Architecture:** Raw gateway 只记录 1flowbase 实际观测到的事实；外部本地 tool/MCP/skill/subagent 行为默认 `external_opaque`。Telemetry bridge 可接收签名事件，但必须按 `host_fact / verified_bridge / agent_reported / inferred / external_opaque` 区分显示和审计；插件隔离通过运行时 permission matrix 固化。

**Tech Stack:** Rust 2021、Axum、SQLx/PostgreSQL、Serde、ed25519-dalek、control-plane、access-control

---

## File Structure

- Modify: `api/crates/domain/src/runtime_observability.rs`
- Create: `api/crates/control-plane/src/external_agent_bridge.rs`
- Create: `api/crates/control-plane/src/plugin_isolation.rs`
- Create: `api/crates/control-plane/src/system_agent.rs`
- Modify: `api/crates/control-plane/src/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427210000_create_external_bridge_and_isolation_tables.sql`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`
- Modify: `api/apps/api-server/src/_tests/application/application_runtime_routes.rs`
- Create: `api/crates/control-plane/src/_tests/external_agent_bridge_tests.rs`
- Create: `api/crates/control-plane/src/_tests/plugin_isolation_tests.rs`
- Create: `api/crates/control-plane/src/_tests/system_agent_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

### Task 1: Record External Opaque Boundaries

**Files:**
- Modify: `api/crates/control-plane/src/runtime_observability.rs`
- Modify: `api/apps/api-server/src/_tests/application/application_runtime_routes.rs`

- [x] **Step 1: Write failing external opaque test**

Add to `api/apps/api-server/src/_tests/application/application_runtime_routes.rs`:

```rust
#[tokio::test]
async fn external_agent_opaque_boundary_keeps_external_trust_level() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app).await;
    let application = create_runtime_application(&app, &cookie, &csrf).await;
    let run = start_basic_debug_run(&app, &cookie, &csrf, &application.id).await;

    app.state().store.mark_external_opaque_boundary(
        run.id,
        serde_json::json!({ "reason": "external local tool execution not observed" }),
    ).await.unwrap();

    let response = app.clone().oneshot(
        Request::builder()
            .method("GET")
            .uri(format!("/api/console/applications/{}/logs/runs/{}/debug-stream", application.id, run.id))
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap(),
    ).await.unwrap();

    let payload: Value = serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert!(payload["data"]["parts"].as_array().unwrap().iter().any(|part| {
        part["trust_level"] == "external_opaque"
    }));
}
```

- [x] **Step 2: Add helper**

Add to `api/crates/control-plane/src/runtime_observability.rs`:

```rust
pub async fn mark_external_opaque_boundary<R>(
    repository: &R,
    flow_run_id: uuid::Uuid,
    payload: serde_json::Value,
) -> anyhow::Result<domain::RuntimeEventRecord>
where
    R: crate::ports::OrchestrationRuntimeRepository,
{
    repository.append_runtime_event(&crate::ports::AppendRuntimeEventInput {
        flow_run_id,
        node_run_id: None,
        span_id: None,
        parent_span_id: None,
        event_type: "external_agent_opaque_boundary_marked".into(),
        layer: domain::RuntimeEventLayer::Diagnostic,
        source: domain::RuntimeEventSource::ExternalAgent,
        trust_level: domain::RuntimeTrustLevel::ExternalOpaque,
        item_id: None,
        ledger_ref: None,
        payload,
        visibility: domain::RuntimeEventVisibility::Workspace,
        durability: domain::RuntimeEventDurability::Durable,
    }).await
}
```

- [x] **Step 3: Run test**

Run:

```bash
cargo test -p api-server external_agent_opaque_boundary_keeps_external_trust_level
```

Expected: PASS after plan 07 debug-stream route exists; before plan 07, keep this test marked in the child execution notes and run it when route lands.

- [x] **Step 4: Commit**

```bash
git add api/crates/control-plane/src/runtime_observability.rs api/apps/api-server/src/_tests/application/application_runtime_routes.rs
git commit -m "feat: mark external opaque runtime boundary"
```

### Task 2: Add Telemetry Bridge Trust Protocol

**Files:**
- Modify: `api/crates/domain/src/runtime_observability.rs`
- Create: `api/crates/control-plane/src/external_agent_bridge.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427210000_create_external_bridge_and_isolation_tables.sql`
- Create: `api/crates/control-plane/src/_tests/external_agent_bridge_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

- [x] **Step 1: Write failing bridge verification tests**

Create `api/crates/control-plane/src/_tests/external_agent_bridge_tests.rs`:

```rust
#[test]
fn unsigned_bridge_event_is_agent_reported_not_verified() {
    let event = control_plane::external_agent_bridge::normalize_bridge_event(
        serde_json::json!({
            "session_id": "s-1",
            "event_type": "tool_call",
            "payload": { "name": "shell" }
        }),
        None,
    ).unwrap();

    assert_eq!(event.trust_level, domain::RuntimeTrustLevel::AgentReported);
}

#[test]
fn bridge_event_with_valid_signature_is_verified_bridge() {
    let event = control_plane::external_agent_bridge::normalize_bridge_event(
        serde_json::json!({
            "session_id": "s-1",
            "event_type": "tool_call",
            "payload": { "name": "shell" }
        }),
        Some(control_plane::external_agent_bridge::BridgeSignatureStatus::Valid),
    ).unwrap();

    assert_eq!(event.trust_level, domain::RuntimeTrustLevel::VerifiedBridge);
}
```

- [x] **Step 2: Implement bridge normalization**

Create `api/crates/control-plane/src/external_agent_bridge.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BridgeSignatureStatus {
    Valid,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizedBridgeEvent {
    pub session_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub trust_level: domain::RuntimeTrustLevel,
}

pub fn normalize_bridge_event(
    raw: serde_json::Value,
    signature_status: Option<BridgeSignatureStatus>,
) -> anyhow::Result<NormalizedBridgeEvent> {
    let session_id = raw.get("session_id").and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("bridge event missing session_id"))?;
    let event_type = raw.get("event_type").and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("bridge event missing event_type"))?;
    let trust_level = match signature_status {
        Some(BridgeSignatureStatus::Valid) => domain::RuntimeTrustLevel::VerifiedBridge,
        Some(BridgeSignatureStatus::Invalid) | None => domain::RuntimeTrustLevel::AgentReported,
    };
    Ok(NormalizedBridgeEvent {
        session_id: session_id.into(),
        event_type: event_type.into(),
        payload: raw.get("payload").cloned().unwrap_or_else(|| serde_json::json!({})),
        trust_level,
    })
}
```

Modify `api/crates/control-plane/src/lib.rs`:

```rust
pub mod external_agent_bridge;
```

- [x] **Step 3: Add bridge tables**

Create migration:

```sql
create table external_agent_sessions (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    flow_run_id uuid references flow_runs(id) on delete cascade,
    external_agent_kind text not null,
    external_session_id text not null,
    trust_level text not null,
    opaque_boundary_marked boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(workspace_id, external_agent_kind, external_session_id)
);

create table external_agent_telemetry_events (
    id uuid primary key,
    external_agent_session_id uuid not null references external_agent_sessions(id) on delete cascade,
    runtime_event_id uuid references runtime_events(id) on delete set null,
    trust_level text not null,
    schema_version text not null,
    payload jsonb not null,
    signature_status text,
    created_at timestamptz not null default now()
);
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane external_agent_bridge
cargo test -p storage-postgres migration_smoke
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/control-plane/src/external_agent_bridge.rs api/crates/control-plane/src/lib.rs api/crates/control-plane/src/_tests/external_agent_bridge_tests.rs api/crates/control-plane/src/_tests/mod.rs api/crates/storage-durable/postgres/migrations/20260427210000_create_external_bridge_and_isolation_tables.sql
git commit -m "feat: add external agent bridge trust protocol"
```

### Task 3: Encode Plugin Isolation Matrix

**Files:**
- Create: `api/crates/control-plane/src/plugin_isolation.rs`
- Create: `api/crates/control-plane/src/_tests/plugin_isolation_tests.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

- [x] **Step 1: Write failing isolation tests**

Create `api/crates/control-plane/src/_tests/plugin_isolation_tests.rs`:

```rust
#[test]
fn model_provider_plugin_cannot_register_routes_or_execute_tools() {
    let policy = control_plane::plugin_isolation::policy_for("model_provider_plugin").unwrap();

    assert!(!policy.can_register_route);
    assert!(!policy.can_execute_host_tool);
    assert_eq!(policy.db_write, "none");
    assert_eq!(policy.host_callback, "provider_event_only");
}

#[test]
fn capability_plugin_must_use_host_api_for_state_changes() {
    let policy = control_plane::plugin_isolation::policy_for("capability_plugin").unwrap();

    assert_eq!(policy.db_write, "host_api_only");
    assert_eq!(policy.host_callback, "capability_result");
    assert!(policy.rate_limit_required);
}
```

- [x] **Step 2: Implement matrix**

Create `api/crates/control-plane/src/plugin_isolation.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeIsolationPolicy {
    pub process_model: &'static str,
    pub secret_scope: &'static str,
    pub network_scope: &'static str,
    pub file_scope: &'static str,
    pub db_write: &'static str,
    pub host_callback: &'static str,
    pub can_register_route: bool,
    pub can_execute_host_tool: bool,
    pub approval_required: &'static str,
    pub rate_limit_required: bool,
}

pub fn policy_for(kind: &str) -> Option<RuntimeIsolationPolicy> {
    match kind {
        "model_provider_plugin" => Some(RuntimeIsolationPolicy {
            process_model: "process_per_call_or_worker",
            secret_scope: "provider_scoped",
            network_scope: "provider_endpoint",
            file_scope: "temp_dir_only",
            db_write: "none",
            host_callback: "provider_event_only",
            can_register_route: false,
            can_execute_host_tool: false,
            approval_required: "provider_policy",
            rate_limit_required: true,
        }),
        "capability_plugin" => Some(RuntimeIsolationPolicy {
            process_model: "capability_runtime",
            secret_scope: "capability_scoped",
            network_scope: "declared_capability",
            file_scope: "declared_capability",
            db_write: "host_api_only",
            host_callback: "capability_result",
            can_register_route: false,
            can_execute_host_tool: true,
            approval_required: "optional_or_forced",
            rate_limit_required: true,
        }),
        "external_agent_bridge" => Some(RuntimeIsolationPolicy {
            process_model: "ingress_only",
            secret_scope: "bridge_token",
            network_scope: "ingest_only",
            file_scope: "none",
            db_write: "host_api_only",
            host_callback: "telemetry_ingest",
            can_register_route: false,
            can_execute_host_tool: false,
            approval_required: "not_applicable",
            rate_limit_required: true,
        }),
        _ => None,
    }
}
```

Modify `api/crates/control-plane/src/lib.rs`:

```rust
pub mod plugin_isolation;
```

- [x] **Step 3: Run tests**

Run:

```bash
cargo test -p control-plane plugin_isolation
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add api/crates/control-plane/src/plugin_isolation.rs api/crates/control-plane/src/lib.rs api/crates/control-plane/src/_tests/plugin_isolation_tests.rs api/crates/control-plane/src/_tests/mod.rs
git commit -m "feat: encode plugin runtime isolation matrix"
```

### Task 4: Add System Agent Boundary Model

**Files:**
- Create: `api/crates/control-plane/src/system_agent.rs`
- Create: `api/crates/control-plane/src/_tests/system_agent_tests.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

- [x] **Step 1: Write failing system agent tests**

Create `api/crates/control-plane/src/_tests/system_agent_tests.rs`:

```rust
#[test]
fn system_agent_high_risk_action_requires_approval() {
    let action = control_plane::system_agent::SystemAgentAction {
        action_kind: "write_business_state".into(),
        risk_level: "high".into(),
    };

    assert!(control_plane::system_agent::requires_approval(&action));
}

#[test]
fn system_agent_identity_is_not_external_bridge() {
    let identity = control_plane::system_agent::SystemAgentIdentity::system("billing-monitor");

    assert_eq!(identity.actor_kind, "system_agent");
    assert_ne!(identity.actor_kind, "external_agent");
}
```

- [x] **Step 2: Implement system agent model**

Create `api/crates/control-plane/src/system_agent.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SystemAgentIdentity {
    pub actor_kind: String,
    pub agent_name: String,
    pub delegated_user_id: Option<String>,
}

impl SystemAgentIdentity {
    pub fn system(agent_name: impl Into<String>) -> Self {
        Self {
            actor_kind: "system_agent".into(),
            agent_name: agent_name.into(),
            delegated_user_id: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SystemAgentAction {
    pub action_kind: String,
    pub risk_level: String,
}

pub fn requires_approval(action: &SystemAgentAction) -> bool {
    matches!(action.risk_level.as_str(), "high" | "critical")
        || matches!(action.action_kind.as_str(), "write_business_state" | "debit_credit")
}
```

Modify `api/crates/control-plane/src/lib.rs`:

```rust
pub mod system_agent;
```

- [x] **Step 3: Run tests**

Run:

```bash
cargo test -p control-plane system_agent
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add api/crates/control-plane/src/system_agent.rs api/crates/control-plane/src/lib.rs api/crates/control-plane/src/_tests/system_agent_tests.rs api/crates/control-plane/src/_tests/mod.rs
git commit -m "feat: define system agent runtime boundary"
```
