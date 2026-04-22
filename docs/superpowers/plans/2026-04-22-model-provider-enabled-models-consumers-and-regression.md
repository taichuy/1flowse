# Model Provider Enabled Models Consumers And Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align shared consumers with the enabled-model contract, prove that only configured model IDs flow into downstream selectors, and close the feature with focused backend/frontend regression.

**Architecture:** Keep downstream alignment narrow: update only the shared fixtures, agent-flow consumer helpers, and style-boundary scenes that directly depend on model-provider option shapes. Use the backend options payload as the single truth, then close the feature with focused regression instead of a repo-wide full gate.

**Tech Stack:** TypeScript, React, Vitest, Rust regression commands, Markdown plan updates

---

## File Structure

**Modify**
- `web/app/src/features/agent-flow/api/model-provider-options.ts`
- `web/app/src/features/agent-flow/lib/model-options.ts`
- `web/app/src/features/agent-flow/_tests/validate-document.test.ts`
- `web/app/src/style-boundary/registry.tsx`
- `web/app/src/style-boundary/_tests/registry.test.tsx`
- `web/app/src/test/model-provider-contract-fixtures.ts`
- `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-backend-and-runtime.md`
- `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-settings-ui.md`
- `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-consumers-and-regression.md`

**Notes**
- Do not invent a parallel contract fixture set. Update the shared model-provider fixture source already used by settings, style-boundary, and agent-flow.
- This phase should not reopen backend contract design; if a payload mismatch appears here, fix it at the shared fixture or consumer adapter level first.

### Task 1: Update Shared Fixtures And Consumer Assumptions

**Files:**
- Modify: `web/app/src/test/model-provider-contract-fixtures.ts`
- Modify: `web/app/src/style-boundary/registry.tsx`
- Modify: `web/app/src/style-boundary/_tests/registry.test.tsx`
- Modify: `web/app/src/features/agent-flow/_tests/validate-document.test.ts`

- [ ] **Step 1: Write failing consumer tests against the enabled-model contract**
  - Lock fixture expectations to:
    - instance payloads expose `enabled_model_ids`
    - options payloads only expose enabled models
    - no validation-history fields are required by tests or scenes

- [ ] **Step 2: Run the focused consumer tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- \
  src/style-boundary/_tests/registry.test.tsx \
  src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- FAIL because the shared fixtures and assertions still assume validation-model metadata.

- [ ] **Step 3: Rewrite shared fixtures and mock render data**
  - Update `model-provider-contract-fixtures.ts` to expose the new instance/options shape.
  - In style-boundary and agent-flow tests, remove validation-history assertions and replace them with enabled-model assertions.
  - Keep fixture labels realistic; do not insert debug strings or placeholder model IDs.

- [ ] **Step 4: Re-run the focused consumer tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- \
  src/style-boundary/_tests/registry.test.tsx \
  src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- PASS with the shared fixture source updated.

### Task 2: Confirm Downstream Model Options Only Surface Enabled Models

**Files:**
- Modify: `web/app/src/features/agent-flow/api/model-provider-options.ts`
- Modify: `web/app/src/features/agent-flow/lib/model-options.ts`
- Modify: `web/app/src/features/agent-flow/_tests/validate-document.test.ts`

- [ ] **Step 1: Add failing agent-flow tests for the new selection semantics**
  - Cover:
    - only `enabled_model_ids` appear in mapped options
    - manual enabled IDs that are not in cache still appear as selectable options
    - no “custom model allowed” shortcut bypasses the enabled-model list

- [ ] **Step 2: Run the focused agent-flow tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- FAIL until the mapping helpers stop assuming validation-driven custom model behavior.

- [ ] **Step 3: Update consumer mapping logic**
  - Keep `AgentFlowModelProviderOptions` as the shared backend DTO.
  - In `model-options.ts`, map only the backend-provided `models` list and do not synthesize extra “custom” allowance from missing validation data.

- [ ] **Step 4: Re-run the focused agent-flow tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- PASS with downstream selectors now obeying enabled-model truth.

### Task 3: Close The Feature With Cross-Slice Regression

**Files:**
- Modify: `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-backend-and-runtime.md`
- Modify: `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-settings-ui.md`
- Modify: `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-consumers-and-regression.md`

- [ ] **Step 1: Run the final mixed regression set**

Run:

```bash
cargo test -p control-plane model_provider -- --nocapture
cargo test -p control-plane orchestration_runtime -- --nocapture
cargo test -p api-server model_provider_routes -- --nocapture
pnpm --dir web/app test -- \
  src/features/settings/api/_tests/settings-api.test.ts \
  src/features/settings/_tests/model-providers-page.test.tsx \
  src/style-boundary/_tests/registry.test.tsx \
  src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- All commands pass with the enabled-model contract fully wired end-to-end.

- [ ] **Step 2: Update all three plan files with actual verification results**
  - Backfill the backend plan verification section.
  - Backfill the settings UI plan verification section.
  - Append the final mixed regression results to this plan.

- [ ] **Step 3: Commit**

```bash
git add web/app/src/features/agent-flow/api/model-provider-options.ts \
  web/app/src/features/agent-flow/lib/model-options.ts \
  web/app/src/features/agent-flow/_tests/validate-document.test.ts \
  web/app/src/style-boundary/registry.tsx \
  web/app/src/style-boundary/_tests/registry.test.tsx \
  web/app/src/test/model-provider-contract-fixtures.ts \
  docs/superpowers/plans/2026-04-22-model-provider-enabled-models-backend-and-runtime.md \
  docs/superpowers/plans/2026-04-22-model-provider-enabled-models-settings-ui.md \
  docs/superpowers/plans/2026-04-22-model-provider-enabled-models-consumers-and-regression.md
git commit -m "test(model-providers): align consumers with enabled models"
```

## Verification Results

- `pnpm --dir web/app test -- src/style-boundary/_tests/registry.test.tsx src/features/agent-flow/_tests/validate-document.test.ts`
  - PASS, `14 passed; 0 failed`
- `cargo test -p control-plane model_provider -- --nocapture`
  - PASS, `11 passed; 0 failed`
- `cargo test -p control-plane orchestration_runtime -- --nocapture`
  - PASS, `6 passed; 0 failed`
- `cargo test -p api-server model_provider_routes -- --nocapture`
  - PASS, `6 passed; 0 failed`
- `pnpm --dir web/app test -- src/features/settings/api/_tests/settings-api.test.ts src/features/settings/_tests/model-providers-page.test.tsx src/style-boundary/_tests/registry.test.tsx src/features/agent-flow/_tests/validate-document.test.ts`
  - PASS, `36 passed; 0 failed`
