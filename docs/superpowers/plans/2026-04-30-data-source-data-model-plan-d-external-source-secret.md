# Data Source Data Model Plan D External Source Secret Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let external PostgreSQL and REST data-source RuntimeExtensions back Data Models through the same platform CRUD, permission, secret, and audit layer.

**Architecture:** External data remains in the external source. Platform stores source instance config, secret references, catalog cache, Data Model mapping, and safety capability declarations; runtime CRUD dispatches to plugin adapters after platform permission checks.

**Tech Stack:** Rust, plugin-framework data source contract, plugin-runner host, control-plane data_source service, storage-durable PostgreSQL.

---

## File Structure

**Modify**
- `api/crates/plugin-framework/src/data_source_contract.rs`: CRUD, schema, and scope capability contract.
- `api/crates/control-plane/src/data_source.rs`: external source validation and catalog mapping.
- `api/crates/control-plane/src/ports/data_source.rs`: repository and plugin host ports.
- `api/crates/domain/src/data_source.rs`: external capability and secret reference domain types.
- `api/crates/runtime-core/src/runtime_record_repository.rs`: source-kind dispatch boundary.
- `api/apps/plugin-runner/src/data_source_host.rs`: contract wiring between plugin runner and data source host.
- `api/apps/api-server/src/routes/plugins_and_models/data_sources.rs`: console routes.
- `api/apps/api-server/src/_tests/data_sources_routes.rs`: route tests.

### Task 1: Secret Reference Boundary

**Files:**
- Modify: `api/crates/domain/src/data_source.rs`
- Modify: `api/crates/control-plane/src/data_source.rs`
- Modify: `api/crates/storage-durable/postgres/src/data_source_repository.rs`
- Test: `api/crates/control-plane/src/_tests/data_source_service_tests.rs`
- Test: `api/crates/storage-durable/postgres/src/_tests/data_source_repository_tests.rs`

- [x] **Step 1: Write failing tests**

Cover:

```text
source config stores secret_ref and secret_version only
secret value is never returned in console DTO
secret rotation updates version and audit event
audit payload never includes cleartext secret
```

- [x] **Step 2: Implement secret reference persistence**

Keep actual secret resolution behind a host secret resolver. Do not store connector tokens in Data Model metadata.

- [x] **Step 3: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests
cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests
```

Task 1 validation record, 2026-04-30:

- Red evidence: `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests` failed before implementation because `RotateDataSourceSecretCommand`, `secret_ref`, `secret_version`, and `get_secret_record` did not exist.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests`
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: Task 1 added data-source secret reference/version records, config secret extraction, console DTO reference output, and `data_source.secret_rotated` audit. It did not implement plugin CRUD contracts, external Data Model mapping, REST connector fixtures, or `unsafe_external_source`.

Task 1 spec review FAIL fix validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests` failed because `headers[].value` / `credentials.value` persisted cleartext and validate/preview returned runtime-echoed secret values.
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests::create_instance_requires_external_data_source_configure_permission_not_state_model_manage` failed because `state_model.manage.all` still authorized data-source instance creation.
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests` failed because `RotateDataSourceSecretInput` and repository `rotate_secret` did not exist.
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes` failed because route response still exposed `route-header-secret`; after adding the rotate route test, Axum rejected literal `secret:rotate` as an extra path parameter, so the production route was set to `/api/console/data-sources/instances/{instance_id}/secret/rotate`.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests`
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes`
  - `cargo test --manifest-path api/Cargo.toml -p api-server openapi_alignment`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: The fix added a session/CSRF protected console rotate route using existing `external_data_source.configure.*` permission, redacted exact stored secret string values from validate output and preview rows before response/session persistence, extracted `headers[].value` and `credentials.value` into data-source secret storage, and moved rotation version increments into repository SQL atomic upsert. Task 2 schema-aware config extraction remains the planned refinement for connector-specific shapes beyond these conservative generic guards.

Task 1 spec review FAIL follow-up validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests::validate_and_preview_redact_runtime_echoed_secret_values` failed because `data_source_preview_sessions.config_fingerprint` still contained the preview secret value.
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests::rotate_secret_increments_version_inside_repository_update -- --test-threads=1` failed to compile because `rotate_secret` only accepted secret-row input and returned only `DataSourceSecretRecord`, so the repository contract could not prove the returned instance config markers matched the secret row version.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests -- --test-threads=1`
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes -- --test-threads=1`
  - `cargo test --manifest-path api/Cargo.toml -p api-server openapi_alignment -- --test-threads=1`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- QA note: Preview sessions now persist a `sha256:` fingerprint over redacted preview input, not serialized secret JSON. Secret rotation now returns a repository-owned `RotateDataSourceSecretOutput` containing both the new secret row and the instance updated in the same PostgreSQL transaction after locking the instance row; service no longer performs a separate config-marker update after rotation.

### Task 2: Data Source Plugin CRUD Contract

**Files:**
- Modify: `api/crates/plugin-framework/src/data_source_contract.rs`
- Modify: `api/crates/control-plane/src/ports/data_source.rs`
- Test: `api/crates/plugin-framework/src/_tests/data_source_contract_tests.rs`
- Test: `api/crates/control-plane/src/_tests/data_source_service_tests.rs`

- [ ] **Step 1: Write failing contract tests**

Contract must describe:

```text
connectivity test
catalog/schema discovery
list/get/create/update/delete actions
filter/sort/pagination support declaration
owner_filter capability
scope_filter capability
write capability
transaction capability
```

- [ ] **Step 2: Implement contract structs**

Add explicit request/response DTOs for CRUD so runtime-core does not know plugin runner internals.

- [ ] **Step 3: Run contract tests**

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source
cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests
```

### Task 3: External Data Model Mapping And Safety

**Files:**
- Modify: `api/crates/control-plane/src/data_source.rs`
- Modify: `api/crates/control-plane/src/model_definition.rs`
- Modify: `api/crates/runtime-core/src/runtime_engine.rs`
- Test: `api/crates/control-plane/src/_tests/data_source_service_tests.rs`
- Test: `api/apps/api-server/src/_tests/data_sources_routes.rs`

- [ ] **Step 1: Write failing tests**

Cover:

```text
external resource maps into Data Model with source_kind external
external schema fields map into model fields
source missing owner/scope capability produces unsafe_external_source
unsafe external source cannot become api_exposed_ready
system_all risk grant requires explicit confirmation
```

- [ ] **Step 2: Implement mapping**

Persist:

```text
external_resource_key
external_field_key
source_kind
plugin capability snapshot
```

- [ ] **Step 3: Implement runtime dispatch**

Runtime CRUD must call a `RuntimeRecordBackend` abstraction:

```text
main_source => storage-postgres runtime_record_repository
external_source => data-source RuntimeExtension client
```

- [ ] **Step 4: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests
cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes runtime_model_routes
```

### Task 4: REST API Connector Rules

**Files:**
- Modify: `api/crates/plugin-framework/src/data_source_contract.rs`
- Modify: `api/plugins/templates/data_source_http_fixture/`: data-source fixture contract example.
- Test: `api/apps/api-server/src/_tests/data_sources_routes.rs`

- [ ] **Step 1: Add fixture tests**

Cover REST mapping requirements:

```text
list endpoint mapping
get endpoint mapping
create/update/delete mapping
response mapping
error mapping
header secret reference
```

- [ ] **Step 2: Implement fixture/contract support**

Keep REST plugin generic. Do not add REST-specific branches to core runtime CRUD.

- [ ] **Step 3: Run route tests**

```bash
cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes
```

### Task 5: Plan D Verification And Commit

- [ ] **Step 1: Format**

```bash
cargo fmt --manifest-path api/Cargo.toml
```

- [ ] **Step 2: Targeted regression**

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source
cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests model_definition_service_tests
cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes runtime_model_routes
```

- [ ] **Step 3: Commit**

```bash
git add api/crates/domain api/crates/plugin-framework api/crates/control-plane api/crates/runtime-core api/crates/storage-durable/postgres api/apps
git commit -m "feat: map external data sources to data models"
```
