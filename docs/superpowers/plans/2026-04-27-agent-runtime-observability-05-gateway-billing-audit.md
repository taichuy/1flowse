# Gateway Billing Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 gateway relay 的统一事实、billing session 幂等、usage/cost/credit 三账、provider account pool、retry/fallback/cache billing、fail-safe/rate limit 和 append-only audit ledger。

**Architecture:** Gateway 入口不直接做隐式全局容灾，而是解析 logical model/agent route 后进入 LLM 节点运行策略。每个请求先创建 billing session 和 route trace，再由 attempt ledger、usage ledger、cost ledger、credit ledger 和 audit hash 串起来；计费不确定时 fail closed，telemetry bridge 不可用时只标记不可见。

**Tech Stack:** Rust 2021、Axum、SQLx/PostgreSQL、Serde、publish-gateway、control-plane

---

## File Structure

- Modify: `api/crates/publish-gateway/Cargo.toml`
- Modify: `api/crates/publish-gateway/src/lib.rs`
- Create: `api/crates/publish-gateway/src/billing_session.rs`
- Create: `api/crates/publish-gateway/src/idempotency.rs`
- Create: `api/crates/publish-gateway/src/route_trace.rs`
- Create: `api/crates/publish-gateway/src/account_pool.rs`
- Create: `api/crates/publish-gateway/src/fail_safe.rs`
- Create: `api/crates/publish-gateway/src/_tests/mod.rs`
- Create: `api/crates/publish-gateway/src/_tests/billing_session_tests.rs`
- Modify: `api/crates/domain/src/runtime_observability.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427200000_create_gateway_billing_audit_tables.sql`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`
- Modify: `api/apps/api-server/src/_tests/application/application_runtime_routes.rs`

### Task 1: Add BillingSession And Idempotency State Machines

**Files:**
- Modify: `api/crates/publish-gateway/Cargo.toml`
- Modify: `api/crates/publish-gateway/src/lib.rs`
- Create: `api/crates/publish-gateway/src/billing_session.rs`
- Create: `api/crates/publish-gateway/src/idempotency.rs`
- Create: `api/crates/publish-gateway/src/_tests/mod.rs`
- Create: `api/crates/publish-gateway/src/_tests/billing_session_tests.rs`

- [x] **Step 1: Write failing state tests**

Create `api/crates/publish-gateway/src/_tests/billing_session_tests.rs`:

```rust
use publish_gateway::{BillingSessionState, BillingSessionTransition, IdempotencyStatus};

#[test]
fn billing_session_settle_is_idempotent() {
    let state = BillingSessionState::reserved("session-1", "idem-1");
    let settled = state.apply(BillingSessionTransition::Settle { usage_ledger_id: "usage-1".into() }).unwrap();
    let replayed = settled.apply(BillingSessionTransition::Settle { usage_ledger_id: "usage-1".into() }).unwrap();

    assert_eq!(settled, replayed);
}

#[test]
fn billing_session_refund_is_idempotent_after_reserve() {
    let state = BillingSessionState::reserved("session-1", "idem-1");
    let refunded = state.apply(BillingSessionTransition::Refund { reason: "provider_failed".into() }).unwrap();
    let replayed = refunded.apply(BillingSessionTransition::Refund { reason: "provider_failed".into() }).unwrap();

    assert_eq!(refunded, replayed);
}

#[test]
fn idempotency_status_strings_match_gateway_contract() {
    assert_eq!(IdempotencyStatus::Processing.as_str(), "processing");
    assert_eq!(IdempotencyStatus::Succeeded.as_str(), "succeeded");
    assert_eq!(IdempotencyStatus::FailedRetryable.as_str(), "failed_retryable");
}
```

Create `api/crates/publish-gateway/src/_tests/mod.rs`:

```rust
mod billing_session_tests;
```

- [x] **Step 2: Run failing tests**

Run:

```bash
cargo test -p publish-gateway billing_session
```

Expected: FAIL because gateway state types do not exist.

- [x] **Step 3: Add dependencies**

Modify `api/crates/publish-gateway/Cargo.toml`:

```toml
[dependencies]
domain = { path = "../domain" }
serde.workspace = true
serde_json.workspace = true
uuid.workspace = true
```

- [x] **Step 4: Implement state machines**

Create `api/crates/publish-gateway/src/billing_session.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BillingSessionState {
    pub session_id: String,
    pub idempotency_key: String,
    pub status: domain::BillingSessionStatus,
    pub usage_ledger_id: Option<String>,
    pub refund_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BillingSessionTransition {
    Settle { usage_ledger_id: String },
    Refund { reason: String },
    Fail { reason: String },
}

impl BillingSessionState {
    pub fn reserved(session_id: impl Into<String>, idempotency_key: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            idempotency_key: idempotency_key.into(),
            status: domain::BillingSessionStatus::Reserved,
            usage_ledger_id: None,
            refund_reason: None,
        }
    }

    pub fn apply(&self, transition: BillingSessionTransition) -> Result<Self, String> {
        match (&self.status, transition) {
            (domain::BillingSessionStatus::Reserved, BillingSessionTransition::Settle { usage_ledger_id }) => {
                let mut next = self.clone();
                next.status = domain::BillingSessionStatus::Settled;
                next.usage_ledger_id = Some(usage_ledger_id);
                Ok(next)
            }
            (domain::BillingSessionStatus::Settled, BillingSessionTransition::Settle { usage_ledger_id })
                if self.usage_ledger_id.as_deref() == Some(usage_ledger_id.as_str()) => Ok(self.clone()),
            (domain::BillingSessionStatus::Reserved, BillingSessionTransition::Refund { reason }) => {
                let mut next = self.clone();
                next.status = domain::BillingSessionStatus::Refunded;
                next.refund_reason = Some(reason);
                Ok(next)
            }
            (domain::BillingSessionStatus::Refunded, BillingSessionTransition::Refund { reason })
                if self.refund_reason.as_deref() == Some(reason.as_str()) => Ok(self.clone()),
            (domain::BillingSessionStatus::Reserved, BillingSessionTransition::Fail { reason }) => {
                let mut next = self.clone();
                next.status = domain::BillingSessionStatus::Failed;
                next.refund_reason = Some(reason);
                Ok(next)
            }
            _ => Err("invalid billing session transition".into()),
        }
    }
}
```

Create `api/crates/publish-gateway/src/idempotency.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdempotencyStatus {
    Processing,
    Succeeded,
    FailedRetryable,
}

impl IdempotencyStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Processing => "processing",
            Self::Succeeded => "succeeded",
            Self::FailedRetryable => "failed_retryable",
        }
    }
}
```

Modify `api/crates/publish-gateway/src/lib.rs`:

```rust
pub mod billing_session;
pub mod idempotency;

pub use billing_session::{BillingSessionState, BillingSessionTransition};
pub use idempotency::IdempotencyStatus;

#[cfg(test)]
mod _tests;
```

- [x] **Step 5: Run tests**

Run:

```bash
cargo test -p publish-gateway billing_session
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/crates/publish-gateway
git commit -m "feat: add gateway billing session state"
```

### Task 2: Add Billing, Cost, Credit, Account Pool Tables

**Files:**
- Modify: `api/crates/domain/src/runtime_observability.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427200000_create_gateway_billing_audit_tables.sql`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`

- [x] **Step 1: Write failing ledger repository test**

Add:

```rust
#[tokio::test]
async fn credit_ledger_idempotency_prevents_double_debit() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let workspace_id = seed_workspace(&store, "Billing").await;

    let first = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_credit_ledger(
        &store,
        &AppendCreditLedgerInput {
            workspace_id,
            user_id: None,
            app_id: None,
            agent_id: None,
            flow_run_id: None,
            span_id: None,
            cost_ledger_id: None,
            transaction_type: "debit".into(),
            amount: "3.50".into(),
            balance_after: Some("96.50".into()),
            credit_unit: "credit".into(),
            reason: "gateway_settle".into(),
            idempotency_key: "idem-1".into(),
            status: "posted".into(),
        },
    ).await.unwrap();

    let replay = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_credit_ledger(
        &store,
        &AppendCreditLedgerInput {
            workspace_id,
            idempotency_key: "idem-1".into(),
            amount: "3.50".into(),
            transaction_type: "debit".into(),
            credit_unit: "credit".into(),
            reason: "gateway_settle".into(),
            status: "posted".into(),
            user_id: None,
            app_id: None,
            agent_id: None,
            flow_run_id: None,
            span_id: None,
            cost_ledger_id: None,
            balance_after: Some("96.50".into()),
        },
    ).await.unwrap();

    assert_eq!(first.id, replay.id);
}
```

- [x] **Step 2: Add migration**

Create `api/crates/storage-durable/postgres/migrations/20260427200000_create_gateway_billing_audit_tables.sql`:

```sql
create table runtime_cost_ledger (
    id uuid primary key,
    flow_run_id uuid references flow_runs(id) on delete cascade,
    span_id uuid references runtime_spans(id) on delete set null,
    usage_ledger_id uuid references runtime_usage_ledger(id) on delete set null,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    provider_instance_id uuid,
    provider_account_id uuid,
    gateway_route_id uuid,
    model_id text,
    upstream_model_id text,
    price_snapshot jsonb not null default '{}'::jsonb,
    raw_cost numeric,
    normalized_cost numeric,
    settlement_currency text,
    cost_source text not null,
    cost_status text not null,
    created_at timestamptz not null default now()
);

create table runtime_credit_ledger (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id uuid references users(id) on delete set null,
    app_id uuid references applications(id) on delete set null,
    agent_id uuid,
    flow_run_id uuid references flow_runs(id) on delete cascade,
    span_id uuid references runtime_spans(id) on delete set null,
    cost_ledger_id uuid references runtime_cost_ledger(id) on delete set null,
    transaction_type text not null,
    amount numeric not null,
    balance_after numeric,
    credit_unit text not null,
    reason text not null,
    idempotency_key text not null,
    status text not null,
    created_at timestamptz not null default now(),
    unique(workspace_id, idempotency_key)
);

create table billing_sessions (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    flow_run_id uuid references flow_runs(id) on delete cascade,
    client_request_id text,
    idempotency_key text not null,
    route_id uuid,
    provider_account_id uuid,
    status text not null,
    reserved_credit_ledger_id uuid references runtime_credit_ledger(id) on delete set null,
    settled_credit_ledger_id uuid references runtime_credit_ledger(id) on delete set null,
    refund_credit_ledger_id uuid references runtime_credit_ledger(id) on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(workspace_id, idempotency_key)
);

create table provider_account_pools (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    provider_code text not null,
    upstream_kind text not null,
    accounts jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

- [x] **Step 3: Implement idempotent credit append**

In repository, use:

```sql
insert into runtime_credit_ledger (...)
values (...)
on conflict (workspace_id, idempotency_key) do update
set idempotency_key = excluded.idempotency_key
returning ...
```

This returns the original row and does not change amount/status.

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p storage-postgres credit_ledger_idempotency_prevents_double_debit
cargo test -p storage-postgres migration_smoke
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/domain/src/runtime_observability.rs api/crates/storage-durable/postgres/migrations/20260427200000_create_gateway_billing_audit_tables.sql api/crates/control-plane/src/ports/runtime.rs api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs
git commit -m "feat: add gateway billing ledgers"
```

### Task 3: Add Route Trace, Account Selection, Fail-Safe Rules

**Files:**
- Create: `api/crates/publish-gateway/src/route_trace.rs`
- Create: `api/crates/publish-gateway/src/account_pool.rs`
- Create: `api/crates/publish-gateway/src/fail_safe.rs`
- Modify: `api/crates/publish-gateway/src/lib.rs`
- Create: `api/crates/publish-gateway/src/_tests/billing_session_tests.rs`

- [x] **Step 1: Write tests**

Append:

```rust
use publish_gateway::{FailSafeDecision, GatewayRouteTrace, ProviderAccountCandidate};

#[test]
fn account_selection_skips_exhausted_accounts() {
    let account = publish_gateway::select_provider_account(vec![
        ProviderAccountCandidate { id: "a".into(), priority: 1, health_status: "exhausted".into(), supports_model: true },
        ProviderAccountCandidate { id: "b".into(), priority: 2, health_status: "healthy".into(), supports_model: true },
    ]).unwrap();

    assert_eq!(account.id, "b");
}

#[test]
fn billing_unknown_fails_closed() {
    assert_eq!(
        publish_gateway::decide_fail_safe("billing_unknown"),
        FailSafeDecision::FailClosed
    );
}
```

- [x] **Step 2: Implement route trace**

Create `api/crates/publish-gateway/src/route_trace.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct GatewayRouteTrace {
    pub logical_model_id: String,
    pub route_id: Option<String>,
    pub provider_instance_id: Option<String>,
    pub provider_account_id: Option<String>,
    pub upstream_model_id: Option<String>,
    pub routing_mode: String,
    pub trust_level: domain::RuntimeTrustLevel,
}
```

- [x] **Step 3: Implement account selection**

Create `api/crates/publish-gateway/src/account_pool.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderAccountCandidate {
    pub id: String,
    pub priority: i32,
    pub health_status: String,
    pub supports_model: bool,
}

pub fn select_provider_account(mut candidates: Vec<ProviderAccountCandidate>) -> Option<ProviderAccountCandidate> {
    candidates.sort_by_key(|candidate| candidate.priority);
    candidates.into_iter().find(|candidate| {
        candidate.supports_model && matches!(candidate.health_status.as_str(), "healthy" | "degraded")
    })
}
```

- [x] **Step 4: Implement fail-safe**

Create `api/crates/publish-gateway/src/fail_safe.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailSafeDecision {
    Continue,
    MarkOpaque,
    PauseForApproval,
    FailClosed,
}

pub fn decide_fail_safe(condition: &str) -> FailSafeDecision {
    match condition {
        "billing_unknown" | "usage_cost_unavailable" => FailSafeDecision::FailClosed,
        "telemetry_bridge_unavailable" => FailSafeDecision::MarkOpaque,
        "high_risk_capability_without_approval" => FailSafeDecision::PauseForApproval,
        _ => FailSafeDecision::Continue,
    }
}
```

- [x] **Step 5: Export and run tests**

Modify `api/crates/publish-gateway/src/lib.rs`:

```rust
pub mod account_pool;
pub mod fail_safe;
pub mod route_trace;

pub use account_pool::{select_provider_account, ProviderAccountCandidate};
pub use fail_safe::{decide_fail_safe, FailSafeDecision};
pub use route_trace::GatewayRouteTrace;
```

Run:

```bash
cargo test -p publish-gateway account_selection_skips_exhausted_accounts
cargo test -p publish-gateway billing_unknown_fails_closed
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/crates/publish-gateway
git commit -m "feat: add gateway route and fail-safe primitives"
```

### Task 4: Add Audit Hash Chain

**Files:**
- Modify: `api/crates/control-plane/src/runtime_observability.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`

- [x] **Step 1: Write failing audit hash test**

Add:

```rust
#[tokio::test]
async fn audit_hash_chain_links_runtime_facts() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let run = seed_flow_run(&store, &seeded, &compiled, datetime!(2026-04-27 12:00:00 UTC)).await;

    let first = store.append_audit_hash(run.id, "runtime_events", Uuid::now_v7(), serde_json::json!({"a":1})).await.unwrap();
    let second = store.append_audit_hash(run.id, "runtime_events", Uuid::now_v7(), serde_json::json!({"a":2})).await.unwrap();

    assert_eq!(second.prev_hash.as_deref(), Some(first.row_hash.as_str()));
}
```

- [x] **Step 2: Implement hash helper**

Add to `api/crates/control-plane/src/runtime_observability.rs`:

```rust
pub fn audit_row_hash(prev_hash: Option<&str>, fact_table: &str, fact_id: uuid::Uuid, payload: &serde_json::Value) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    if let Some(prev) = prev_hash {
        hasher.update(prev.as_bytes());
    }
    hasher.update(fact_table.as_bytes());
    hasher.update(fact_id.as_bytes());
    hasher.update(serde_json::to_vec(payload).unwrap_or_default());
    format!("sha256:{:x}", hasher.finalize())
}
```

- [x] **Step 3: Implement repository append**

Add repository method that fetches the latest `row_hash` for the run, computes the next hash, inserts `runtime_audit_hashes`, and returns the row.

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p storage-postgres audit_hash_chain_links_runtime_facts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/control-plane/src/runtime_observability.rs api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs
git commit -m "feat: add runtime audit hash chain"
```
