# Model Provider Enabled Models Backend And Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the backend single-model validation contract with instance-level `enabled_model_ids`, keep preview sessions only for candidate-cache reuse, and make runtime/model-option consumers read only the enabled-model list.

**Architecture:** Keep the write entry in `control-plane::model_provider`, not in routes or repositories. Add one forward-only PostgreSQL migration that swaps the instance table from `validation_model_id` to `enabled_model_ids`, then thread the new array contract through `domain`, `ports`, `storage-pg`, `api-server`, and the runtime option-selection path so every consumer sees the same truth.

**Tech Stack:** Rust (`domain`, `control-plane`, `storage-pg`, `api-server`), PostgreSQL migrations, `cargo test`

---

## File Structure

**Create**
- `api/crates/storage-pg/migrations/20260422180000_replace_validation_model_with_enabled_models.sql`

**Modify**
- `api/crates/domain/src/model_provider.rs`
- `api/crates/control-plane/src/model_provider.rs`
- `api/crates/control-plane/src/ports.rs`
- `api/crates/control-plane/src/orchestration_runtime.rs`
- `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`
- `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`
- `api/apps/api-server/src/routes/model_providers.rs`
- `api/apps/api-server/src/_tests/model_provider_routes.rs`
- `api/crates/storage-pg/src/mappers/model_provider_mapper.rs`
- `api/crates/storage-pg/src/model_provider_repository.rs`
- `api/crates/storage-pg/src/_tests/model_provider_repository_tests.rs`

**Notes**
- Do not edit the historical migration `20260422121000_add_model_provider_validation_and_preview_sessions.sql`; add a new migration instead.
- Keep `catalog_refresh_status`, `catalog_last_error_message`, and `model_count` as the candidate-cache surface.
- Remove `last_validated_at`, `last_validation_status`, and `last_validation_message` from the instance payload if they no longer carry product meaning after this refactor.

### Task 1: Replace Instance Storage With `enabled_model_ids`

**Files:**
- Create: `api/crates/storage-pg/migrations/20260422180000_replace_validation_model_with_enabled_models.sql`
- Modify: `api/crates/domain/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/storage-pg/src/mappers/model_provider_mapper.rs`
- Modify: `api/crates/storage-pg/src/model_provider_repository.rs`
- Modify: `api/crates/storage-pg/src/_tests/model_provider_repository_tests.rs`

- [ ] **Step 1: Write failing repository tests for the new array contract**
  - Add coverage that `create_instance` and `update_instance` round-trip:
    - `enabled_model_ids = []`
    - `enabled_model_ids = ["qwen-max", "qwen-plus"]`
  - Delete assertions that depend on `validation_model_id`, `last_validation_status`, or `last_validation_message`.

- [ ] **Step 2: Run the repository tests and verify RED**

Run:

```bash
cargo test -p storage-pg model_provider_repository -- --nocapture
```

Expected:

- FAIL because the repository input/output structs and SQL still reference `validation_model_id`.

- [ ] **Step 3: Add the forward-only migration and storage-model changes**
  - In `20260422180000_replace_validation_model_with_enabled_models.sql`:
    - add `enabled_model_ids text[] not null default '{}'::text[]`
    - backfill from `validation_model_id` into a single-element array only for the migration moment
    - drop `validation_model_id`
    - drop `last_validated_at`, `last_validation_status`, `last_validation_message`
  - Update `ModelProviderInstanceRecord`, repository input structs, mapper rows, and SQL binds/selects to use `enabled_model_ids`.

- [ ] **Step 4: Re-run the repository tests and verify GREEN**

Run:

```bash
cargo test -p storage-pg model_provider_repository -- --nocapture
```

Expected:

- PASS with the new `enabled_model_ids` assertions.

### Task 2: Rewrite Service Save Flow Around Candidate Cache Reuse

**Files:**
- Modify: `api/crates/control-plane/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`

- [ ] **Step 1: Write failing service tests for enabled-model save semantics**
  - Add service tests that prove:
    - create/update can save `enabled_model_ids = []`
    - create/update can save multiple `enabled_model_ids`
    - create/update can save IDs that are not present in candidate cache
    - saving with a `preview_token` reuses the preview session only to persist candidate cache
    - refresh failures do not clear existing `enabled_model_ids`

- [ ] **Step 2: Run the targeted control-plane tests and verify RED**

Run:

```bash
cargo test -p control-plane model_provider -- --nocapture
```

Expected:

- FAIL because `CreateModelProviderInstanceCommand`, `UpdateModelProviderInstanceCommand`, and `resolve_preview_state` still require `validation_model_id`.

- [ ] **Step 3: Replace validation-driven save logic with enabled-model normalization**
  - Change create/update commands to accept `enabled_model_ids: Vec<String>` and `preview_token: Option<Uuid>`.
  - Add a normalization helper in `model_provider.rs` that:
    - trims whitespace
    - drops empty strings
    - preserves first-seen order
    - removes duplicates
  - Replace `resolve_preview_state` with logic that:
    - validates `preview_token` only when present
    - verifies installation / instance / config fingerprint match
    - returns candidate-cache `models_json` for persistence
    - does not inspect a single selected model
  - Derive instance status as:
    - `Disabled` if the existing path says the instance is disabled
    - `Draft` if normalized `enabled_model_ids` is empty
    - `Ready` otherwise
  - Stop writing `last_validated_at`, `last_validation_status`, and `last_validation_message`.

- [ ] **Step 4: Re-run the targeted control-plane tests and verify GREEN**

Run:

```bash
cargo test -p control-plane model_provider -- --nocapture
```

Expected:

- PASS with the new enabled-model save semantics.

### Task 3: Update Route DTOs And Remove Validation-Specific API Shape

**Files:**
- Modify: `api/apps/api-server/src/routes/model_providers.rs`
- Modify: `api/apps/api-server/src/_tests/model_provider_routes.rs`

- [ ] **Step 1: Write failing route tests for the new request/response payloads**
  - Add route coverage that:
    - create/update accept `enabled_model_ids`
    - instance responses include `enabled_model_ids`
    - instance responses no longer require `validation_model_id`
    - preview-model requests still return `preview_token`
    - refresh-model requests update candidate cache without mutating `enabled_model_ids`

- [ ] **Step 2: Run the route tests and verify RED**

Run:

```bash
cargo test -p api-server model_provider_routes -- --nocapture
```

Expected:

- FAIL because route DTOs and JSON assertions still use `validation_model_id`.

- [ ] **Step 3: Rewrite the route contract and validation endpoint usage**
  - Replace `validation_model_id` fields in `CreateModelProviderBody`, `UpdateModelProviderBody`, and `ModelProviderInstanceResponse` with `enabled_model_ids`.
  - Keep `preview_token` parsing exactly for preview-session reuse.
  - Remove any response fields that only exist for validation history.
  - If the settings UI no longer needs `validate_instance`, delete the unused route wiring and its OpenAPI registration instead of preserving dead API surface.

- [ ] **Step 4: Re-run the route tests and verify GREEN**

Run:

```bash
cargo test -p api-server model_provider_routes -- --nocapture
```

Expected:

- PASS with the new JSON contract.

### Task 4: Make Runtime And Options Consumers Read Only Enabled Models

**Files:**
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`

- [ ] **Step 1: Add failing tests for downstream selection behavior**
  - Cover:
    - provider options only expose models from `enabled_model_ids`
    - if `enabled_model_ids` is empty, the instance contributes no selectable models
    - `allow_custom_models` is `false` for this path because only configured IDs are effective

- [ ] **Step 2: Run the targeted backend tests and verify RED**

Run:

```bash
cargo test -p control-plane orchestration_runtime -- --nocapture
```

Expected:

- FAIL because runtime selection still uses `validation_model_id.is_none()` to permit custom models.

- [ ] **Step 3: Replace runtime selection with enabled-model filtering**
  - Remove the `validation_model_id` check from `allow_custom_models`.
  - When building provider options, intersect candidate-cache/predefined models with `enabled_model_ids`.
  - Preserve manual IDs that are not present in cache by surfacing them as synthetic descriptors with `model_id == display_name`.

- [ ] **Step 4: Re-run the runtime and service tests and verify GREEN**

Run:

```bash
cargo test -p control-plane orchestration_runtime -- --nocapture
cargo test -p control-plane model_provider -- --nocapture
```

Expected:

- PASS with options/runtime now reading only enabled models.

### Task 5: Close Backend Slice With Focused Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-backend-and-runtime.md`

- [ ] **Step 1: Run the final backend verification set**

Run:

```bash
cargo test -p storage-pg model_provider_repository -- --nocapture
cargo test -p control-plane model_provider -- --nocapture
cargo test -p control-plane orchestration_runtime -- --nocapture
cargo test -p api-server model_provider_routes -- --nocapture
```

Expected:

- All four commands pass.

- [ ] **Step 2: Update this plan with actual verification output**
  - Append a `Verification Results` section with the exact command outcomes.

- [ ] **Step 3: Commit**

```bash
git add api/crates/domain/src/model_provider.rs \
  api/crates/control-plane/src/model_provider.rs \
  api/crates/control-plane/src/ports.rs \
  api/crates/control-plane/src/orchestration_runtime.rs \
  api/crates/control-plane/src/_tests/model_provider_service_tests.rs \
  api/crates/control-plane/src/_tests/plugin_management_service_tests.rs \
  api/apps/api-server/src/routes/model_providers.rs \
  api/apps/api-server/src/_tests/model_provider_routes.rs \
  api/crates/storage-pg/src/mappers/model_provider_mapper.rs \
  api/crates/storage-pg/src/model_provider_repository.rs \
  api/crates/storage-pg/src/_tests/model_provider_repository_tests.rs \
  api/crates/storage-pg/migrations/20260422180000_replace_validation_model_with_enabled_models.sql \
  docs/superpowers/plans/2026-04-22-model-provider-enabled-models-backend-and-runtime.md
git commit -m "refactor(model-providers): replace validation model with enabled models"
```

## Verification Results

- `cargo test -p storage-pg model_provider_repository -- --nocapture`
  - PASS, `2 passed; 0 failed`
- `cargo test -p control-plane model_provider -- --nocapture`
  - PASS, `11 passed; 0 failed`
- `cargo test -p control-plane orchestration_runtime -- --nocapture`
  - PASS, `6 passed; 0 failed`
- `cargo test -p api-server model_provider_routes -- --nocapture`
  - PASS, `6 passed; 0 failed`
