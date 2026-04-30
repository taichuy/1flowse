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

- [x] **Step 1: Write failing tests**

Cover:

```text
published model registers as runtime available
draft model is visible in metadata but blocked from CRUD
disabled model returns disabled error
broken model returns broken error
api_exposure_status does not by itself enable runtime CRUD
```

- [x] **Step 2: Implement availability checks**

Add one runtime decision function:

```text
RuntimeDataModelAvailability::from_status(status)
```

Use it before list/get/create/update/delete dispatch.

- [x] **Step 3: Run runtime-core tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_model_registry_tests runtime_engine_tests
```

Expected: pass.

Verification note: Cargo accepts one test filter, so Task 1 verification was split into:

```bash
cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_model_registry_tests
cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_engine_tests
```

Both passed after the red test run failed on the missing status-aware registry API and runtime error variants.

Plan B Task 1 production sync gap fix:

```bash
cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_model_registry_tests
cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_engine_tests
cargo test --manifest-path api/Cargo.toml -p storage-postgres runtime_registry_health_tests
```

The first red run failed because `ModelMetadata` had no `status` field. The fix makes `ModelMetadata` carry `DataModelStatus`, has `storage-postgres` preserve it in `list_runtime_model_metadata()`, and makes the production `RuntimeModelRegistry::rebuild(Vec<ModelMetadata>)` / `upsert(ModelMetadata)` derive runtime availability from `metadata.status` instead of defaulting every model to `Available`.

Plan B Task 1 relation expansion gap fix:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres runtime_record_repository_blocks_expanding_draft_relation_targets
```

The red run failed because `storage-postgres` expanded a published parent model's relation to a draft target model and returned the target record data. The fix reuses the runtime-core availability gate for relation target metadata by deriving `RuntimeDataModelAvailability::from_status(target_metadata.status)` before reading the target table, so draft / disabled / broken relation targets return controlled `RuntimeModelError` values instead of being expanded.

### Task 2: main_source Physical Schema Rules

**Files:**
- Modify: `api/crates/storage-durable/postgres/src/physical_schema_repository.rs`
- Test: `api/crates/storage-durable/postgres/src/_tests/physical_schema_repository_tests.rs`

- [x] **Step 1: Write failing tests**

Cover:

```text
new main_source table contains id, scope_id, created_by, updated_by, created_at, updated_at
indexes include (scope_id, created_at) and (scope_id, created_by)
physical table name and physical column name remain immutable
field delete drops only allowed dynamic columns
```

- [x] **Step 2: Implement missing indexes and guards**

Keep `scope_id` as the only physical scope column. Do not add `workspace_id`, `team_id`, or `app_id`.

- [x] **Step 3: Run storage tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres physical_schema_repository_tests
```

Expected: pass.

Verification notes:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres physical_schema_repository_tests
```

Red run failed as expected: `create_main_source_table_adds_platform_columns_and_scope_indexes` failed on missing `(scope_id, created_at)` index, and `delete_model_field_drops_dynamic_columns_but_rejects_platform_columns` failed because deleting a field mapped to `created_at` was not rejected.

```bash
cargo fmt --manifest-path api/Cargo.toml --all
cargo test --manifest-path api/Cargo.toml -p storage-postgres physical_schema_repository_tests
```

Final run passed: 7 passed, 0 failed.

Plan B Task 2 code quality feedback fix:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres physical_schema_repository_tests
```

Red run failed as expected: `create_main_source_table_adds_platform_columns_and_scope_indexes` failed because the scope index names did not include the full model UUID simple string, and `add_model_field_rejects_codes_that_sanitize_to_platform_columns_without_metadata` failed because `created-at` reached DDL and returned an uncontrolled error path.

The fix keeps existing FK / unique constraint naming unchanged, gives the new `(scope_id, created_at)` and `(scope_id, created_by)` indexes full model UUID suffixes, and rejects field codes whose sanitized physical column name is a platform runtime column before field metadata is inserted.

Green run passed: 8 passed, 0 failed.

### Task 3: API Route Behavior

**Files:**
- Modify: `api/apps/api-server/src/routes/plugins_and_models/model_definitions.rs`
- Modify: `api/apps/api-server/src/routes/plugins_and_models/runtime_models.rs`
- Test: `api/apps/api-server/src/_tests/application/model_definition_routes.rs`
- Test: `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`

- [x] **Step 1: Write failing route tests**

Cover:

```text
creating model without status returns published + published_not_exposed
creating model with draft blocks runtime CRUD
changing status to published enables runtime CRUD
changing status to disabled blocks runtime CRUD
changing status to broken blocks runtime CRUD
runtime CRUD uses DEFAULT_SCOPE_ID in single-machine mode
created-at field code returns field-specific 400 instead of broken metadata
```

Red run failed as expected:

```bash
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes
```

`model_definition_routes_manage_models_and_fields_without_publish` failed because `status` was missing from the create response. `runtime_model_routes_gate_crud_by_model_status_changes` failed because draft route input was ignored and runtime CRUD returned 200 instead of 409.

- [x] **Step 2: Add DTO fields**

Expose `status`, `api_exposure_status`, and effective runtime availability in console responses.

- [x] **Step 3: Map runtime errors**

Map:

```text
draft => 409 model_not_published
disabled => 409 model_disabled
broken => 409 model_broken
missing grant => 403 data_model_scope_not_granted when emitted by an existing path
```

- [x] **Step 4: Run api-server route tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes
```

Green runs passed after implementation:

```bash
cargo fmt --manifest-path api/Cargo.toml --all
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes
```

The route DTO now accepts optional create status and PATCH status while routing status changes through `update_model_status`. Console responses expose `status`, `api_exposure_status`, and status-derived `runtime_availability`. Runtime model status errors map to `model_not_published`, `model_disabled`, and `model_broken`; no Plan C grant path was implemented.

Plan B Task 3 code quality feedback fix:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane create_model_persists_explicit_draft_status_in_initial_create_path
cargo test --manifest-path api/Cargo.toml -p api-server create_model_route_persists_draft_status_atomically_without_manage_permission
cargo test --manifest-path api/Cargo.toml -p api-server create_model_route_rejects_invalid_status_without_creating_model
```

The red service run failed because `CreateModelDefinitionCommand` had no create-time status field. The route-level regression covered a user with `state_model.create.all` and `state_model.view.all` but no manage permission creating `status: draft`; the previous two-phase route would fail the second status update and leave a published model available to runtime. The fix adds optional create status to the create command, persists the final status in the initial `create_model_definition` call, normalizes `api_exposure_status` from that final status plus data source defaults, and keeps raw route `api_exposure_status: api_exposed_ready` ignored by the create DTO. Invalid create status returns `400 status` before create and list verification confirms no matching model was inserted.

Green verification for the feedback fix:

```bash
cargo fmt --manifest-path api/Cargo.toml --all
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes
```

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
