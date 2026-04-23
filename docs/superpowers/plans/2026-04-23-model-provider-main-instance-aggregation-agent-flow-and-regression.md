# Model Provider Main Instance Aggregation AgentFlow And Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update agent-flow to select grouped models from the virtual main instance, store explicit `source_instance_id` in node config, and close the feature with focused regression plus `qa-evaluation`.

**Architecture:** Keep grouped provider/model shaping in `lib/model-options.ts`, keep node-config parsing in `lib/llm-node-config.ts`, and make all editor surfaces read the same `provider_code + source_instance_id + model_id` contract. Validation should stay explicit: preserve stored values when a source instance falls out of the main instance, but surface editor/runtime errors instead of silently repairing them.

**Tech Stack:** TypeScript, React, Vitest, Rust verification commands, `qa-evaluation`

---

## File Structure

**Modify**
- `scripts/node/testing/contracts/model-providers/options.multiple-providers.json`
- `web/app/src/test/model-provider-contract-fixtures.ts`
- `web/packages/flow-schema/src/index.ts`
- `web/app/src/features/agent-flow/api/model-provider-options.ts`
- `web/app/src/features/agent-flow/lib/document/node-factory.ts`
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
- Modify: `web/app/src/features/agent-flow/lib/document/node-factory.ts`
- Modify: `web/app/src/features/agent-flow/lib/llm-node-config.ts`
- Modify: `web/app/src/features/agent-flow/_tests/llm-node-config.test.ts`
- Modify: `web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx`

- [x] **Step 1: Write failing tests for the new node contract**
  - Add coverage that `getLlmModelProvider()` reads:
    - `provider_code`
    - `source_instance_id`
    - `model_id`
  - Update node-schema expectations so fresh LLM nodes initialize `source_instance_id: ''`.

- [x] **Step 2: Run the targeted contract tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- \
  src/features/agent-flow/_tests/llm-node-config.test.ts \
  src/features/agent-flow/_tests/node-schema-registry.test.tsx
```

Expected:

- FAIL because the current LLM node contract and parser still only know `provider_code + model_id`.

- [x] **Step 3: Update the node contract and parser**
  - In `flow-schema/src/index.ts`, add `source_instance_id: ''` to the default LLM node config.
  - In `llm-node-config.ts`, extend `LlmNodeModelProvider` and `getLlmModelProvider()` with `source_instance_id`.
  - Keep existing optional display fields (`protocol`, `provider_label`, `model_label`) only if they still help the editor display state.

- [x] **Step 4: Re-run the targeted contract tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- \
  src/features/agent-flow/_tests/llm-node-config.test.ts \
  src/features/agent-flow/_tests/node-schema-registry.test.tsx
```

Expected:

- PASS with the new explicit source-instance contract.

Task 1 status:
- Shared LLM node config now requires `provider_code + source_instance_id + model_id`, and fresh LLM nodes initialize `source_instance_id: ''` in both the shared schema defaults and the local node factory helper.
- `getLlmModelProvider()` now parses and returns `source_instance_id`, so editor consumers no longer silently collapse grouped main-instance models onto `provider_code + model_id`.
- RED was observed first on `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-node-config.test.ts src/features/agent-flow/_tests/node-schema-registry.test.tsx` while parser/defaults still lacked `source_instance_id`.
- Re-verified GREEN on the current working tree with `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-node-config.test.ts src/features/agent-flow/_tests/node-schema-registry.test.tsx` -> `6 passed; 0 failed`.

### Task 2: Rebuild Grouped Provider Options And Selector Logic

**Files:**
- Modify: `scripts/node/testing/contracts/model-providers/options.multiple-providers.json`
- Modify: `web/app/src/test/model-provider-contract-fixtures.ts`
- Modify: `web/app/src/features/agent-flow/lib/model-options.ts`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmModelField.tsx`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx`
- Modify: `web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`

- [x] **Step 1: Write failing selector tests for grouped model options**
  - Add coverage that:
    - providers still render once per provider family
    - models are grouped under source-instance headings
    - selecting a grouped model writes `source_instance_id`
    - parameter forms still resolve from the selected grouped model entry

- [x] **Step 2: Run the focused selector tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx
```

Expected:

- FAIL because `model-options.ts` still flattens one provider to `provider.models[]` without grouped instance metadata.

- [x] **Step 3: Replace flat option shaping with grouped child-instance data**
  - In `model-options.ts`:
    - add a grouped option structure that carries `sourceInstanceId` and `sourceInstanceLabel`
    - keep model item labels clean, using only the model display name
  - In `LlmModelField.tsx`:
    - keep provider selection as step one
    - render the model `<Select>` using grouped options
    - write `source_instance_id` into `config.model_provider`
  - In `LlmParameterForm.tsx`, look up parameter schema by `provider_code + source_instance_id + model_id`.

- [x] **Step 4: Re-run the focused selector tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx
```

Expected:

- PASS with grouped selection and explicit `source_instance_id`.

Task 2 status:
- Shared contract fixtures now expose grouped `main_instance + model_groups` data, including duplicate model-id coverage across source instances so selector lookups cannot cheat on `provider_code + model_id`.
- `listLlmProviderOptions()` now builds grouped provider options with per-group headings, flattened model lookup entries, and explicit `sourceInstanceId` / `sourceInstanceLabel` metadata for editor consumers.
- `LlmModelField.tsx` writes `source_instance_id` back into `config.model_provider`, keeps model labels clean in the selector, and resets to the provider's first enabled grouped model when switching providers.
- `LlmParameterForm.tsx` now resolves schemas by `provider_code + source_instance_id + model_id`, so parameter forms stay pinned to the selected grouped entry.
- RED was observed first on `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx` while `model-options.ts` still expected flat `provider.models`.
- Re-verified GREEN on the current working tree with `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx` -> `4 passed; 0 failed`.

### Task 3: Tighten Document Validation And View Renderers

**Files:**
- Modify: `web/app/src/features/agent-flow/lib/validate-document.ts`
- Modify: `web/app/src/features/agent-flow/schema/agent-flow-view-renderers.tsx`
- Modify: `web/app/src/features/agent-flow/_tests/validate-document.test.ts`

- [x] **Step 1: Write failing validation tests for source-instance-aware nodes**
  - Add coverage that:
    - missing `source_instance_id` raises the same field-level error family as missing provider/model
    - a node referencing a provider but missing grouped model data is flagged as unavailable
    - a node whose saved `source_instance_id` is no longer present stays populated but yields validation errors

- [x] **Step 2: Run the validation tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- FAIL because validation currently checks only provider existence and flat model membership.

- [x] **Step 3: Replace flat provider/model validation**
  - In `validate-document.ts`, require all three fields:
    - `provider_code`
    - `source_instance_id`
    - `model_id`
  - Validate that the selected grouped entry still exists in provider options.
  - In `agent-flow-view-renderers.tsx`, update summary display so it still renders a clean provider/model label without leaking obsolete `effective_instance_id` assumptions.

- [x] **Step 4: Re-run the validation tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts
```

Expected:

- PASS with explicit source-instance-aware validation.

Task 3 status:
- Validation now treats `provider_code`, `source_instance_id`, and `model_id` as one required selection contract and raises distinct field errors for missing provider, missing source instance, and missing model.
- Availability checks now preserve stored values and surface explicit errors when the grouped source instance disappears or the selected model no longer belongs to that source instance.
- `agent-flow-view-renderers.tsx` required no code change in the final implementation because it already renders persisted `provider_label` / `model_label` values without consuming obsolete `effective_instance_id` assumptions.
- RED was observed first on `pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts` while validation still checked only flat provider/model membership.
- Re-verified GREEN on the current working tree with `pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts` -> `10 passed; 0 failed`.

### Task 4: Run Focused Regression And QA Closeout

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md`

- [x] **Step 1: Run the final focused frontend regression set**

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

- [x] **Step 2: Run final repository QA using `qa-evaluation`**
  - Follow the repo rule for self-check / regression / delivery.
  - Summarize evidence from:
    - backend targeted `cargo test` runs
    - settings targeted Vitest runs
    - agent-flow targeted Vitest runs
    - any residual risks or untested paths

- [x] **Step 3: Update this plan with actual verification output**
  - Append a `Verification Results` section with concrete pass/fail output and the QA conclusion.

- [x] **Step 4: Commit**

```bash
git add scripts/node/testing/contracts/model-providers/options.multiple-providers.json \
  web/app/src/test/model-provider-contract-fixtures.ts \
  web/packages/flow-schema/src/index.ts \
  web/app/src/features/agent-flow/lib/document/node-factory.ts \
  web/app/src/features/agent-flow/lib/model-options.ts \
  web/app/src/features/agent-flow/lib/llm-node-config.ts \
  web/app/src/features/agent-flow/lib/validate-document.ts \
  web/app/src/features/agent-flow/components/detail/fields/LlmModelField.tsx \
  web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx \
  web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx \
  web/app/src/features/agent-flow/_tests/llm-node-config.test.ts \
  web/app/src/features/agent-flow/_tests/validate-document.test.ts \
  web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx \
  web/app/src/features/settings/_tests/model-providers-page.test.tsx \
  docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md
git commit -m "feat(agent-flow): bind llm nodes to grouped main-instance models"
```

## Verification Results

### Scope

- 当前评估模式：`qa-evaluation` task mode
- 评估范围：main-instance aggregation 的 agent-flow grouped selector、共享 contract consumer、后端 main-instance 路由契约，以及 settings 共享消费者回归
- 输入来源：
  - `docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-index.md`
  - `docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-backend-and-runtime.md`
  - `docs/superpowers/plans/2026-04-23-model-provider-main-instance-aggregation-settings-ui.md`
  - 当前工作区未提交 agent-flow diff
- 已运行的验证：
  - `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-node-config.test.ts src/features/agent-flow/_tests/node-schema-registry.test.tsx`
  - `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`
  - `pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts`
  - `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx src/features/agent-flow/_tests/llm-node-config.test.ts src/features/agent-flow/_tests/validate-document.test.ts src/features/agent-flow/_tests/node-schema-registry.test.tsx src/features/settings/api/_tests/settings-api.test.ts`
  - `pnpm --dir web/app test -- src/features/settings/_tests/model-providers-page.test.tsx`
  - `node scripts/node/test-contracts.js`
  - `cargo test -p storage-pg model_provider_repository -- --nocapture`
  - `cargo test -p control-plane model_provider -- --nocapture`
  - `cargo test -p control-plane orchestration_runtime -- --nocapture`
  - `cargo test -p api-server model_provider_routes -- --nocapture`
- 未运行的验证：
  - `node scripts/node/verify-repo.js`
  - `node scripts/node/test-frontend.js full`
  - 浏览器运行态走查 / 截图证据

### Conclusion

- 是否存在 `Blocking` 问题：否
- 是否存在 `High` 问题：否
- 当前是否建议继续推进：是
- 当前最主要的风险：本次结论基于 targeted tests、共享 contract gate 与后端定向 `cargo test`；未额外补浏览器运行态证据，因此 UI 结论仍属于无截图的工程验证结论

### Findings

- 无新增 `Blocking` / `High` findings

### Uncovered Areas / Risks

- 未运行仓库级 `verify-repo` / `test-frontend full`，因此本次不对“整仓可合入基线”做额外放大结论，只对本任务 blast radius 给出通过结论
- 未补充浏览器运行态截图、console 采样或移动端观察；当前前端结论基于 Vitest + contract consumer gate

### Command Results

- `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-node-config.test.ts src/features/agent-flow/_tests/node-schema-registry.test.tsx`
  - `6 passed; 0 failed`
- `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`
  - `4 passed; 0 failed`
- `pnpm --dir web/app test -- src/features/agent-flow/_tests/validate-document.test.ts`
  - `10 passed; 0 failed`
- `pnpm --dir web/app test -- src/features/agent-flow/_tests/llm-model-provider-field.test.tsx src/features/agent-flow/_tests/llm-node-config.test.ts src/features/agent-flow/_tests/validate-document.test.ts src/features/agent-flow/_tests/node-schema-registry.test.tsx src/features/settings/api/_tests/settings-api.test.ts`
  - `24 passed; 0 failed`
- `pnpm --dir web/app test -- src/features/settings/_tests/model-providers-page.test.tsx`
  - `22 passed; 0 failed`
- `node scripts/node/test-contracts.js`
  - `4 passed (files); 38 passed; 0 failed`
- `cargo test -p storage-pg model_provider_repository -- --nocapture`
  - `7 passed; 0 failed`
- `cargo test -p control-plane model_provider -- --nocapture`
  - `19 passed; 0 failed`
- `cargo test -p control-plane orchestration_runtime -- --nocapture`
  - `19 passed; 0 failed`
- `cargo test -p api-server model_provider_routes -- --nocapture`
  - `7 passed; 0 failed`
