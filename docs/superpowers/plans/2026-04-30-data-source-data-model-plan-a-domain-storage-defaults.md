[ACP read_text_file notice]
File is too large for a full ACP text read.
Request a smaller line/limit range.

Partial content:
# Data Source Data Model Plan A Domain Storage Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the Data Model status/exposure/default/scope-grant foundation that every later plan consumes.

**Architecture:** Extend domain types first, then repository traits, PostgreSQL migrations/mappers, and service commands. This plan does not expose new UI and does not implement API Key runtime access.

**Tech Stack:** Rust, sqlx PostgreSQL migrations, domain/control-plane/storage-durable crates, existing model-definition and data-source repositories.

---

## Source Documents

- `docs/superpowers/specs/2026-04-29-data-source-data-model-runtime-crud-design.md`
- `api/AGENTS.md`

## File Structure

**Modify**
- `api/crates/domain/src/modeling.rs`: Data Model status, API exposure status, protected owner metadata, scope grant domain records.
- `api/crates/domain/src/data_source.rs`: data source default status/exposure settings.
- `api/crates/control-plane/src/ports/model_definition.rs`: repository trait commands and query filters.
- `api/crates/control-plane/src/model_definition.rs`: create/update status/default inheritance rules.
- `api/crates/control-plane/src/data_source.rs`: data source default settings commands.
- `api/crates/storage-durable/postgres/migrations/20260430100000_data_model_status_exposure_defaults.sql`: schema changes.
- `api/crates/storage-durable/postgres/src/model_definition_repository/*`: persistence and mappers.
- `api/crates/storage-durable/postgres/src/data_source_repository.rs`: data source default settings persistence.
- `api/crates/storage-durable/postgres/src/_tests/model_definition_repository_tests.rs`: repository tests.
- `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`: service tests.

### Task 1: Domain Enums And Invariants

**Files:**
- Modify: `api/crates/domain/src/modeling.rs`
- Modify: `api/crates/domain/src/data_source.rs`

- [x] **Step 1: Add failing domain tests**

Add tests that assert:

```text
DataModelStatus values: draft, published, disabled, broken
ApiExposureStatus values: draft, published_not_exposed, api_exposed_no_permission, api_exposed_ready, unsafe_external_source
default published model => published_not_exposed exposure
draft model => draft exposure only
api_exposed_ready requires readiness inputs and is not directly selectable
```

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p domain modeling
```

Expected: fail because the new enums and helpers do not exist.

- [x] **Step 2: Implement domain types**

Add:

```text
DataModelStatus
ApiExposureStatus
DataModelOwnerKind
DataModelProtection
ScopeDataModelGrantRecord
DataSourceDefaults
```

Keep DB conversion helpers in domain as string mappings so PostgreSQL mappers do not hard-code product rules.

- [x] **Step 3: Add compatibility validator**

Implement one domain helper with this behavior:

```text
draft + draft => ok
published + published_not_exposed => ok
published + api_exposed_no_permission => ok
published + api_exposed_ready => ok only with readiness proof
published + unsafe_external_source => ok only for external source validation output
disabled/broken => runtime unavailable regardless of stored exposure
```

- [x] **Step 4: Verify domain tests pass**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p domain modeling
```

Expected: pass.

### Task 2: PostgreSQL Schema And Repository Mapping

**Files:**
- Create: `api/crates/storage-durable/postgres/migrations/20260430100000_data_model_status_exposure_defaults.sql`
- Modify: `api/crates/storage-durable/postgres/src/mappers/model_definition_mapper.rs`
- Modify: `api/crates/storage-durable/postgres/src/model_definition_repository/model_queries.rs`
- Modify: `api/crates/storage-durable/postgres/src/data_source_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/model_definition_repository_tests.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/data_source_repository_tests.rs`

- [x] **Step 1: Write failing repository tests**

Cover:

```text
data_source_instances has default_data_model_status and default_api_exposure_status
model_definitions has status, api_exposure_status, owner_kind, owner_id, is_protected
scope_data_model_grants persists scope_kind/scope_id/data_model_id/enabled/permission_profile
new main_source model defaults to published + published_not_exposed
duplicate code remains blocked inside the same data source
```

- [x] **Step 2: Add migration**

Migration must:

```sql
alter table data_source_instances add column if not exists default_data_model_status text not null default 'published';
alter table data_source_instances add column if not exists default_api_exposure_status text not null default 'published_not_exposed';
alter table model_definitions add column if not exists data_source_instance_id uuid null references data_source_instances(id);
alter table model_definitions add column if not exists status text not null default 'published';
alter table model_definitions add column if not exists api_exposure_status text not null default 'published_not_exposed';
alter table model_definitions add column if not exists owner_kind text not null default 'core';
alter table model_definitions add column if not exists owner_id text null;
alter table model_definitions add column if not exists is_protected boolean not null default false;
create table if not exists scope_data_model_grants (
  id uuid primary key,
  scope_kind text not null check (scope_kind in ('system', 'workspace')),
  scope_id uuid not null,
  data_model_id uuid not null references model_definitions(id) on delete cascade,
  enabled boolean not null default true,
  permission_profile text not null check (permission_profile in ('owner', 'scope_all', 'system_all')),
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_kind, scope_id, data_model_id)
);
```

Use explicit check constraints for enum strings and indexes for `(scope_kind, scope_id, data_model_id)`.

- [x] **Step 3: Update mappers and queries**

Map all new columns in create/list/get/update paths. Preserve existing physical table naming behavior.

- [x] **Step 4: Run storage tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres model_definition_repository_tests data_source_repository_tests
```

Expected: pass.

### Task 3: Control-Plane Defaults And Status Commands

**Files:**
- Modify: `api/crates/control-plane/src/ports/model_definition.rs`
- Modify: `api/crates/control-plane/src/ports/data_source.rs`
- Modify: `api/crates/control-plane/src/model_definition.rs`
- Modify: `api/crates/control-plane/src/data_source.rs`
- Modify: `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/data_source_service_tests.rs`

- [x] **Step 1: Write failing service tests**

Cover:

```text
create Data Model inherits data source defaults
main_source defaults are published + published_not_exposed
user can update Data Model status via command
draft status forces API exposure draft
published model cannot become api_exposed_ready
data source defaults can be updated through a dedicated command
invalid default/status/exposure combinations are rejected
```

- [x] **Step 2: Extend repository ports and commands**

Add explicit commands for:

```text
create/update Data Model status
compute exposure from status/default/readiness inputs
create/update/list scope Data Model grants
update data source default Data Model status and API exposure status
```

Keep status changes behind control-plane service commands; do not let route or storage code rewrite status rules directly.

- [x] **Step 3: Implement service behavior**

Implement:

```text
Data Model create inherits data source defaults
main_source default settings are published + published_not_exposed
draft status forces draft exposure
api_exposed_ready cannot be set directly without readiness proof
disabled/broken remain persisted states but runtime will be blocked by Plan B
```

- [x] **Step 4: Run control-plane tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests data_source_service_tests
```

Expected: pass.

### Task 4: Plan A Verification And Commit

- [x] **Step 1: Format**

```bash
cargo fmt --manifest-path api/Cargo.toml
```

- [x] **Step 2: Targeted regression**

```bash
cargo test --manifest-path api/Cargo.toml -p domain modeling
cargo test --manifest-path api/Cargo.toml -p storage-postgres model_definition_repository_tests data_source_repository_tests
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests data_source_service_tests
```

- [x] **Step 3: Update plan status**

Mark completed Plan A checkboxes in this document after implementation and verification evidence is available.

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-30-data-source-data-model-plan-a-domain-storage-defaults.md api/crates/domain api/crates/control-plane api/crates/storage-durable/postgres
git commit -m "feat: add data model status defaults"
```

## Verification Notes

- `cargo fmt --manifest-path api/Cargo.toml` could not run as written because `api/Cargo.toml` is a virtual workspace manifest; `cargo fmt --manifest-path api/Cargo.toml --all` passed.
- `cargo test --manifest-path api/Cargo.toml -p storage-postgres model_definition_repository_tests data_source_repository_tests` could not run as written because Cargo accepts one test filter; split runs for `model_definition_repository_tests` and `data_source_repository_tests` passed.
- `cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests data_source_service_tests` could not run as written because Cargo accepts one test filter; split runs for `model_definition_service_tests` and `data_source_service_tests` passed.
- `cargo test --manifest-path api/Cargo.toml -p domain modeling` passed.
- Reviewer gap fix: `20260430100000_data_model_status_exposure_defaults.sql` now drops the legacy `model_definitions_scope_kind_scope_id_code_key` constraint before adding the partial `(data_source_instance_id, code)` unique index. Added repository coverage proving duplicate codes are allowed across different data source instances in the same workspace while remaining blocked inside one data source.
- Reviewer gap fix: `main_source` Data Models use `data_source_instance_id = null`, so the migration now also adds `model_definitions_main_source_code_uidx` on `(code)` where `data_source_instance_id is null`. Added repository coverage proving duplicate `main_source`/null Data Model codes are blocked.
