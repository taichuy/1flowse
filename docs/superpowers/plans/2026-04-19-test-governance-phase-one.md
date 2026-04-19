# Test Governance Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the first executable layer of the approved test governance model by adding formal `fast/full/runtime-gate` entrypoints, warning capture to `tmp/`, a pure backend test entrypoint, and service-level state transition guards for the first four backend state-machine objects.

**Architecture:** Keep command ownership in `scripts/node/*` so repository-level gates stay language-agnostic, then expose those scripts through existing README/package entrypoints instead of inventing a new root toolchain. For backend state consistency, add explicit transition guards in `control-plane` services, not in routes or repositories, so the stable business rules stay inside the existing write-entry boundary while PostgreSQL continues to enforce value-domain and relational invariants.

**Tech Stack:** Node.js CLI wrappers, `pnpm`/Turbo, Rust (`control-plane`, `domain`), `node:test`, `cargo test`, Markdown docs

---

## File Structure

**Create**
- `scripts/node/test-backend.js`
- `scripts/node/test-frontend.js`
- `scripts/node/runtime-gate.js`
- `scripts/node/testing/warning-capture.js`
- `scripts/node/test-backend/_tests/cli.test.js`
- `scripts/node/test-frontend/_tests/cli.test.js`
- `api/crates/control-plane/src/state_transition.rs`
- `api/crates/control-plane/src/_tests/state_transition_tests.rs`
- `docs/superpowers/plans/2026-04-19-test-governance-phase-one.md`

**Modify**
- `README.md`
- `web/package.json`
- `web/app/package.json`
- `scripts/node/verify-backend.js`
- `scripts/node/verify-backend/_tests/cli.test.js`
- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/model_provider.rs`
- `api/crates/control-plane/src/plugin_management.rs`
- `api/crates/control-plane/src/orchestration_runtime.rs`
- `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`
- `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`
- `api/crates/control-plane/src/_tests/orchestration_runtime_service_tests.rs`

**Notes**
- Warning output is evidence only in this phase; do not fail on warning text.
- Warning artifacts must be written under `tmp/test-governance/`.
- Do not move state validation into repositories or database triggers in this phase.

### Task 1: Add Formal Test Layer Entry Points

**Files:**
- Create: `scripts/node/test-backend.js`
- Create: `scripts/node/test-frontend.js`
- Create: `scripts/node/runtime-gate.js`
- Create: `scripts/node/testing/warning-capture.js`
- Create: `scripts/node/test-backend/_tests/cli.test.js`
- Create: `scripts/node/test-frontend/_tests/cli.test.js`
- Modify: `scripts/node/verify-backend.js`
- Modify: `scripts/node/verify-backend/_tests/cli.test.js`
- Modify: `README.md`
- Modify: `web/package.json`
- Modify: `web/app/package.json`

- [x] **Step 1: Write failing CLI tests for the new wrappers and warning capture**
- [x] **Step 2: Run the targeted `node:test` commands and verify RED**
- [x] **Step 3: Implement `warning-capture` and the three repository-level wrappers**
- [x] **Step 4: Wire formal `fast/full/runtime-gate` scripts into docs and package entrypoints**
- [x] **Step 5: Re-run targeted CLI tests and verify GREEN**

### Task 2: Add Shared Backend State Transition Guards

**Files:**
- Create: `api/crates/control-plane/src/state_transition.rs`
- Create: `api/crates/control-plane/src/_tests/state_transition_tests.rs`
- Modify: `api/crates/control-plane/src/lib.rs`

- [x] **Step 1: Write failing transition-matrix tests for `flow_run`, `node_run`, `model_provider_instance`, and `plugin_task`**
- [x] **Step 2: Run the targeted Rust test module and verify RED**
- [x] **Step 3: Implement the explicit transition guard helpers with action-aware error messages**
- [x] **Step 4: Re-run the targeted Rust test module and verify GREEN**

### Task 3: Enforce Guards In Service Write Paths

**Files:**
- Modify: `api/crates/control-plane/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/plugin_management.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime_service_tests.rs`

- [x] **Step 1: Add failing service tests for representative illegal transitions**
- [x] **Step 2: Run targeted Rust service tests and verify RED**
- [x] **Step 3: Thread the shared transition guards through the service write paths**
- [x] **Step 4: Re-run targeted Rust service tests and verify GREEN**

### Task 4: Close Out With Focused Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-test-governance-phase-one.md`

- [x] **Step 1: Run fresh targeted script tests**
- [x] **Step 2: Run fresh targeted Rust tests for the new state transition coverage**
- [x] **Step 3: Run the new full-gate wrappers to validate command shape and warning output paths**
- [x] **Step 4: Update this plan with actual verification results**
- [ ] **Step 5: Commit**

## Verification Results

- `node --test scripts/node/test-backend/_tests/cli.test.js scripts/node/test-frontend/_tests/cli.test.js scripts/node/runtime-gate/_tests/cli.test.js scripts/node/verify-backend/_tests/cli.test.js` → `8` tests passed.
- `cargo test -p control-plane state_transition --lib` → `5` state transition tests passed.
- `cargo test -p control-plane model_provider_service_rejects_validating_disabled_instance --lib` → passed.
- `cargo test -p control-plane plugin_management_service_rejects_restarting_terminal_task --lib` → passed.
- `cargo test -p control-plane resume_flow_run_rejects_terminal_flow_status_transition --lib` → passed.
- `cargo test -p control-plane model_provider_service --lib` → `3` tests passed.
- `cargo test -p control-plane plugin_management_service --lib` → `11` tests passed.
- `cargo test -p control-plane orchestration_runtime --lib` → `5` tests passed.
- `node scripts/node/test-backend.js` → backend pure test wrapper passed across workspace crates/apps/tests.
- `node scripts/node/test-frontend.js fast` → `49` files、`176` tests全部通过；warning 已写入 `tmp/test-governance/test-frontend-fast.warnings.log`。
