# Model Catalog Routing Failover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把模型供应商目录、relay catalog sync、LLM 节点运行合同、固定模型/容灾队列、attempt ledger 和 `LlmNodeOutputs` 落成可审计模型路由主干。

**Architecture:** 模型供应商目录是 LLM 节点唯一模型来源；GatewayProviderPlugin 只同步 catalog，不直接成为节点选择对象。LLM 节点在 run start 冻结 fixed model 或 failover queue snapshot，每个 attempt 独立记录 request/response/usage/cost/error，成功后只通过 `LlmNodeOutputs` 写回 `VariablePool`。

**Tech Stack:** Rust 2021、SQLx/PostgreSQL、Serde、orchestration-runtime、control-plane、plugin-framework

---

## File Structure

- Modify: `api/crates/domain/src/model_provider.rs`
- Modify: `api/crates/domain/src/runtime_observability.rs`
- Modify: `api/crates/control-plane/src/ports/model_provider.rs`
- Modify: `api/crates/control-plane/src/model_provider.rs`
- Create: `api/crates/control-plane/src/model_provider/catalog_source.rs`
- Create: `api/crates/control-plane/src/model_provider/failover_queue.rs`
- Modify: `api/crates/orchestration-runtime/src/compiled_plan.rs`
- Modify: `api/crates/orchestration-runtime/src/execution_engine.rs`
- Modify: `api/crates/orchestration-runtime/src/compiler.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql`
- Modify: `api/crates/storage-durable/postgres/src/model_provider_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/orchestration_runtime_repository.rs`
- Create: `api/crates/control-plane/src/_tests/model_provider_failover_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`
- Modify: `api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs`

### Task 1: Add Model Catalog Source And Entry Tables

**Files:**
- Modify: `api/crates/domain/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/ports/model_provider.rs`
- Create: `api/crates/control-plane/src/model_provider/catalog_source.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql`
- Modify: `api/crates/storage-durable/postgres/src/model_provider_repository.rs`
- Create: `api/crates/control-plane/src/_tests/model_provider_failover_tests.rs`

- [x] **Step 1: Write failing catalog source test**

Create `api/crates/control-plane/src/_tests/model_provider_failover_tests.rs`:

```rust
#[tokio::test]
async fn relay_catalog_sync_imports_entries_as_model_provider_targets() {
    let harness = super::support::model_provider_harness().await;
    let source = harness.create_catalog_source("new-api", "relay_plugin").await;

    let run = harness.sync_catalog_models(
        source.id,
        serde_json::json!([
            {
                "upstream_model_id": "gpt-4.1",
                "display_label": "GPT 4.1",
                "protocol": "openai",
                "context_window": 1048576,
                "max_output_tokens": 32768,
                "pricing": { "input": "2.00", "output": "8.00" }
            }
        ]),
    ).await;

    let entries = harness.repository.list_catalog_entries(source.id).await.unwrap();

    assert_eq!(run.imported_count, 1);
    assert_eq!(entries[0].upstream_model_id, "gpt-4.1");
    assert_eq!(entries[0].protocol, "openai");
}
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p control-plane relay_catalog_sync_imports_entries_as_model_provider_targets
```

Expected: FAIL because catalog source tables and service methods do not exist.

- [x] **Step 3: Add domain records**

Append to `api/crates/domain/src/model_provider.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelProviderCatalogSourceRecord {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub source_kind: String,
    pub plugin_id: String,
    pub provider_code: String,
    pub display_name: String,
    pub base_url_ref: Option<String>,
    pub auth_secret_ref: Option<String>,
    pub protocol: String,
    pub status: String,
    pub last_sync_run_id: Option<Uuid>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelCatalogSyncRunRecord {
    pub id: Uuid,
    pub catalog_source_id: Uuid,
    pub status: String,
    pub error_message_ref: Option<String>,
    pub discovered_count: i64,
    pub imported_count: i64,
    pub disabled_count: i64,
    pub started_at: OffsetDateTime,
    pub finished_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelProviderCatalogEntryRecord {
    pub id: Uuid,
    pub provider_instance_id: Option<Uuid>,
    pub catalog_source_id: Uuid,
    pub upstream_model_id: String,
    pub display_label: String,
    pub protocol: String,
    pub capability_snapshot: serde_json::Value,
    pub parameter_schema_ref: Option<String>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
    pub pricing_ref: Option<String>,
    pub fetched_at: OffsetDateTime,
    pub status: String,
}
```

- [x] **Step 4: Add migration**

Append to `api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql`:

```sql
create table model_provider_catalog_sources (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    source_kind text not null,
    plugin_id text not null,
    provider_code text not null,
    display_name text not null,
    base_url_ref text,
    auth_secret_ref text,
    protocol text not null,
    status text not null,
    last_sync_run_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table model_catalog_sync_runs (
    id uuid primary key,
    catalog_source_id uuid not null references model_provider_catalog_sources(id) on delete cascade,
    status text not null,
    error_message_ref text,
    discovered_count bigint not null default 0,
    imported_count bigint not null default 0,
    disabled_count bigint not null default 0,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);

create table model_provider_catalog_entries (
    id uuid primary key,
    provider_instance_id uuid references model_provider_instances(id) on delete set null,
    catalog_source_id uuid not null references model_provider_catalog_sources(id) on delete cascade,
    upstream_model_id text not null,
    display_label text not null,
    protocol text not null,
    capability_snapshot jsonb not null default '{}'::jsonb,
    parameter_schema_ref text,
    context_window bigint,
    max_output_tokens bigint,
    pricing_ref text,
    fetched_at timestamptz not null default now(),
    status text not null,
    unique(catalog_source_id, upstream_model_id, protocol)
);
```

- [x] **Step 5: Add repository and service methods**

Add to `ModelProviderRepository`:

```rust
async fn create_catalog_source(&self, input: &CreateModelProviderCatalogSourceInput) -> anyhow::Result<domain::ModelProviderCatalogSourceRecord>;
async fn create_catalog_sync_run(&self, input: &CreateModelCatalogSyncRunInput) -> anyhow::Result<domain::ModelCatalogSyncRunRecord>;
async fn upsert_catalog_entry(&self, input: &UpsertModelProviderCatalogEntryInput) -> anyhow::Result<domain::ModelProviderCatalogEntryRecord>;
async fn list_catalog_entries(&self, catalog_source_id: Uuid) -> anyhow::Result<Vec<domain::ModelProviderCatalogEntryRecord>>;
```

Create `api/crates/control-plane/src/model_provider/catalog_source.rs` with:

```rust
pub fn normalize_relay_model_entry(raw: &serde_json::Value) -> anyhow::Result<UpsertModelProviderCatalogEntryInput> {
    let upstream_model_id = raw.get("upstream_model_id").and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("relay model is missing upstream_model_id"))?;
    let protocol = raw.get("protocol").and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("relay model is missing protocol"))?;
    Ok(UpsertModelProviderCatalogEntryInput {
        upstream_model_id: upstream_model_id.to_string(),
        protocol: protocol.to_string(),
        display_label: raw.get("display_label").and_then(serde_json::Value::as_str).unwrap_or(upstream_model_id).to_string(),
        capability_snapshot: raw.get("capability_snapshot").cloned().unwrap_or_else(|| serde_json::json!({})),
        context_window: raw.get("context_window").and_then(serde_json::Value::as_i64),
        max_output_tokens: raw.get("max_output_tokens").and_then(serde_json::Value::as_i64),
        pricing_ref: raw.get("pricing").map(|_| format!("runtime_artifact:pricing:{upstream_model_id}")),
    })
}
```

- [x] **Step 6: Run tests**

Run:

```bash
cargo test -p control-plane relay_catalog_sync_imports_entries_as_model_provider_targets
cargo test -p storage-postgres migration_smoke
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add api/crates/domain/src/model_provider.rs api/crates/control-plane/src/ports/model_provider.rs api/crates/control-plane/src/model_provider/catalog_source.rs api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql api/crates/storage-durable/postgres/src/model_provider_repository.rs api/crates/control-plane/src/_tests/model_provider_failover_tests.rs api/crates/control-plane/src/_tests/mod.rs
git commit -m "feat: add model provider catalog source"
```

### Task 2: Add Failover Queue Templates And Snapshots

**Files:**
- Modify: `api/crates/domain/src/model_provider.rs`
- Create: `api/crates/control-plane/src/model_provider/failover_queue.rs`
- Modify: `api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql`
- Modify: `api/crates/storage-durable/postgres/src/model_provider_repository.rs`
- Modify: `api/crates/control-plane/src/_tests/model_provider_failover_tests.rs`

- [x] **Step 1: Write failing queue snapshot test**

Add:

```rust
#[tokio::test]
async fn failover_queue_snapshot_freezes_order_for_run() {
    let harness = super::support::model_provider_harness().await;
    let queue = harness.create_failover_queue(vec![
        ("openai-prod-a", "openai", "gpt-4.1"),
        ("anthropic-main", "anthropic", "sonnet"),
    ]).await;

    let snapshot = harness.repository.create_failover_queue_snapshot(queue.id).await.unwrap();
    harness.reorder_failover_queue(queue.id, vec![
        ("anthropic-main", "anthropic", "sonnet"),
        ("openai-prod-a", "openai", "gpt-4.1"),
    ]).await;

    assert_eq!(snapshot.items[0].upstream_model_id, "gpt-4.1");
    assert_eq!(snapshot.items[1].upstream_model_id, "sonnet");
}
```

- [x] **Step 2: Add tables**

Append migration:

```sql
create table model_failover_queue_templates (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    name text not null,
    version bigint not null,
    status text not null,
    created_by uuid not null references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table model_failover_queue_items (
    id uuid primary key,
    queue_template_id uuid not null references model_failover_queue_templates(id) on delete cascade,
    sort_index integer not null,
    provider_instance_id uuid not null references model_provider_instances(id) on delete cascade,
    provider_code text not null,
    upstream_model_id text not null,
    protocol text not null,
    enabled boolean not null default true
);

create table model_failover_queue_snapshots (
    id uuid primary key,
    queue_template_id uuid not null references model_failover_queue_templates(id) on delete restrict,
    version bigint not null,
    items jsonb not null,
    created_at timestamptz not null default now()
);
```

- [x] **Step 3: Implement snapshot creation**

Create `api/crates/control-plane/src/model_provider/failover_queue.rs`:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FailoverQueueSnapshotItem {
    pub sort_index: i32,
    pub provider_instance_id: String,
    pub provider_code: String,
    pub upstream_model_id: String,
    pub protocol: String,
    pub enabled: bool,
}

pub fn freeze_queue_items(items: &[FailoverQueueSnapshotItem]) -> serde_json::Value {
    let mut ordered = items.to_vec();
    ordered.sort_by_key(|item| item.sort_index);
    serde_json::to_value(ordered).unwrap_or_else(|_| serde_json::json!([]))
}
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane failover_queue_snapshot_freezes_order_for_run
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/domain/src/model_provider.rs api/crates/control-plane/src/model_provider/failover_queue.rs api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql api/crates/storage-durable/postgres/src/model_provider_repository.rs api/crates/control-plane/src/_tests/model_provider_failover_tests.rs
git commit -m "feat: add model failover queue snapshots"
```

### Task 3: Add Attempt Ledger And LLM Node Outputs

**Files:**
- Modify: `api/crates/domain/src/runtime_observability.rs`
- Modify: `api/crates/orchestration-runtime/src/compiled_plan.rs`
- Modify: `api/crates/orchestration-runtime/src/execution_engine.rs`
- Modify: `api/crates/orchestration-runtime/src/compiler.rs`
- Modify: `api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs`
- Modify: `api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql`

- [x] **Step 1: Write failing LLM output test**

Add to `api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs`:

```rust
#[tokio::test]
async fn llm_node_outputs_include_hidden_route_projection_and_attempt_ids() {
    let output = run_llm_node_with_fixture_provider().await;

    assert_eq!(output.output_payload["text"], serde_json::json!("hello"));
    assert!(output.output_payload["__context_projection_id"].as_str().is_some());
    assert!(output.output_payload["__attempt_ids"].as_array().is_some());
    assert!(output.output_payload["__winner_attempt_id"].as_str().is_some());
}
```

- [x] **Step 2: Add attempt ledger table**

Append migration:

```sql
create table model_failover_attempt_ledger (
    id uuid primary key,
    flow_run_id uuid not null references flow_runs(id) on delete cascade,
    node_run_id uuid references node_runs(id) on delete cascade,
    llm_turn_span_id uuid references runtime_spans(id) on delete set null,
    queue_snapshot_id uuid references model_failover_queue_snapshots(id) on delete set null,
    attempt_index integer not null,
    provider_instance_id uuid,
    provider_code text not null,
    upstream_model_id text not null,
    protocol text not null,
    request_ref text,
    request_hash text,
    started_at timestamptz not null,
    first_token_at timestamptz,
    finished_at timestamptz,
    status text not null,
    failed_after_first_token boolean not null default false,
    upstream_request_id text,
    error_code text,
    error_message_ref text,
    usage_ledger_id uuid references runtime_usage_ledger(id) on delete set null,
    cost_ledger_id uuid,
    response_ref text
);
```

- [x] **Step 3: Extend compiled LLM runtime contract**

In `api/crates/orchestration-runtime/src/compiled_plan.rs`, add:

```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LlmRoutingMode {
    FixedModel,
    FailoverQueue,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct CompiledLlmRouting {
    pub routing_mode: LlmRoutingMode,
    pub fixed_model_target: Option<serde_json::Value>,
    pub queue_template_id: Option<String>,
    pub context_policy: serde_json::Value,
    pub stream_policy: serde_json::Value,
}
```

- [x] **Step 4: Write standard output object**

Modify `build_llm_output_payload` in `execution_engine.rs` so every LLM node writes:

```rust
json!({
    "text": final_content.unwrap_or_default(),
    "message": {
        "role": "assistant",
        "content": final_content.unwrap_or_default()
    },
    "structured_output": Value::Null,
    "tool_calls": result.tool_calls,
    "finish_reason": finish_reason,
    "route": {
        "routing_mode": "fixed_model",
        "provider_instance_id": runtime.provider_instance_id,
        "provider_code": runtime.provider_code,
        "upstream_model_id": runtime.model
    },
    "usage": serde_json::to_value(&result.usage).unwrap_or(Value::Null),
    "error": Value::Null,
    "__raw_response_ref": Value::Null,
    "__context_projection_id": Value::String("pending_projection_id".into()),
    "__attempt_ids": Value::Array(vec![]),
    "__winner_attempt_id": Value::Null
})
```

The placeholder string `pending_projection_id` is a temporary runtime value in code, not a plan placeholder; replace it in the same task when wiring real projection IDs from plan 03.

- [x] **Step 5: Run tests**

Run:

```bash
cargo test -p orchestration-runtime llm_node_outputs_include_hidden_route_projection_and_attempt_ids
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/crates/domain/src/runtime_observability.rs api/crates/orchestration-runtime/src/compiled_plan.rs api/crates/orchestration-runtime/src/execution_engine.rs api/crates/orchestration-runtime/src/compiler.rs api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs api/crates/storage-durable/postgres/migrations/20260427190000_create_model_catalog_routing_failover.sql
git commit -m "feat: add llm routing output contract"
```
