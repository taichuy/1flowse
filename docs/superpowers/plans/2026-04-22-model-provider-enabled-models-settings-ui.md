# Model Provider Enabled Models Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the settings UI so model-provider instances manage a candidate-cache list plus an editable `enabled_model_ids` array instead of one validation model.

**Architecture:** Keep the API contract thin through `web/packages/api-client` and `features/settings/api`, then move the operator workflow into the existing settings components rather than inventing a new page. The drawer owns candidate-cache fetch state and enabled-model editing; tables and modals only render the new instance truth and refresh actions.

**Tech Stack:** TypeScript, React, Ant Design, Vitest

---

## File Structure

**Modify**
- `web/packages/api-client/src/console-model-providers.ts`
- `web/app/src/features/settings/api/model-providers.ts`
- `web/app/src/features/settings/pages/SettingsPage.tsx`
- `web/app/src/features/settings/components/model-providers/ModelProviderInstanceDrawer.tsx`
- `web/app/src/features/settings/components/model-providers/ModelProviderInstancesTable.tsx`
- `web/app/src/features/settings/components/model-providers/ModelProviderInstancesModal.tsx`
- `web/app/src/features/settings/components/model-providers/model-provider-panel.css`
- `web/app/src/features/settings/api/_tests/settings-api.test.ts`
- `web/app/src/features/settings/_tests/model-providers-page.test.tsx`

**Notes**
- Reuse `antd` controls already in the feature. Do not add a bespoke combobox package.
- The primary editor control should be `Select` in `mode="tags"` or an equivalent Ant Design first-party pattern so users can both search cached entries and type arbitrary IDs.
- Remove “校验模型 / 验证实例 / 校验说明” wording from the settings surface.

### Task 1: Update Shared Frontend DTOs

**Files:**
- Modify: `web/packages/api-client/src/console-model-providers.ts`
- Modify: `web/app/src/features/settings/api/model-providers.ts`
- Modify: `web/app/src/features/settings/api/_tests/settings-api.test.ts`

- [ ] **Step 1: Write failing API adapter tests for the new payload shape**
  - Lock the new frontend contract to:
    - `enabled_model_ids: string[]`
    - no `validation_model_id`
    - no validation-history fields in the instance payload
    - `preview_token` still present on candidate preview responses

- [ ] **Step 2: Run the targeted API adapter tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/settings/api/_tests/settings-api.test.ts
```

Expected:

- FAIL because the shared client types still expose `validation_model_id` and validation-history fields.

- [ ] **Step 3: Rewrite the shared DTOs and adapters**
  - In `web/packages/api-client/src/console-model-providers.ts`, replace the old single-model request and response fields with:
    - request input `enabled_model_ids: string[]`
    - instance field `enabled_model_ids: string[]`
  - Remove validation-history fields from the typed response if the backend contract no longer returns them.
  - Keep `model_count`, `catalog_refresh_status`, `catalog_last_error_message`, and `catalog_refreshed_at`.

- [ ] **Step 4: Re-run the targeted API adapter tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/settings/api/_tests/settings-api.test.ts
```

Expected:

- PASS with the new contract.

### Task 2: Rebuild The Instance Drawer Around Candidate Cache Plus Enabled Models

**Files:**
- Modify: `web/app/src/features/settings/components/model-providers/ModelProviderInstanceDrawer.tsx`
- Modify: `web/app/src/features/settings/pages/SettingsPage.tsx`
- Modify: `web/app/src/features/settings/components/model-providers/model-provider-panel.css`
- Modify: `web/app/src/features/settings/_tests/model-providers-page.test.tsx`

- [ ] **Step 1: Write failing page tests for the new drawer workflow**
  - Add coverage that the drawer:
    - shows a “获取候选模型” or “刷新候选模型” action
    - keeps fetched candidate models available for search
    - lets the operator type a manual model ID and commit it with Enter
    - submits `enabled_model_ids` in create/update payloads
    - preserves selected enabled models while candidate cache is refreshed

- [ ] **Step 2: Run the focused page test file and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/settings/_tests/model-providers-page.test.tsx
```

Expected:

- FAIL because the drawer still renders a single-select “校验模型”.

- [ ] **Step 3: Replace the drawer state and submit wiring**
  - In `ModelProviderInstanceDrawer.tsx`:
    - replace `selectedPreviewModelId` with `enabledModelIds: string[]`
    - initialize edit state from `instance.enabled_model_ids`
    - keep `previewToken` only for candidate-cache reuse
    - render candidate-cache refresh controls separately from the enabled-model editor
    - use a tag-style searchable control for enabled models
  - In `SettingsPage.tsx`:
    - send `enabled_model_ids`
    - stop sending `validation_model_id`
    - rename any `onValidate` usage that actually means “refresh candidate cache”
  - In CSS:
    - add only the minimum selectors needed for the two-section drawer layout
    - do not style Ant Design internals recursively

- [ ] **Step 4: Re-run the focused page test file and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/settings/_tests/model-providers-page.test.tsx
```

Expected:

- PASS with the new create/edit workflow.

### Task 3: Update Tables, Modal Copy, And Actions

**Files:**
- Modify: `web/app/src/features/settings/components/model-providers/ModelProviderInstancesTable.tsx`
- Modify: `web/app/src/features/settings/components/model-providers/ModelProviderInstancesModal.tsx`
- Modify: `web/app/src/features/settings/pages/SettingsPage.tsx`
- Modify: `web/app/src/features/settings/_tests/model-providers-page.test.tsx`

- [ ] **Step 1: Add failing UI assertions for the list and modal surfaces**
  - Cover:
    - enabled-model count and preview text render from `enabled_model_ids`
    - candidate-cache count still renders from `model_count`
    - the action label changes from “验证实例” to “刷新候选模型”
    - expanded modal content no longer references “校验模型 / 校验说明”

- [ ] **Step 2: Run the focused page tests and verify RED**

Run:

```bash
pnpm --dir web/app test -- src/features/settings/_tests/model-providers-page.test.tsx
```

Expected:

- FAIL because current tables and modal text still depend on validation fields.

- [ ] **Step 3: Rewrite renderers and action names**
  - In `ModelProviderInstancesTable.tsx`, show:
    - instance status
    - candidate-cache count
    - enabled-model count or sample list
  - In `ModelProviderInstancesModal.tsx`, expand rows with:
    - cached candidates
    - enabled-model list
    - refresh metadata from catalog fields
  - Remove any local state that assumes one selected model per instance.

- [ ] **Step 4: Re-run the focused page tests and verify GREEN**

Run:

```bash
pnpm --dir web/app test -- src/features/settings/_tests/model-providers-page.test.tsx
```

Expected:

- PASS with the new wording and layout.

### Task 4: Close The Settings Slice With Focused Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-22-model-provider-enabled-models-settings-ui.md`

- [ ] **Step 1: Run the final frontend verification set**

Run:

```bash
pnpm --dir web/app test -- \
  src/features/settings/api/_tests/settings-api.test.ts \
  src/features/settings/_tests/model-providers-page.test.tsx
```

Expected:

- Both targeted settings test files pass.

- [ ] **Step 2: Update this plan with actual verification output**
  - Append a `Verification Results` section with concrete pass/fail output.

- [ ] **Step 3: Commit**

```bash
git add web/packages/api-client/src/console-model-providers.ts \
  web/app/src/features/settings/api/model-providers.ts \
  web/app/src/features/settings/pages/SettingsPage.tsx \
  web/app/src/features/settings/components/model-providers/ModelProviderInstanceDrawer.tsx \
  web/app/src/features/settings/components/model-providers/ModelProviderInstancesTable.tsx \
  web/app/src/features/settings/components/model-providers/ModelProviderInstancesModal.tsx \
  web/app/src/features/settings/components/model-providers/model-provider-panel.css \
  web/app/src/features/settings/api/_tests/settings-api.test.ts \
  web/app/src/features/settings/_tests/model-providers-page.test.tsx \
  docs/superpowers/plans/2026-04-22-model-provider-enabled-models-settings-ui.md
git commit -m "feat(model-providers): edit enabled model ids in settings"
```

## Verification Results

- `pnpm --dir web/app test -- src/features/settings/api/_tests/settings-api.test.ts`
  - PASS, `4 passed; 0 failed`
- `pnpm --dir web/app test -- src/features/settings/_tests/model-providers-page.test.tsx`
  - PASS, `18 passed; 0 failed`
- `pnpm --dir web/app test -- src/features/settings/api/_tests/settings-api.test.ts src/features/settings/_tests/model-providers-page.test.tsx`
  - PASS, `22 passed; 0 failed`
- `pnpm --dir web/app build`
  - PASS, `tsc -p tsconfig.json --noEmit && vite build`
