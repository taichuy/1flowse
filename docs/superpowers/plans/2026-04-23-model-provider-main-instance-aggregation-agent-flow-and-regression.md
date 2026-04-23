# Model Provider Main Instance Aggregation AgentFlow And Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update agent-flow to select grouped models from the virtual main instance, store explicit `source_instance_id` in node config, and close the feature with focused regression plus `qa-evaluation`.

**Architecture:** Keep grouped provider/model shaping in `lib/model-options.ts`, keep node-config parsing in `lib/llm-node-config.ts`, and make all editor surfaces read the same `provider_code + source_instance_id + model_id` contract. Validation should stay explicit: preserve stored values when a source instance falls out of the main instance, but surface editor/runtime errors instead of silently repairing them.

**Tech Stack:** TypeScript, React, Vitest, Rust verification commands, `qa-evaluation`

---

## File Structure

**Modify**
- `web/packages/flow-schema/src/index.ts`
- `web/app/src/features/agent-flow/api/model-provider-options.ts`
- `web/app/src/features/agent-flow/lib/model-options.ts`
- `web/app/src/features/agent-flow/lib/llm-node-config.ts`
- `web/app/src/features/agent-flow/lib/validate-document.ts`
- `web/app/src/features/agent-flow/components/detail/fields/LlmModelField.tsx`
- `web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx`
- `web/app/src/features/agent-flow/schema/agent-flow-view-renderers.tsx`
- `web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`
- `web/app/src/features/agent-flow/_tests/llm-node-config.test.ts`
- `web/app/src/features/agent-flow/_tests/validate-document.test.ts`
- `web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx`
- `web/app/src/features/settings/api/_tests/settings-api.test.ts`
- `docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md`

**Notes**
- Do not keep the old `effective_instance_id` consumer path alive in the editor.
- The grouped selector should show instance headings but model items should display only the model label, not `instance / model`.
- Preserve the existing one-field inspector contract `config.model_provider`; only its object shape changes.

### Task 1: Rewrite Shared AgentFlow Model-Provider Types

**Files:**
- Modify: `web/packages/flow-schema/src/index.ts`
- Modify: `web/app/src/features/agent-flow/lib/llm-node-config.ts`
- Modify: `web/app/src/features/agent-flow/_tests/llm-node-config.test.ts`
- Modify: `web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx`

- [ ] **Step 1: Write failing tests for the new node contract**
  - Add coverage that `getLlmModelProvider()` reads:
    - `provider_code`
    - `source_instance_id`
    - `model_id`
  - Update node-schema expectations so fresh LLM nodes initialize `source_instance_id: ''`.

- [ ] **Step 2: Run the targeted contract tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- \
  src/features/agent-flow/_tests/llm-node-config.test.ts \
  src/features/agent-flow/_tests/node-schema-registry.test.tsx
```

Expected:

- FAIL because the current LLM node contract and parser still only know `provider_code + model_id`.

- [ ] **Step 3: Update the node contract and parser**
  - In `flow-schema/src/index.ts`, add `source_instance_id: ''` to the default LLM node config.
  - In `llm-node-config.ts`, extend `LlmNodeModelProvider` and `getLlmModelProvider()` with `source_instance_id`.
  - Keep existing optional display fields (`protocol`, `provider_label`, `model_label`) only if they still help the editor display state.

- [ ] **Step 4: Re-run the targeted contract tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- \
  src/features/agent-flow/_tests/llm-node-config.test.ts \
  src/features/agent-flow/_tests/node-schema-registry.test.tsx
```

Expected:

- PASS with the new explicit source-instance contract.

### Task 2: Rebuild Grouped Provider Options And Selector Logic

**Files:**
- Modify: `web/app/src/features/agent-flow/lib/model-options.ts`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmModelField.tsx`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx`
- Modify: `web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`

- [ ] **Step 1: Write failing selector tests for grouped model options**
  - Add coverage that:
    - providers still render once per provider family
    - models are grouped under source-instance headings
    - selecting a grouped model writes `source_instance_id`
    - parameter forms still resolve from the selected grouped model entry

- [ ] **Step 2: Run the focused selector tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx
```

Expected:

- FAIL because `model-options.ts` still flattens one provider to `provider.models[]` without grouped instance metadata.

- [ ] **Step 3: Replace flat option shaping with grouped child-instance data**
  - In `model-options.ts`:
    - add a grouped option structure that carries `sourceInstanceId` and `sourceInstanceLabel`
    - keep model item labels clean, using only the model display name
  - In `LlmModelField.tsx`:
    - keep provider selection as step one
    - render the model `<Select>` using grouped options
    - write `source_instance_id` into `config.model_provider`
  - In `LlmParameterForm.tsx`, look up parameter schema by `provider_code + source_instance_id + model_id`.

- [ ] **Step 4: Re-run the focused selector tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx
```

Expected:

- PASS with grouped selection and explicit `source_instance_id`.

### Task 3: Tighten Document Validation And View Renderers

**Files:**
- Modify: `web/app/src/features/agent-flow/lib/validate-document.ts`
- Modify: `web/app/src/features/agent-flow/schema/agent-flow-view-renderers.tsx`
- Modify: `web/app/src/features/agent-flow/_tests/validate-document.test.ts`

- [ ] **Step 1: Write failing validation tests for source-instance-aware nodes**
  - Add coverage that:
    - missing `source_instance_id` raises the same field-level error family as missing provider/model
    - a node referencing a provider but missing grouped model data is flagged as unavailable
    - a node whose saved `source_instance_id` is no longer present stays populated but yields validation errors

- [ ] **Step 2: Run the validation tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- FAIL because validation currently checks only provider existence and flat model membership.

- [ ] **Step 3: Replace flat provider/model validation**
  - In `validate-document.ts`, require all three fields:
    - `provider_code`
    - `source_instance_id`
    - `model_id`
  - Validate that the selected grouped entry still exists in provider options.
  - In `agent-flow-view-renderers.tsx`, update summary display so it still renders a clean provider/model label without leaking obsolete `effective_instance_id` assumptions.

- [ ] **Step 4: Re-run the validation tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- PASS with explicit source-instance-aware validation.

### Task 4: Run Focused Regression And QA Closeout

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md`

- [ ] **Step 1: Run the final focused frontend regression set**

Run:

```bash
pnpm --dir web/app test -- \
  src/features/agent-flow/_tests/llm-model-provider-field.test.tsx \
  src/features/agent-flow/_tests/llm-node-config.test.ts \
  src/features/agent-flow/_tests/validate-document.test.ts \
  src/features/agent-flow/_tests/node-schema-registry.test.tsx \
  src/features/settings/api/_tests/settings-api.test.ts
```

Expected:

- All targeted agent-flow and shared contract tests pass with the new grouped options contract.

- [ ] **Step 2: Run final repository QA using `qa-evaluation`**
  - Follow the repo rule for self-check / regression / delivery.
  - Summarize evidence from:
    - backend targeted `cargo test` runs
    - settings targeted Vitest runs
    - agent-flow targeted Vitest runs
    - any residual risks or untested paths

- [ ] **Step 3: Update this plan with actual verification output**
  - Append a `Verification Results` section with concrete pass/fail output and the QA conclusion.

- [ ] **Step 4: Commit**

```bash
git add web/packages/flow-schema/src/index.ts \
  web/app/src/features/agent-flow/api/model-provider-options.ts \
  web/app/src/features/agent-flow/lib/model-options.ts \
  web/app/src/features/agent-flow/lib/llm-node-config.ts \
  web/app/src/features/agent-flow/lib/validate-document.ts \
  web/app/src/features/agent-flow/components/detail/fields/LlmModelField.tsx \
  web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx \
  web/app/src/features/agent-flow/schema/agent-flow-view-renderers.tsx \
  web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx \
  web/app/src/features/agent-flow/_tests/llm-node-config.test.ts \
  web/app/src/features/agent-flow/_tests/validate-document.test.ts \
  web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx \
  web/app/src/features/settings/api/_tests/settings-api.test.ts \
  docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md
git commit -m "feat(agent-flow): bind llm nodes to grouped main-instance models"
```

## Verification Results

