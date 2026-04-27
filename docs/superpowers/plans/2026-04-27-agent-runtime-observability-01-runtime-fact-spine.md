# Runtime Fact Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 runtime 事实主干：`RuntimeSpan`、`RuntimeEvent`、`RuntimeItem`、artifact、projection shell、ledger shell 和 audit hash，并保持旧 `flow_run_events` 兼容。

**Architecture:** 新增 domain contract、PostgreSQL append-only 表、repository port 和 shadow-write helper。现阶段不替换旧调试 API，只让现有 flow debug run 同步写新事实，后续子计划逐步消费。

**Tech Stack:** Rust 2021、SQLx/PostgreSQL、Serde、UUID v7、time、sha2

---

## File Structure

- Create: `api/crates/domain/src/runtime_observability.rs`
- Modify: `api/crates/domain/src/lib.rs`
- Create: `api/crates/domain/src/_tests/runtime_observability_tests.rs`
- Modify: `api/crates/domain/src/_tests/mod.rs`
- Modify: `api/crates/control-plane/Cargo.toml`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Create: `api/crates/control-plane/src/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/persistence.rs`
- Create: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/mod.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`

### Task 1: Add Runtime Observability Domain Types

**Files:**
- Create: `api/crates/domain/src/runtime_observability.rs`
- Modify: `api/crates/domain/src/lib.rs`
- Create: `api/crates/domain/src/_tests/runtime_observability_tests.rs`
- Modify: `api/crates/domain/src/_tests/mod.rs`

- [x] **Step 1: Write failing enum stability tests**

Create `api/crates/domain/src/_tests/runtime_observability_tests.rs`:

```rust
use domain::{
    RuntimeEventDurability, RuntimeEventLayer, RuntimeEventSource, RuntimeItemKind,
    RuntimeSpanKind, RuntimeTrustLevel,
};

#[test]
fn runtime_observability_enum_strings_are_stable() {
    assert_eq!(RuntimeSpanKind::LlmTurn.as_str(), "llm_turn");
    assert_eq!(RuntimeEventLayer::ProviderRaw.as_str(), "provider_raw");
    assert_eq!(RuntimeEventSource::GatewayRelay.as_str(), "gateway_relay");
    assert_eq!(RuntimeTrustLevel::ExternalOpaque.as_str(), "external_opaque");
    assert_eq!(RuntimeEventDurability::Sampled.as_str(), "sampled");
    assert_eq!(RuntimeItemKind::GatewayForward.as_str(), "gateway_forward");
}
```

Modify `api/crates/domain/src/_tests/mod.rs`:

```rust
mod auth_domain_tests;
mod resource_tests;
mod runtime_observability_tests;
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p domain runtime_observability_enum_strings_are_stable
```

Expected: FAIL with unresolved imports for runtime observability types.

- [x] **Step 3: Implement domain contract**

Create `api/crates/domain/src/runtime_observability.rs`:

```rust
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

macro_rules! string_enum {
    ($name:ident { $($variant:ident => $value:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        #[serde(rename_all = "snake_case")]
        pub enum $name { $($variant),+ }

        impl $name {
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
        }
    };
}

string_enum!(RuntimeSpanKind {
    Flow => "flow",
    Node => "node",
    LlmTurn => "llm_turn",
    ProviderRequest => "provider_request",
    GatewayForward => "gateway_forward",
    ToolCall => "tool_call",
    McpCall => "mcp_call",
    SkillLoad => "skill_load",
    SkillAction => "skill_action",
    WorkflowTool => "workflow_tool",
    DataRetrieval => "data_retrieval",
    Approval => "approval",
    Compaction => "compaction",
    Subagent => "subagent",
    SystemAgent => "system_agent",
});

string_enum!(RuntimeSpanStatus {
    Running => "running",
    Succeeded => "succeeded",
    Failed => "failed",
    Cancelled => "cancelled",
    Waiting => "waiting",
});

string_enum!(RuntimeEventLayer {
    ProviderRaw => "provider_raw",
    RuntimeItem => "runtime_item",
    Capability => "capability",
    AgentTransition => "agent_transition",
    Ledger => "ledger",
    Diagnostic => "diagnostic",
});

string_enum!(RuntimeEventSource {
    Host => "host",
    ProviderPlugin => "provider_plugin",
    GatewayRelay => "gateway_relay",
    InternalAgent => "internal_agent",
    ExternalAgent => "external_agent",
});

string_enum!(RuntimeTrustLevel {
    HostFact => "host_fact",
    VerifiedBridge => "verified_bridge",
    AgentReported => "agent_reported",
    ExternalOpaque => "external_opaque",
    Inferred => "inferred",
});

string_enum!(RuntimeEventVisibility {
    Internal => "internal",
    Workspace => "workspace",
    User => "user",
    Public => "public",
});

string_enum!(RuntimeEventDurability {
    Ephemeral => "ephemeral",
    Durable => "durable",
    Sampled => "sampled",
});

string_enum!(RuntimeItemKind {
    Message => "message",
    Reasoning => "reasoning",
    ToolCall => "tool_call",
    ToolResult => "tool_result",
    McpCall => "mcp_call",
    SkillLoad => "skill_load",
    SkillAction => "skill_action",
    Approval => "approval",
    Handoff => "handoff",
    AgentAsTool => "agent_as_tool",
    Compaction => "compaction",
    GatewayForward => "gateway_forward",
});

string_enum!(RuntimeItemStatus {
    Created => "created",
    Running => "running",
    Waiting => "waiting",
    Succeeded => "succeeded",
    Failed => "failed",
    Cancelled => "cancelled",
});

string_enum!(UsageLedgerStatus {
    Recorded => "recorded",
    UnavailableError => "unavailable_error",
});

string_enum!(BillingSessionStatus {
    Reserved => "reserved",
    Settled => "settled",
    Refunded => "refunded",
    Failed => "failed",
});

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeSpanRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub kind: RuntimeSpanKind,
    pub name: String,
    pub status: RuntimeSpanStatus,
    pub capability_id: Option<String>,
    pub input_ref: Option<String>,
    pub output_ref: Option<String>,
    pub error_payload: Option<serde_json::Value>,
    pub metadata: serde_json::Value,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeEventRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub span_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub sequence: i64,
    pub event_type: String,
    pub layer: RuntimeEventLayer,
    pub source: RuntimeEventSource,
    pub trust_level: RuntimeTrustLevel,
    pub item_id: Option<Uuid>,
    pub ledger_ref: Option<String>,
    pub payload: serde_json::Value,
    pub visibility: RuntimeEventVisibility,
    pub durability: RuntimeEventDurability,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeItemRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub span_id: Option<Uuid>,
    pub kind: RuntimeItemKind,
    pub status: RuntimeItemStatus,
    pub source_event_id: Option<Uuid>,
    pub input_ref: Option<String>,
    pub output_ref: Option<String>,
    pub usage_ledger_id: Option<Uuid>,
    pub trust_level: RuntimeTrustLevel,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}
```

Modify `api/crates/domain/src/lib.rs`:

```rust
pub mod runtime_observability;

pub use runtime_observability::{
    BillingSessionStatus, RuntimeEventDurability, RuntimeEventLayer, RuntimeEventRecord,
    RuntimeEventSource, RuntimeEventVisibility, RuntimeItemKind, RuntimeItemRecord,
    RuntimeItemStatus, RuntimeSpanKind, RuntimeSpanRecord, RuntimeSpanStatus, RuntimeTrustLevel,
    UsageLedgerStatus,
};
```

- [x] **Step 4: Run domain test**

Run:

```bash
cargo test -p domain runtime_observability_enum_strings_are_stable
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/domain/src/runtime_observability.rs api/crates/domain/src/lib.rs api/crates/domain/src/_tests/mod.rs api/crates/domain/src/_tests/runtime_observability_tests.rs
git commit -m "feat: add runtime observability domain contract"
```

### Task 2: Create Append-Only Runtime Fact Tables

**Files:**
- Create: `api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`

- [x] **Step 1: Write failing repository test**

Append to `api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs`:

```rust
#[tokio::test]
async fn runtime_fact_spine_preserves_span_sequence_and_trust_level() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let started_at = datetime!(2026-04-27 09:00:00 UTC);
    let run = seed_flow_run_with_mode(
        &store,
        &seeded,
        &compiled,
        started_at,
        FlowRunMode::DebugFlowRun,
        None,
    )
    .await;

    let span = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_runtime_span(
        &store,
        &AppendRuntimeSpanInput {
            flow_run_id: run.id,
            node_run_id: None,
            parent_span_id: None,
            kind: domain::RuntimeSpanKind::Flow,
            name: "debug flow".into(),
            status: domain::RuntimeSpanStatus::Running,
            capability_id: None,
            input_ref: None,
            output_ref: None,
            error_payload: None,
            metadata: json!({ "mode": "debug_flow_run" }),
            started_at,
            finished_at: None,
        },
    )
    .await
    .unwrap();

    let event = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_runtime_event(
        &store,
        &AppendRuntimeEventInput {
            flow_run_id: run.id,
            node_run_id: None,
            span_id: Some(span.id),
            parent_span_id: None,
            event_type: "run_started".into(),
            layer: domain::RuntimeEventLayer::RuntimeItem,
            source: domain::RuntimeEventSource::Host,
            trust_level: domain::RuntimeTrustLevel::HostFact,
            item_id: None,
            ledger_ref: None,
            payload: json!({ "run_id": run.id }),
            visibility: domain::RuntimeEventVisibility::Workspace,
            durability: domain::RuntimeEventDurability::Durable,
        },
    )
    .await
    .unwrap();

    let spans = <PgControlPlaneStore as OrchestrationRuntimeRepository>::list_runtime_spans(&store, run.id)
        .await
        .unwrap();
    let events = <PgControlPlaneStore as OrchestrationRuntimeRepository>::list_runtime_events(&store, run.id, 0)
        .await
        .unwrap();

    assert_eq!(spans[0].id, span.id);
    assert_eq!(events[0].id, event.id);
    assert_eq!(events[0].sequence, 1);
    assert_eq!(events[0].trust_level, domain::RuntimeTrustLevel::HostFact);
}
```

Add imports:

```rust
use control_plane::ports::{AppendRuntimeEventInput, AppendRuntimeSpanInput};
```

- [x] **Step 2: Run failing repository test**

Run:

```bash
cargo test -p storage-postgres runtime_fact_spine_preserves_span_sequence_and_trust_level
```

Expected: FAIL because repository methods and tables do not exist.

- [x] **Step 3: Add migration**

Create `api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql`:

```sql
create table runtime_spans (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    node_run_id uuid references node_runs(id) on delete cascade,
    parent_span_id uuid references runtime_spans(id) on delete cascade,
    kind text not null,
    name text not null,
    status text not null,
    capability_id text,
    input_ref text,
    output_ref text,
    error_payload jsonb,
    metadata jsonb not null default '{}'::jsonb,
    started_at timestamptz not null,
    finished_at timestamptz
);

create index runtime_spans_flow_parent_started_idx
    on runtime_spans (flow_run_id, parent_span_id, started_at asc, id asc);

create table runtime_events (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    node_run_id uuid references node_runs(id) on delete cascade,
    span_id uuid references runtime_spans(id) on delete set null,
    parent_span_id uuid references runtime_spans(id) on delete set null,
    sequence bigint not null,
    event_type text not null,
    layer text not null,
    source text not null,
    trust_level text not null,
    item_id uuid,
    ledger_ref text,
    payload jsonb not null,
    visibility text not null,
    durability text not null,
    created_at timestamptz not null default now(),
    unique(flow_run_id, sequence)
);

create index runtime_events_flow_sequence_idx
    on runtime_events (flow_run_id, sequence asc);

create table runtime_items (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    span_id uuid references runtime_spans(id) on delete set null,
    kind text not null,
    status text not null,
    source_event_id uuid references runtime_events(id) on delete set null,
    input_ref text,
    output_ref text,
    usage_ledger_id uuid,
    trust_level text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table runtime_artifacts (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    artifact_kind text not null,
    content_ref text not null,
    content_hash text not null,
    mime_type text,
    byte_size bigint,
    redaction_status text not null default 'none',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table runtime_audit_hashes (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    fact_table text not null,
    fact_id uuid not null,
    prev_hash text,
    row_hash text not null,
    created_at timestamptz not null default now()
);
```

- [x] **Step 4: Add repository port inputs**

Modify `api/crates/control-plane/src/ports/runtime.rs` and add:

```rust
#[derive(Debug, Clone)]
pub struct AppendRuntimeSpanInput {
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub kind: domain::RuntimeSpanKind,
    pub name: String,
    pub status: domain::RuntimeSpanStatus,
    pub capability_id: Option<String>,
    pub input_ref: Option<String>,
    pub output_ref: Option<String>,
    pub error_payload: Option<serde_json::Value>,
    pub metadata: serde_json::Value,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone)]
pub struct AppendRuntimeEventInput {
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub span_id: Option<Uuid>,
    pub parent_span_id: Option<Uuid>,
    pub event_type: String,
    pub layer: domain::RuntimeEventLayer,
    pub source: domain::RuntimeEventSource,
    pub trust_level: domain::RuntimeTrustLevel,
    pub item_id: Option<Uuid>,
    pub ledger_ref: Option<String>,
    pub payload: serde_json::Value,
    pub visibility: domain::RuntimeEventVisibility,
    pub durability: domain::RuntimeEventDurability,
}
```

Add methods to `OrchestrationRuntimeRepository`:

```rust
async fn append_runtime_span(&self, input: &AppendRuntimeSpanInput) -> anyhow::Result<domain::RuntimeSpanRecord>;
async fn append_runtime_event(&self, input: &AppendRuntimeEventInput) -> anyhow::Result<domain::RuntimeEventRecord>;
async fn list_runtime_spans(&self, flow_run_id: Uuid) -> anyhow::Result<Vec<domain::RuntimeSpanRecord>>;
async fn list_runtime_events(&self, flow_run_id: Uuid, after_sequence: i64) -> anyhow::Result<Vec<domain::RuntimeEventRecord>>;
```

- [x] **Step 5: Implement PostgreSQL repository methods**

In `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`, implement:

```rust
async fn next_runtime_event_sequence(tx: &mut Transaction<'_, Postgres>, flow_run_id: Uuid) -> Result<i64> {
    Ok(sqlx::query_scalar::<_, i64>(
        "select coalesce(max(sequence), 0) + 1 from runtime_events where flow_run_id = $1",
    )
    .bind(flow_run_id)
    .fetch_one(&mut **tx)
    .await?)
}
```

Use `Uuid::now_v7()` for all new rows, call enum `as_str()` on writes, and parse strings with explicit `match` functions in `api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs`.

- [x] **Step 6: Run migration and repository tests**

Run:

```bash
cargo test -p storage-postgres migration_smoke
cargo test -p storage-postgres runtime_fact_spine_preserves_span_sequence_and_trust_level
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add api/crates/control-plane/src/ports/runtime.rs api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs api/crates/storage-durable/postgres/src/mappers/orchestration_runtime_mapper.rs api/crates/storage-durable/postgres/src/_tests/orchestration_runtime_repository_tests.rs
git commit -m "feat: persist runtime fact spine"
```

### Task 3: Shadow-Write New Facts From Existing Runs

**Files:**
- Modify: `api/crates/control-plane/Cargo.toml`
- Modify: `api/crates/control-plane/src/lib.rs`
- Create: `api/crates/control-plane/src/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/persistence.rs`
- Create: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/mod.rs`

- [x] **Step 1: Write failing shadow-write test**

Create `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`:

```rust
use serde_json::json;

#[tokio::test]
async fn flow_debug_run_shadow_writes_runtime_spans_and_provider_events() {
    let harness = super::support::runtime_harness_with_llm_response("hello", json!({
        "input_tokens": 4,
        "output_tokens": 2,
        "total_tokens": 6
    }))
    .await;

    let detail = harness.start_basic_flow_debug_run().await;
    let spans = harness.repository.list_runtime_spans(detail.flow_run.id).await.unwrap();
    let events = harness.repository.list_runtime_events(detail.flow_run.id, 0).await.unwrap();

    assert!(spans.iter().any(|span| span.kind == domain::RuntimeSpanKind::Flow));
    assert!(spans.iter().any(|span| span.kind == domain::RuntimeSpanKind::LlmTurn));
    assert!(events.iter().any(|event| event.event_type == "text_delta"));
    assert!(events.iter().any(|event| event.layer == domain::RuntimeEventLayer::ProviderRaw));
}
```

If `runtime_harness_with_llm_response` is not present, create it under `api/crates/control-plane/src/_tests/orchestration_runtime/support` using the existing in-memory repository/fake provider patterns from current orchestration runtime tests.

- [x] **Step 2: Run failing shadow-write test**

Run:

```bash
cargo test -p control-plane flow_debug_run_shadow_writes_runtime_spans_and_provider_events
```

Expected: FAIL because existing persistence only writes `flow_run_events`.

- [x] **Step 3: Add helper functions**

Modify `api/crates/control-plane/Cargo.toml`:

```toml
sha2.workspace = true
```

Create `api/crates/control-plane/src/runtime_observability.rs`:

```rust
use anyhow::Result;
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::ports::{AppendRuntimeEventInput, AppendRuntimeSpanInput, OrchestrationRuntimeRepository};

pub async fn append_host_span<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    parent_span_id: Option<Uuid>,
    kind: domain::RuntimeSpanKind,
    name: impl Into<String>,
    started_at: OffsetDateTime,
    metadata: Value,
) -> Result<domain::RuntimeSpanRecord>
where
    R: OrchestrationRuntimeRepository,
{
    repository.append_runtime_span(&AppendRuntimeSpanInput {
        flow_run_id,
        node_run_id,
        parent_span_id,
        kind,
        name: name.into(),
        status: domain::RuntimeSpanStatus::Running,
        capability_id: None,
        input_ref: None,
        output_ref: None,
        error_payload: None,
        metadata,
        started_at,
        finished_at: None,
    }).await
}

pub async fn append_host_event<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    span_id: Option<Uuid>,
    event_type: impl Into<String>,
    layer: domain::RuntimeEventLayer,
    payload: Value,
) -> Result<domain::RuntimeEventRecord>
where
    R: OrchestrationRuntimeRepository,
{
    repository.append_runtime_event(&AppendRuntimeEventInput {
        flow_run_id,
        node_run_id,
        span_id,
        parent_span_id: None,
        event_type: event_type.into(),
        layer,
        source: domain::RuntimeEventSource::Host,
        trust_level: domain::RuntimeTrustLevel::HostFact,
        item_id: None,
        ledger_ref: None,
        payload,
        visibility: domain::RuntimeEventVisibility::Workspace,
        durability: domain::RuntimeEventDurability::Durable,
    }).await
}
```

Modify `api/crates/control-plane/src/lib.rs`:

```rust
pub mod runtime_observability;
```

- [x] **Step 4: Wire shadow-write persistence**

In `api/crates/control-plane/src/orchestration_runtime/persistence.rs`:

1. At `persist_flow_debug_outcome` start, append a flow span.
2. In `persist_flow_debug_node_traces`, append a node span for every trace.
3. When `trace.node_type == "llm"`, use `RuntimeSpanKind::LlmTurn`.
4. In `append_provider_stream_events`, keep old `append_run_event` and also call `append_host_event` with `RuntimeEventLayer::ProviderRaw`.

Use this event payload:

```rust
let runtime_payload = serde_json::to_value(event)?;
```

- [x] **Step 5: Run compatibility tests**

Run:

```bash
cargo test -p control-plane flow_debug_run_shadow_writes_runtime_spans_and_provider_events
cargo test -p control-plane orchestration_runtime
cargo test -p api-server application_runtime_routes
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/crates/control-plane/Cargo.toml api/crates/control-plane/src/lib.rs api/crates/control-plane/src/runtime_observability.rs api/crates/control-plane/src/orchestration_runtime/persistence.rs api/crates/control-plane/src/_tests/orchestration_runtime
git commit -m "feat: shadow write runtime facts"
```
