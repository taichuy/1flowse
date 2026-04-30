# Data Source Data Model Plan G Orchestration Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic orchestration Data Model node that performs list/get/create/update/delete through runtime CRUD.

**Architecture:** The node consumes Data Model metadata and runtime CRUD APIs; it never calls SQL, storage repositories, or external source plugins directly. Workflow actor permissions determine what the node can access.

**Tech Stack:** Rust orchestration-runtime/control-plane, React agent-flow node definitions, schema UI adapters, runtime execution logs.

---

## File Structure

**Modify**
- `api/crates/domain/src/orchestration.rs`: node config contract if backend validates node type.
- `api/crates/control-plane/src/orchestration_runtime/*`: execution binding and runtime call.
- `api/crates/control-plane/src/_tests/orchestration_runtime/*`: runtime tests.
- `web/app/src/features/agent-flow/lib/node-definitions/nodes/*`: Data Model node definition.
- `web/app/src/features/agent-flow/schema/node-schema-registry.ts`: schema registration.
- `web/app/src/features/agent-flow/api/data-model-options.ts`: Data Model metadata options.
- `web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx`: schema tests.

### Task 1: Backend Runtime Binding

**Files:**
- Modify: `api/crates/control-plane/src/orchestration_runtime/compile_context.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`
- Test: `api/crates/control-plane/src/_tests/orchestration_runtime/service.rs`

- [ ] **Step 1: Write failing backend tests**

Cover:

```text
Data Model node compiles with data_model_code and action
list action calls runtime CRUD list
get action requires record_id
create/update action validates payload object
delete action returns deletion result
permission denied is recorded as node error
```

- [ ] **Step 2: Implement runtime adapter**

Add an internal adapter:

```text
WorkflowDataModelRuntime
  list(model_code, query)
  get(model_code, record_id)
  create(model_code, payload)
  update(model_code, record_id, payload)
  delete(model_code, record_id)
```

The adapter must reuse runtime-core authorization and actor context.

- [ ] **Step 3: Run backend tests**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane orchestration_runtime
```

### Task 2: Frontend Node Definition

**Files:**
- Create: `web/app/src/features/agent-flow/lib/node-definitions/nodes/data-model.ts`
- Modify: `web/app/src/features/agent-flow/lib/node-definitions/index.ts`
- Modify: `web/app/src/features/agent-flow/schema/node-schema-registry.ts`
- Test: `web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Cover:

```text
node picker includes Data Model node
schema shows Data Model selector
action selector contains list/get/create/update/delete
record_id field appears only for get/update/delete
payload editor appears for create/update
```

- [ ] **Step 2: Implement node definition**

Use existing node definition patterns. Add output contracts:

```text
list => records, total
get => record
create => record
update => record
delete => deleted_id
```

- [ ] **Step 3: Run frontend tests**

```bash
node scripts/node/test-frontend.js fast
```

### Task 3: Dynamic Schema Loading

**Files:**
- Create or modify: `web/app/src/features/agent-flow/api/data-model-options.ts`
- Modify: `web/app/src/features/agent-flow/components/inspector/use-node-schema-runtime.ts`
- Test: `web/app/src/features/agent-flow/_tests/node-inspector.test.tsx`

- [ ] **Step 1: Write failing tests**

Cover:

```text
Data Model options load from API
field schema updates when selected model changes
unpublished/disabled/broken models show disabled option state
```

- [ ] **Step 2: Implement query wrapper and schema runtime hook**

Keep query code under `features/agent-flow/api`; do not call `@1flowbase/api-client` directly from components.

- [ ] **Step 3: Run tests**

```bash
node scripts/node/test-frontend.js fast
```

### Task 4: Plan G Verification And Commit

- [ ] **Step 1: Format and test**

```bash
cargo fmt --manifest-path api/Cargo.toml
cargo test --manifest-path api/Cargo.toml -p control-plane orchestration_runtime
node scripts/node/test-frontend.js fast
```

- [ ] **Step 2: Commit**

```bash
git add api/crates/domain api/crates/control-plane web/app/src/features/agent-flow
git commit -m "feat: add orchestration data model node"
```
