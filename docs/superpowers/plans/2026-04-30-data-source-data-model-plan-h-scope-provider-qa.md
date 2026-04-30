# Data Source Data Model Plan H Scope Provider QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the Data Model platform works in single-machine `DEFAULT_SCOPE_ID` mode and remains extensible for a future workspace HostExtension scope provider.

**Architecture:** This plan closes architecture gaps and runs QA. It should not add workspace UI; it defines and tests the minimal scope provider seam so future host plugins can supply current scope, membership, role, and grant UI.

**Tech Stack:** Rust backend workspace, plugin-framework/HostExtension contracts, frontend Settings smoke tests, qa-evaluation.

---

## File Structure

**Modify**
- `api/crates/domain/src/scope.rs`: `DEFAULT_SCOPE_ID`.
- `api/crates/plugin-framework/src/scope_provider_contract.rs`: scope provider contribution contract.
- `api/crates/control-plane/src/model_definition.rs`: no workspace product dependency checks.
- `api/crates/storage-durable/postgres/src/auth_repository.rs`: root tenant default workspace ID.
- `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`: single-machine scope regression.
- `web/app/src/features/settings/pages/settings-page/SettingsDataModelsSection.tsx`: contextual message feedback remediation.
- `docs/superpowers/specs/2026-04-29-data-source-data-model-runtime-crud-design.md`: only if implementation reveals a spec correction.
- `tmp/test-governance/`: warning/coverage artifacts only.

### Task 1: Scope Provider Seam

**Files:**
- Modify: `api/crates/plugin-framework/src/*`
- Modify: `api/crates/domain/src/scope.rs`
- Test: relevant plugin-framework and domain scope tests.

- [x] **Step 1: Write failing contract tests**

The future HostExtension scope provider contract must describe:

```text
list scopes
resolve current scope
load membership/role
contribute grant UI metadata
extend actor context
```

Do not require workspace product routes or workspace UI.

- [x] **Step 2: Implement minimal contract metadata**

Add the contract as manifest/contribution metadata only if not already covered by HostExtension plans. Avoid runtime implementation in this plan.

- [x] **Step 3: Run plugin-framework tests**

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework scope
```

**Task 1 evidence:**
- RED: `cargo test --manifest-path api/Cargo.toml -p plugin-framework scope -- --test-threads=1` failed on missing `ScopeProviderCapability`, `HostContractCode::ScopeProvider`, and `scope_providers`.
- RED: `cargo test --manifest-path api/Cargo.toml -p domain scope -- --test-threads=1` failed on missing `DEFAULT_SCOPE_ID`.
- GREEN: `cargo fmt --manifest-path api/Cargo.toml --all` passed.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p plugin-framework scope -- --test-threads=1` passed, 7 passed.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p domain scope -- --test-threads=1` passed, 1 passed.
- GREEN: `git diff --check` passed.
- Boundary: metadata-only HostExtension contribution; no runtime implementation, workspace UI, route, or Plan C permission logic added.

### Task 2: Single-Machine Scope Regression

**Files:**
- Modify: `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/runtime_record_repository_tests.rs`

- [x] **Step 1: Write regression tests**

Cover:

```text
single-machine mode uses DEFAULT_SCOPE_ID
runtime query filters by scope_id without workspace UI
workspace_id is not required for dynamic runtime records
future scope provider can change actor.current_scope_id without changing table structure
```

- [x] **Step 2: Fix any core assumptions**

Remove any new `workspace_id` dependency introduced by Plans A-G. Keep physical dynamic tables on `scope_id`.

- [x] **Step 3: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres runtime_record_repository_tests
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes
```

**Task 2 evidence:**
- RED: `cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes_use_default_scope_id_for_workspace_model_crud -- --test-threads=1` failed before the core fix because the workspace grant scope was a random bootstrapped workspace id instead of `domain::DEFAULT_SCOPE_ID` (`left: 019de010-d1dd-75a1-b7c1-b21101e2c9f4`, `right: 00000000-0000-0000-0000-000000000001`).
- Repository baseline: `cargo test --manifest-path api/Cargo.toml -p storage-postgres runtime_record_repository_scopes_dynamic_rows_without_workspace_row -- --test-threads=1` passed before the core fix, confirming `storage-postgres` runtime records already filtered only by dynamic-table `scope_id` without a workspace row.
- GREEN: `cargo fmt --manifest-path api/Cargo.toml --all` passed.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p storage-postgres runtime_record_repository_tests -- --test-threads=1` passed, 5 passed.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes -- --test-threads=1` passed, 14 passed.
- GREEN: `git diff --check` passed.
- Boundary: dynamic runtime tables remain on `scope_id`; system metadata scope stays `SYSTEM_SCOPE_ID`; first root-tenant bootstrap workspace now uses `DEFAULT_SCOPE_ID` for single-machine business data scope. No Plan C API Key/permission exposure logic or frontend code changed.

### Task 3: End-To-End QA Gate

**Files:**
- Verify only.

- [x] **Step 1: Use qa-evaluation**

Read `qa-evaluation` and run a task-scoped QA report for:

```text
Data Model metadata/status/defaults
main_source runtime CRUD
API Key exposure and permissions
external source safety
Settings UI
orchestration node
scope provider seam
```

- [x] **Step 2: Backend regression**

Run:

```bash
cargo fmt --manifest-path api/Cargo.toml --all -- --check
cargo test --manifest-path api/Cargo.toml -p domain -- --test-threads=1
cargo test --manifest-path api/Cargo.toml -p control-plane -- --test-threads=1
cargo test --manifest-path api/Cargo.toml -p runtime-core -- --test-threads=1
cargo test --manifest-path api/Cargo.toml -p storage-postgres -- --test-threads=1
cargo test --manifest-path api/Cargo.toml -p api-server -- --test-threads=1
```

If this is too slow locally, run the targeted failures first and record the skipped full gate explicitly in the QA report.

- [x] **Step 3: Frontend regression**

Run:

```bash
pnpm --dir web lint
node scripts/node/test-frontend.js fast
node scripts/node/check-style-boundary.js page page.settings
```

- [x] **Step 4: Governance script**

Run:

```bash
node scripts/node/test-scripts.js
```

**Task 3 evidence:**
- qa-evaluation scope: Data Model metadata/status/defaults, `main_source` runtime CRUD, API Key exposure and permissions, external source safety, Settings UI, orchestration node, and scope provider seam.
- GREEN: `cargo fmt --manifest-path api/Cargo.toml --all -- --check` passed.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p domain -- --test-threads=1` passed, 15 tests.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p control-plane -- --test-threads=1` passed, 227 tests.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p runtime-core -- --test-threads=1` passed, 20 tests.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p storage-postgres -- --test-threads=1` passed, 84 tests.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p api-server -- --test-threads=1` passed, 166 unit tests and 5 integration tests.
- GREEN: `cargo test --manifest-path api/Cargo.toml -p plugin-framework scope -- --test-threads=1` passed, 7 tests.
- GREEN: `pnpm --dir web lint` passed, 9 tasks.
- GREEN: `node scripts/node/test-frontend.js fast` passed, 66 files and 260 tests.
- GREEN: `node scripts/node/check-style-boundary.js page page.settings` passed.
- GREEN: `node scripts/node/test-scripts.js` passed, 176 script tests.
- GREEN: `git diff --check` passed.
- Remediation RED: focused Settings Data Models Vitest passed but emitted AntD static `message` dynamic-theme warnings before switching to contextual `message.useMessage()`.
- Remediation GREEN: `scripts/node/exec-with-real-node.sh scripts/node/run-frontend-vitest.js run src/features/settings/_tests/data-models-page.test.tsx` passed, 7 tests, and the AntD static `message` warning was absent.
- Remediation GREEN: `node scripts/node/test-frontend.js fast`, `node scripts/node/check-style-boundary.js page page.settings`, `pnpm --dir web lint`, and `git diff --check` all passed after the contextual message fix.
- Boundary: Plan C API Key/permission/exposure behavior was not rewritten; existing API Key runtime route tests passed through the `api-server` gate.

### Task 4: Plan Set Closeout

- [x] **Step 1: Update index checkboxes**

Mark completed plans in [index](./2026-04-30-data-source-data-model-runtime-crud-index.md).

- [x] **Step 2: Final status**

Run:

```bash
git status --short
```

Expected: only intended Plan H implementation, Settings remediation, QA artifacts, or docs are modified.

- [x] **Step 3: Commit final QA updates**

```bash
git add api web docs/superpowers/plans tmp/test-governance
git commit -m "feat: complete data model scope provider qa"
```

**Task 4 evidence:**
- Index Plan H marked complete.
- Final `git status --short` before commit contained only Plan H implementation, Settings remediation, and plan/index documentation changes.
