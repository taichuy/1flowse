# Agent Session Capability Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 Agent Session Runtime 的上下文投影、LLM turn loop、host-owned capability loop，以及 tool/MCP/skill/workflow/approval/subagent 的统一事实模型。

**Architecture:** 先把 `ContextProjection`、`UsageLedger` 和 `RuntimeItem` 接到现有 LLM 节点，再逐步引入 `CapabilityCatalog` 与 `CapabilityInvocation`。Provider 只产生 tool/MCP intent；CapabilityRuntime 负责授权、执行、timeout/cancel、artifact、结果归一化和下一轮 LLM input。

**Tech Stack:** Rust 2021、SQLx/PostgreSQL、Serde、orchestration-runtime、control-plane、plugin-framework

---

## File Structure

- Modify: `api/crates/domain/src/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Create: `api/crates/control-plane/src/runtime_observability/projection.rs`
- Create: `api/crates/control-plane/src/runtime_observability/items.rs`
- Create: `api/crates/control-plane/src/capability_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/persistence.rs`
- Modify: `api/crates/orchestration-runtime/src/execution_engine.rs`
- Modify: `api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql`
- Create: `api/crates/storage-durable/postgres/migrations/20260427183000_create_capability_invocations.sql`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`

### Task 1: Persist ContextProjection And UsageLedger

**Files:**
- Modify: `api/crates/domain/src/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Create: `api/crates/control-plane/src/runtime_observability/projection.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/persistence.rs`
- Modify: `api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`

- [ ] **Step 1: Write failing projection proof test**

Add to `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`:

```rust
#[tokio::test]
async fn llm_turn_records_context_projection_and_usage_ledger() {
    let harness = super::support::runtime_harness_with_llm_response("hello", serde_json::json!({
        "input_tokens": 9,
        "cache_read_tokens": 3,
        "output_tokens": 2,
        "reasoning_tokens": 1,
        "total_tokens": 12
    })).await;

    let detail = harness.start_basic_flow_debug_run().await;
    let projections = harness.repository.list_context_projections(detail.flow_run.id).await.unwrap();
    let usage = harness.repository.list_usage_ledger(detail.flow_run.id).await.unwrap();

    assert_eq!(projections.len(), 1);
    assert_eq!(projections[0].projection_kind, "managed_full");
    assert!(projections[0].model_input_hash.starts_with("sha256:"));
    assert_eq!(usage[0].input_tokens, Some(9));
    assert_eq!(usage[0].cache_read_tokens, Some(3));
    assert_eq!(usage[0].usage_status, domain::UsageLedgerStatus::Recorded);
}
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cargo test -p control-plane llm_turn_records_context_projection_and_usage_ledger
```

Expected: FAIL because projections and usage ledger methods do not exist.

- [ ] **Step 3: Add domain records**

Append to `api/crates/domain/src/runtime_observability.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContextProjectionRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub llm_turn_span_id: Option<Uuid>,
    pub projection_kind: String,
    pub merge_stage_ref: Option<String>,
    pub source_transcript_ref: Option<String>,
    pub source_item_refs: serde_json::Value,
    pub compaction_event_id: Option<Uuid>,
    pub summary_version: Option<String>,
    pub model_input_ref: String,
    pub model_input_hash: String,
    pub compacted_summary_ref: Option<String>,
    pub previous_projection_id: Option<Uuid>,
    pub token_estimate: Option<i64>,
    pub provider_continuation_metadata: serde_json::Value,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UsageLedgerRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub node_run_id: Option<Uuid>,
    pub span_id: Option<Uuid>,
    pub failover_attempt_id: Option<Uuid>,
    pub provider_instance_id: Option<Uuid>,
    pub gateway_route_id: Option<Uuid>,
    pub model_id: Option<String>,
    pub upstream_model_id: Option<String>,
    pub upstream_request_id: Option<String>,
    pub input_tokens: Option<i64>,
    pub cached_input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub reasoning_output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
    pub cache_read_tokens: Option<i64>,
    pub cache_write_tokens: Option<i64>,
    pub price_snapshot: Option<serde_json::Value>,
    pub cost_snapshot: Option<serde_json::Value>,
    pub usage_status: UsageLedgerStatus,
    pub raw_usage: serde_json::Value,
    pub normalized_usage: serde_json::Value,
    pub created_at: OffsetDateTime,
}
```

Export both from `api/crates/domain/src/lib.rs`.

- [ ] **Step 4: Add migration tables**

Append to `api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql` before implementation is committed:

```sql
create table runtime_context_projections (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    node_run_id uuid references node_runs(id) on delete cascade,
    llm_turn_span_id uuid references runtime_spans(id) on delete set null,
    projection_kind text not null,
    merge_stage_ref text,
    source_transcript_ref text,
    source_item_refs jsonb not null default '[]'::jsonb,
    compaction_event_id uuid references runtime_events(id) on delete set null,
    summary_version text,
    model_input_ref text not null,
    model_input_hash text not null,
    compacted_summary_ref text,
    previous_projection_id uuid references runtime_context_projections(id) on delete set null,
    token_estimate bigint,
    provider_continuation_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table runtime_usage_ledger (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    node_run_id uuid references node_runs(id) on delete cascade,
    span_id uuid references runtime_spans(id) on delete set null,
    failover_attempt_id uuid,
    provider_instance_id uuid,
    gateway_route_id uuid,
    model_id text,
    upstream_model_id text,
    upstream_request_id text,
    input_tokens bigint,
    cached_input_tokens bigint,
    output_tokens bigint,
    reasoning_output_tokens bigint,
    total_tokens bigint,
    cache_read_tokens bigint,
    cache_write_tokens bigint,
    price_snapshot jsonb,
    cost_snapshot jsonb,
    usage_status text not null,
    raw_usage jsonb not null default '{}'::jsonb,
    normalized_usage jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
```

- [ ] **Step 5: Add projection helper**

Create `api/crates/control-plane/src/runtime_observability/projection.rs`:

```rust
use sha2::{Digest, Sha256};

pub fn model_input_hash(input: &serde_json::Value) -> String {
    let bytes = serde_json::to_vec(input).unwrap_or_default();
    let digest = Sha256::digest(bytes);
    format!("sha256:{digest:x}")
}

pub fn estimate_tokens_for_text(text: &str) -> i64 {
    ((text.chars().count() as f64) / 4.0).ceil() as i64
}
```

- [ ] **Step 6: Persist LLM projection and usage**

In `api/crates/control-plane/src/orchestration_runtime/persistence.rs`, when `trace.node_type == "llm"`:

```rust
let model_input = json!({
    "node_input": trace.input_payload,
    "provider": trace.metrics_payload.get("provider_code"),
    "model": trace.metrics_payload.get("model"),
});
let model_input_hash = crate::runtime_observability::projection::model_input_hash(&model_input);
```

Write `runtime_context_projections` with `projection_kind = "managed_full"` and `model_input_ref = format!("runtime_artifact:inline:{}", model_input_hash)`.

Write usage ledger from `trace.metrics_payload["usage"]`. If usage is absent after provider error, write `usage_status = UnavailableError`.

- [ ] **Step 7: Run tests**

Run:

```bash
cargo test -p control-plane llm_turn_records_context_projection_and_usage_ledger
cargo test -p storage-postgres migration_smoke
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/crates/domain/src/runtime_observability.rs api/crates/domain/src/lib.rs api/crates/control-plane/src/ports/runtime.rs api/crates/control-plane/src/runtime_observability api/crates/control-plane/src/orchestration_runtime/persistence.rs api/crates/storage-durable/postgres/migrations/20260427170000_create_runtime_observability_tables.sql api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs
git commit -m "feat: record llm context projection and usage"
```

### Task 2: Add RuntimeItem Folding

**Files:**
- Create: `api/crates/control-plane/src/runtime_observability/items.rs`
- Modify: `api/crates/control-plane/src/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`

- [ ] **Step 1: Write failing RuntimeItem test**

Add:

```rust
#[tokio::test]
async fn provider_events_fold_into_runtime_items() {
    let harness = super::support::runtime_harness_with_llm_response("hello", serde_json::json!({
        "input_tokens": 1,
        "output_tokens": 1,
        "total_tokens": 2
    })).await;

    let detail = harness.start_basic_flow_debug_run().await;
    let items = harness.repository.list_runtime_items(detail.flow_run.id).await.unwrap();

    assert!(items.iter().any(|item| item.kind == domain::RuntimeItemKind::Message));
    assert!(items.iter().any(|item| item.trust_level == domain::RuntimeTrustLevel::HostFact));
}
```

- [ ] **Step 2: Implement item repository methods**

Add port method:

```rust
async fn append_runtime_item(&self, input: &AppendRuntimeItemInput) -> anyhow::Result<domain::RuntimeItemRecord>;
async fn list_runtime_items(&self, flow_run_id: Uuid) -> anyhow::Result<Vec<domain::RuntimeItemRecord>>;
```

Add input:

```rust
#[derive(Debug, Clone)]
pub struct AppendRuntimeItemInput {
    pub flow_run_id: Uuid,
    pub span_id: Option<Uuid>,
    pub kind: domain::RuntimeItemKind,
    pub status: domain::RuntimeItemStatus,
    pub source_event_id: Option<Uuid>,
    pub input_ref: Option<String>,
    pub output_ref: Option<String>,
    pub usage_ledger_id: Option<Uuid>,
    pub trust_level: domain::RuntimeTrustLevel,
}
```

- [ ] **Step 3: Add item folding helper**

Create `api/crates/control-plane/src/runtime_observability/items.rs`:

```rust
pub fn item_kind_for_event(event_type: &str) -> Option<domain::RuntimeItemKind> {
    match event_type {
        "text_delta" | "finish" => Some(domain::RuntimeItemKind::Message),
        "reasoning_delta" => Some(domain::RuntimeItemKind::Reasoning),
        "tool_call_commit" => Some(domain::RuntimeItemKind::ToolCall),
        "mcp_call_commit" => Some(domain::RuntimeItemKind::McpCall),
        "context_compaction_recorded" => Some(domain::RuntimeItemKind::Compaction),
        "gateway_forward_started" | "gateway_forward_finished" => Some(domain::RuntimeItemKind::GatewayForward),
        _ => None,
    }
}
```

- [ ] **Step 4: Append items when writing runtime events**

After `append_host_event` returns, if `item_kind_for_event` returns a kind, append one item with `RuntimeItemStatus::Created` and `source_event_id = event.id`.

- [ ] **Step 5: Run tests**

Run:

```bash
cargo test -p control-plane provider_events_fold_into_runtime_items
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/crates/control-plane/src/runtime_observability api/crates/control-plane/src/ports/runtime.rs api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs
git commit -m "feat: fold runtime events into runtime items"
```

### Task 3: Add CapabilityCatalog And Invocation Facts

**Files:**
- Modify: `api/crates/domain/src/runtime_observability.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427183000_create_capability_invocations.sql`
- Modify: `api/crates/control-plane/src/ports/runtime.rs`
- Create: `api/crates/control-plane/src/capability_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/persistence.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`

- [ ] **Step 1: Write failing capability intent test**

Add:

```rust
#[tokio::test]
async fn tool_call_commit_creates_capability_invocation_request() {
    let harness = super::support::runtime_harness_with_provider_events(vec![
        plugin_framework::provider_contract::ProviderStreamEvent::ToolCallCommit {
            call: plugin_framework::provider_contract::ProviderToolCall {
                id: "call-1".into(),
                name: "lookup_order".into(),
                arguments: serde_json::json!({ "order_id": "A-1" }),
            },
        },
    ]).await;

    let detail = harness.start_basic_flow_debug_run().await;
    let invocations = harness.repository.list_capability_invocations(detail.flow_run.id).await.unwrap();

    assert_eq!(invocations[0].capability_id, "host_tool:model:lookup_order@runtime");
    assert_eq!(invocations[0].authorization_status, "requested");
    assert_eq!(invocations[0].requester_kind, "model");
}
```

- [ ] **Step 2: Add migration**

Create `api/crates/storage-durable/postgres/migrations/20260427183000_create_capability_invocations.sql`:

```sql
create table capability_invocations (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    span_id uuid references runtime_spans(id) on delete set null,
    capability_id text not null,
    requested_by_span_id uuid references runtime_spans(id) on delete set null,
    requester_kind text not null,
    arguments_ref text,
    authorization_status text not null,
    authorization_reason text,
    result_ref text,
    normalized_result jsonb,
    started_at timestamptz,
    finished_at timestamptz,
    error_payload jsonb,
    created_at timestamptz not null default now()
);

create index capability_invocations_flow_created_idx
    on capability_invocations (flow_run_id, created_at asc, id asc);
```

- [ ] **Step 3: Add domain record**

Append:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapabilityInvocationRecord {
    pub id: Uuid,
    pub flow_run_id: Uuid,
    pub span_id: Option<Uuid>,
    pub capability_id: String,
    pub requested_by_span_id: Option<Uuid>,
    pub requester_kind: String,
    pub arguments_ref: Option<String>,
    pub authorization_status: String,
    pub authorization_reason: Option<String>,
    pub result_ref: Option<String>,
    pub normalized_result: Option<serde_json::Value>,
    pub started_at: Option<OffsetDateTime>,
    pub finished_at: Option<OffsetDateTime>,
    pub error_payload: Option<serde_json::Value>,
    pub created_at: OffsetDateTime,
}
```

- [ ] **Step 4: Add capability runtime skeleton**

Create `api/crates/control-plane/src/capability_runtime.rs`:

```rust
#[derive(Debug, Clone)]
pub struct CapabilitySpec {
    pub id: String,
    pub kind: String,
    pub source: String,
    pub namespace: String,
    pub name: String,
    pub version: String,
    pub schema: serde_json::Value,
    pub result_schema: serde_json::Value,
    pub permissions: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct CapabilityResult {
    pub result_type: String,
    pub payload: serde_json::Value,
    pub artifact_ref: Option<String>,
}

pub fn host_tool_capability_id(name: &str) -> String {
    format!("host_tool:model:{name}@runtime")
}

pub fn mcp_tool_capability_id(server: &str, method: &str) -> String {
    format!("mcp_tool:mcp:{server}:{method}@runtime")
}
```

- [ ] **Step 5: Write invocation rows for tool/MCP commits**

In `append_provider_stream_events`, when provider emits `ToolCallCommit` or `McpCallCommit`, append a `capability_invocations` row with:

```text
requester_kind = model
authorization_status = requested
arguments_ref = runtime_artifact:inline:<event_id>
```

Also append a `capability_call_requested` runtime event with layer `capability`.

- [ ] **Step 6: Run tests**

Run:

```bash
cargo test -p control-plane tool_call_commit_creates_capability_invocation_request
cargo test -p storage-postgres migration_smoke
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/crates/domain/src/runtime_observability.rs api/crates/storage-durable/postgres/migrations/20260427183000_create_capability_invocations.sql api/crates/control-plane/src/ports/runtime.rs api/crates/control-plane/src/capability_runtime.rs api/crates/control-plane/src/orchestration_runtime/persistence.rs api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs
git commit -m "feat: record capability invocation requests"
```

### Task 4: Lock Skill MCP Workflow Approval Subagent Boundaries

**Files:**
- Modify: `api/crates/control-plane/src/capability_runtime.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`

- [ ] **Step 1: Write boundary tests**

Add:

```rust
#[test]
fn capability_ids_are_canonical_across_sources() {
    assert_eq!(
        control_plane::capability_runtime::host_tool_capability_id("search"),
        "host_tool:model:search@runtime"
    );
    assert_eq!(
        control_plane::capability_runtime::mcp_tool_capability_id("github", "create_issue"),
        "mcp_tool:mcp:github:create_issue@runtime"
    );
    assert_eq!(
        control_plane::capability_runtime::skill_action_capability_id("builtin", "coding", "review", "1"),
        "skill_action:builtin:coding:review@1"
    );
    assert_eq!(
        control_plane::capability_runtime::workflow_tool_capability_id("app-1", "flow-1", "3"),
        "workflow_tool:app-1:flow-1@3"
    );
}
```

- [ ] **Step 2: Implement canonical ID helpers**

Add to `api/crates/control-plane/src/capability_runtime.rs`:

```rust
pub fn skill_action_capability_id(source: &str, namespace: &str, name: &str, version: &str) -> String {
    format!("skill_action:{source}:{namespace}:{name}@{version}")
}

pub fn workflow_tool_capability_id(app_id: &str, flow_id: &str, version: &str) -> String {
    format!("workflow_tool:{app_id}:{flow_id}@{version}")
}

pub fn approval_capability_id(policy_id: &str, version: &str) -> String {
    format!("approval:policy:{policy_id}@{version}")
}

pub fn subagent_capability_id(agent_source: &str, agent_name: &str, version: &str) -> String {
    format!("system_agent:{agent_source}:{agent_name}@{version}")
}
```

- [ ] **Step 3: Document runtime boundary in code**

Add this doc comment above `CapabilitySpec`:

```rust
/// CapabilitySpec is a runtime identity, not a display label.
/// Provider plugins may request these IDs through model tool-call intent,
/// but only CapabilityRuntime may authorize and execute them.
```

- [ ] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane capability_ids_are_canonical_across_sources
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/crates/control-plane/src/capability_runtime.rs api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs
git commit -m "feat: define canonical capability identities"
```
