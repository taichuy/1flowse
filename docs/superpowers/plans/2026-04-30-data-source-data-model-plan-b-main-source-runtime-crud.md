# Data Source Data Model Plan B main_source Runtime CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `main_source` Data Models create physical runtime tables and expose scoped runtime CRUD only when model status allows it.

**Architecture:** Reuse the existing model-definition and runtime-model routes, but make status and `DEFAULT_SCOPE_ID` first-class gates. Runtime handlers remain generic; no per-table Rust handlers are generated.

**Tech Stack:** Rust, Axum, runtime-core, storage-postgres physical schema repository, runtime record repository.

---

## File Structure

**Modify**
- `api/crates/domain/src/modeling.rs`: runtime availability helpers.
- `api/crates/control-plane/src/model_definition.rs`: physical table creation/update behavior.
- `api/crates/storage-durable/postgres/src/physical_schema_repository.rs`: indexes and field deletion safety.
- `api/crates/runtime-core/src/runtime_model_registry.rs`: status-aware model registration.
- `api/crates/runtime-core/src/runtime_engine.rs`: runtime status checks.
- `api/apps/api-server/src/routes/plugins_and_models/runtime_models.rs`: error mapping.
- `api/apps/api-server/src/routes/plugins_and_models/model_definitions.rs`: create/update status route DTOs.
- `api/apps/api-server/src/_tests/application/model_definition_routes.rs`: integration tests.
- `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`: runtime CRUD tests.

### Task 1: Status-Gated Runtime Registry

**Files:**
- Modify: `api/crates/runtime-core/src/runtime_model_registry.rs`
- Modify: `api/crates/runtime-core/src/runtime_engine.rs`
- Test: `api/crates/runtime-core/src/_tests/runtime_model_registry_tests.rs`
- Test: `api/crates/runtime-core/src/_tests/runtime_engine_tests.rs`

- [ ] **Step 1: Write failing tests**

Cover:

```text
published model registers as runtime available
draft model is visible in metadata but blocked from CRUD
disabled model returns disabled error
broken model returns broken error
api_exposure_status does not by itself enable runtime CRUD
```

- [ ] **Step 2: Implement availability checks**

Add one runtime decision function:

```text
RuntimeDataModelAvailability::from_status(status)
```

Use it before list/get/create/update/delete dispatch.

- [ ] **Step 3: Run runtime-core tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_model_registry_tests runtime_engine_tests
```

Expected: pass.

### Task 2: main_source Physical Schema Rules

**Files:**
- Modify: `api/crates/storage-durable/postgres/src/physical_schema_repository.rs`
- Test: `api/crates/storage-durable/postgres/src/_tests/physical_schema_repository_tests.rs`

- [ ] **Step 1: Write failing tests**

Cover:

```text
new main_source table contains id, scope_id, created_by, updated_by, created_at, updated_at
indexes include (scope_id, created_at) and (scope_id, created_by)
physical table name and physical column name remain immutable
field delete drops only allowed dynamic columns
```

- [ ] **Step 2: Implement missing indexes and guards**

Keep `scope_id` as the only physical scope column. Do not add `workspace_id`, `team_id`, or `app_id`.

- [ ] **Step 3: Run storage tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres physical_schema_repository_tests
```

Expected: pass.

### Task 3: API Route Behavior

**Files:**
- Modify: `api/apps/api-server/src/routes/plugins_and_models/model_definitions.rs`
- Modify: `api/apps/api-server/src/routes/plugins_and_models/runtime_models.rs`
- Test: `api/apps/api-server/src/_tests/application/model_definition_routes.rs`
- Test: `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`

- [ ] **Step 1: Write failing route tests**

Cover:

```text
creating model without status returns published + published_not_exposed
creating model with draft blocks runtime CRUD
changing status to published enables runtime CRUD
changing status to disabled blocks runtime CRUD
runtime CRUD uses DEFAULT_SCOPE_ID in single-machine mode
```

- [ ] **Step 2: Add DTO fields**

Expose `status`, `api_exposure_status`, and effective runtime availability in console responses.

- [ ] **Step 3: Map runtime errors**

Map:

```text
draft => 409 model_not_published
disabled => 409 model_disabled
broken => 409 model_broken
missing grant => 403 data_model_scope_not_granted
```

- [ ] **Step 4: Run api-server route tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes runtime_model_routes
```

Expected: pass.

### Task 4: Plan B Verification And Commit

- [ ] **Step 1: Format**

```bash
cargo fmt --manifest-path api/Cargo.toml
```

- [ ] **Step 2: Targeted regression**

```bash
cargo test --manifest-path api/Cargo.toml -p runtime-core
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes runtime_model_routes openapi_alignment
```

- [ ] **Step 3: Commit**

```bash
git add api/crates/runtime-core api/crates/control-plane api/crates/storage-durable/postgres api/apps/api-server
git commit -m "feat: gate runtime crud by data model status"
```
