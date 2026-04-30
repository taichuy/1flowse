# Data Source Data Model Plan H Scope Provider QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the Data Model platform works in single-machine `DEFAULT_SCOPE_ID` mode and remains extensible for a future workspace HostExtension scope provider.

**Architecture:** This plan closes architecture gaps and runs QA. It should not add workspace UI; it defines and tests the minimal scope provider seam so future host plugins can supply current scope, membership, role, and grant UI.

**Tech Stack:** Rust backend workspace, plugin-framework/HostExtension contracts, frontend Settings smoke tests, qa-evaluation.

---

## File Structure

**Modify**
- `api/crates/domain/src/modeling.rs`: `DEFAULT_SCOPE_ID` and scope provider helper types.
- `api/crates/plugin-framework/src/scope_provider_contract.rs`: scope provider contribution contract.
- `api/crates/control-plane/src/model_definition.rs`: no workspace product dependency checks.
- `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`: single-machine scope regression.
- `docs/superpowers/specs/2026-04-29-data-source-data-model-runtime-crud-design.md`: only if implementation reveals a spec correction.
- `tmp/test-governance/`: warning/coverage artifacts only.

### Task 1: Scope Provider Seam

**Files:**
- Modify: `api/crates/plugin-framework/src/*`
- Modify: `api/crates/domain/src/modeling.rs`
- Test: relevant plugin-framework tests.

- [ ] **Step 1: Write failing contract tests**

The future HostExtension scope provider contract must describe:

```text
list scopes
resolve current scope
load membership/role
contribute grant UI metadata
extend actor context
```

Do not require workspace product routes or workspace UI.

- [ ] **Step 2: Implement minimal contract metadata**

Add the contract as manifest/contribution metadata only if not already covered by HostExtension plans. Avoid runtime implementation in this plan.

- [ ] **Step 3: Run plugin-framework tests**

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework scope
```

### Task 2: Single-Machine Scope Regression

**Files:**
- Modify: `api/apps/api-server/src/_tests/application/runtime_model_routes.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/runtime_record_repository_tests.rs`

- [ ] **Step 1: Write regression tests**

Cover:

```text
single-machine mode uses DEFAULT_SCOPE_ID
runtime query filters by scope_id without workspace UI
workspace_id is not required for dynamic runtime records
future scope provider can change actor.current_scope_id without changing table structure
```

- [ ] **Step 2: Fix any core assumptions**

Remove any new `workspace_id` dependency introduced by Plans A-G. Keep physical dynamic tables on `scope_id`.

- [ ] **Step 3: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p storage-postgres runtime_record_repository_tests
cargo test --manifest-path api/Cargo.toml -p api-server runtime_model_routes
```

### Task 3: End-To-End QA Gate

**Files:**
- Verify only.

- [ ] **Step 1: Use qa-evaluation**

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

- [ ] **Step 2: Backend regression**

Run:

```bash
cargo fmt --manifest-path api/Cargo.toml --check
cargo test --manifest-path api/Cargo.toml -p domain
cargo test --manifest-path api/Cargo.toml -p control-plane
cargo test --manifest-path api/Cargo.toml -p runtime-core
cargo test --manifest-path api/Cargo.toml -p storage-postgres
cargo test --manifest-path api/Cargo.toml -p api-server
```

If this is too slow locally, run the targeted failures first and record the skipped full gate explicitly in the QA report.

- [ ] **Step 3: Frontend regression**

Run:

```bash
pnpm --dir web lint
node scripts/node/test-frontend.js fast
node scripts/node/check-style-boundary.js page.settings
```

- [ ] **Step 4: Governance script**

Run:

```bash
node scripts/node/test-scripts.js
```

### Task 4: Plan Set Closeout

- [ ] **Step 1: Update index checkboxes**

Mark completed plans in [index](./2026-04-30-data-source-data-model-runtime-crud-index.md).

- [ ] **Step 2: Final status**

Run:

```bash
git status --short
```

Expected: only intended QA artifacts or docs are modified.

- [ ] **Step 3: Commit final QA updates**

```bash
git add docs/superpowers/plans tmp/test-governance
git commit -m "test: verify data model runtime crud plan set"
```
