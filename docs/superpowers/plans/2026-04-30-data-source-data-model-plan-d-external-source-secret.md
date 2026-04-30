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

Task 1 spec review FAIL second follow-up validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane validate_preview_and_catalog_redact_embedded_secret_substrings` failed because validate output still contained `embedded-secret-value` inside `Bearer embedded-secret-value`.
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_source_routes_create_validate_preview_and_catalog -- --test-threads=1` failed because the validate route response still contained `route-secret-echo` inside runtime-echoed output/catalog data.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests -- --test-threads=1`
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes -- --test-threads=1`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- QA note: Runtime `discover_catalog` output is now recursively redacted before contract parsing, catalog cache upsert, and validate response mapping. Recursive redaction now replaces stored secret substrings inside string values, so validate output, preview rows/cursor, and catalog JSON redact shapes like `Bearer <secret>` to `Bearer ***` while preserving prior exact-value behavior.

Task 1 code quality REQUEST_CHANGES validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests` failed because `X-Trace: not-secret` was extracted from `headers[].value` and partial secret rotation dropped existing `__config_secret_values`.
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests -- --test-threads=1` failed because repository `rotate_secret` overwrote existing config marker secret values with the partial payload.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres data_source_repository_tests -- --test-threads=1`
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes -- --test-threads=1`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- QA note: Header config extraction now only treats secret-bearing header names as secret (`Authorization`, `Proxy-Authorization`, `X-API-Key`, `Api-Key`, `X-Auth-Token`, `Cookie`). Secret rotation now merges the incoming explicit payload with existing `__config_secret_values`, preserving marker resolver inputs unless a marker path is explicitly replaced.

### Task 2: Data Source Plugin CRUD Contract

**Files:**
- Modify: `api/crates/plugin-framework/src/data_source_contract.rs`
- Modify: `api/crates/control-plane/src/ports/data_source.rs`
- Test: `api/crates/plugin-framework/src/_tests/data_source_contract_tests.rs`
- Test: `api/crates/control-plane/src/_tests/data_source_service_tests.rs`

- [x] **Step 1: Write failing contract tests**

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

- [x] **Step 2: Implement contract structs**

Add explicit request/response DTOs for CRUD so runtime-core does not know plugin runner internals.

- [x] **Step 3: Run contract tests**

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source
cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests
```

Task 2 validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source` failed before implementation because `DataSourceCrudCapabilities`, CRUD DTOs, `DataSourceResourceDescriptor.capabilities`, and `ListRecords/GetRecord/CreateRecord/UpdateRecord/DeleteRecord` stdio methods did not exist.
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests` failed before implementation because CRUD DTOs and `DataSourceCrudRuntimePort` did not exist.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: Task 2 defines and tests the data-source RuntimeExtension CRUD contract, capability declarations, owner/scope context, transaction identifiers on write DTOs, and a control-plane CRUD runtime port. It does not implement external Data Model mapping, runtime-core dispatch, REST fixture behavior, or `unsafe_external_source` readiness.

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

Task 3a validation record, 2026-04-30:

- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p domain modeling_tests`
  - `cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres model_definition_repository_tests -- --test-threads=1`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: Task 3a only completes the repository/storage metadata mapping slice. `source_kind`, `external_resource_key`, and `external_field_key` are persisted and reloaded, and external-source Data Model create/add/delete storage paths skip local runtime table/column/relation DDL. It also documents `supports_transactions` / `transaction_id` semantics and adds get/create/update data-source DTO JSON shape tests.
- Remaining Task 3 scope: service/API/catalog mapping is still incomplete, including `CreateModelDefinitionCommand.external_resource_key`, `AddModelFieldCommand.external_field_key`, console route/data-source catalog mapping, plugin capability snapshot persistence, `unsafe_external_source` readiness, `system_all` explicit confirmation, runtime CRUD dispatch through `RuntimeRecordBackend`, and REST connector fixture behavior. This Task 3a record must not be read as complete Task 3 external Data Model mapping.

Task 3a-2a validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane external_` failed before implementation because `CreateModelDefinitionCommand.external_resource_key` and `AddModelFieldCommand.external_field_key` did not exist.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: Task 3a-2a only completes service/API external mapping input and validation. Console model create accepts `data_source_instance_id` and `external_resource_key`; console field create accepts `external_field_key`; model/field responses expose source and external mapping keys. External-source model create requires a non-empty `external_resource_key`, external-source field create requires a non-empty `external_field_key`, and main-source model/field create reject external keys. Task 3a-2b still owns data-source catalog/describe-resource mapping, plugin capability snapshot persistence, `unsafe_external_source` readiness, and explicit `system_all` confirmation. Runtime CRUD dispatch remains Task 3b; REST fixture remains Task 4.

Task 3a-2b narrowed validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests` failed before implementation because `ModelDefinitionRecord.external_capability_snapshot` and `CreateModelDefinitionInput.external_capability_snapshot` did not exist, and external-source readiness did not derive `unsafe_external_source` from missing scope-filter capability.
- Green evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p storage-postgres model_definition_repository_deletes_external_source_field_without_local_ddl -- --test-threads=1`
  - Full task-agent verification pending below for the final commit.
- Scope note: This narrowed 3a-2b slice persists `external_capability_snapshot` on Data Model records and makes effective API exposure return `unsafe_external_source` for external-source models that lack `supports_scope_filter`; `main_source` readiness remains unchanged. Data-source catalog/describe-resource mapping and explicit `system_all` risk confirmation are still follow-up 3a-2b sub-slices. Runtime CRUD dispatch remains Task 3b; REST fixture remains Task 4.

Task 3a-2b-2 explicit confirmation validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests::unsafe_external_system_all_scope_grant_requires_explicit_confirmation` failed before implementation because `CreateScopeDataModelGrantCommand` and `UpdateScopeDataModelGrantCommand` had no explicit unsafe external `system_all` confirmation field.
- Green evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_acl_tests`
  - `cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes`
- Scope note: This slice completes explicit confirmation for creating or updating `system_all` grants on unsafe external-source Data Models through control-plane commands and console route DTOs. `main_source` Data Models and safe external-source Data Models do not require the confirmation. Data-source catalog/describe-resource mapping is deferred to the next 3a-2b slice. Runtime CRUD dispatch remains Task 3b; REST fixture remains Task 4.

Task 3a-2b-2 confirmation quality fix validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane unsafe_external_workspace_scope_system_all_grant_requires_explicit_confirmation` failed because a workspace-scoped unsafe external `system_all` grant was created without `confirm_unsafe_external_source_system_all`.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: The explicit confirmation applies to any `system_all` grant profile on an unsafe external-source target model, regardless of the grant `scope_kind` or `scope_id`. `main_source` models and safe external-source models with `supports_scope_filter: true` remain exempt. Route coverage stays on the existing route path because the route only forwards the confirmation flag and scope fields to the service; the service tests cover the workspace-scope distinction.

Task 3a-2b catalog mapping validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests` failed before implementation because `MapDataSourceResourceToModelCommand`, `DataSourceService::map_resource_to_model`, and `DataSourceRuntimePort::describe_resource` did not exist.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests`
  - `cargo test --manifest-path api/Cargo.toml -p api-server data_sources_routes`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: This slice adds the control-plane service entrypoint that maps a data-source instance `resource_key` through runtime `describe_resource` into an external-source Data Model and fields. It persists `data_source_instance_id`, `source_kind=external_source`, `external_resource_key`, per-field `external_field_key`, and `external_capability_snapshot`, using stored config/secret while keeping audit payloads secret-free. No console route was added in this slice; a data-sources route such as map resource to model remains follow-up. Runtime CRUD dispatch remains Task 3b; REST fixture remains Task 4.

Task 3a-2b catalog mapping secret-redaction fix validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane map_resource_to_model_redacts_descriptor_secret_echoes_before_mapping` failed because descriptor `metadata.display_name` containing `descriptor-secret-substring` was used directly as the mapped Data Model title.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p control-plane data_source_service_tests`
  - `cargo check --manifest-path api/Cargo.toml -p api-server`
  - `git diff --check`
- Scope note: `map_resource_to_model` now recursively redacts `describe_resource` descriptor output with stored secret string values before deriving Data Model title, external resource key, fields, field display options, and audit payload. The runtime still receives the original stored config and secret input. Console route/runtime dispatch/REST fixture remain outside this fix.

Task 3b runtime-core dispatch slice validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core external_source_runtime_crud_dispatches_to_data_source_backend_after_acl_scope_resolution` failed before implementation because `DataSourceRuntimeRecordBackend` did not exist.
- Green evidence:
  - `cargo fmt --manifest-path api/Cargo.toml --all`
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_engine_tests`
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_acl_tests`
- Scope note: This narrowed Task 3b slice adds the runtime-core source-kind dispatch abstraction and fake-backend coverage for external-source list/get/create/update/delete after runtime ACL scope resolution. It maps runtime filters, sorts, pagination, expand options, payload, record id, owner context, and scope context into the data-source CRUD DTOs, and keeps main-source CRUD on the existing `RuntimeRecordRepository`. Api-server/plugin-runner host wiring remains the next Task 3b slice. REST connector fixture behavior remains Task 4.

Task 3b runtime-core field mapping quality fix validation record, 2026-04-30:

- Red evidence:
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_engine_tests` failed after adding field mapping assertions because external-source list returned `contact_email/display_name/external_only` instead of Data Model field codes, and unknown create payload still reached the fake backend.
- Green evidence:
  - `cargo test --manifest-path api/Cargo.toml -p runtime-core runtime_engine_tests`
- Scope note: This quality fix keeps the Task 3b scope narrowed to runtime-core. External-source filters, sorts, create payloads, and update patches now accept declared Data Model field codes plus platform runtime fields only, then map declared fields to `external_field_key` before calling the data-source backend. External list/get/create/update responses map external keys back to Data Model field codes, preserve platform runtime fields such as `id` and `created_by`, and drop external-only unknown keys. Host wiring and REST fixture behavior remain outside this fix.

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
