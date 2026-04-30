# Data Source Data Model Plan F Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Settings / 数据源 product UI for data source defaults, Data Model management, permissions, API exposure, Advisor, and record preview.

**Architecture:** Add feature-level API wrappers in settings, then route/navigation entries, then data-source and Data Model panels. Use tables, forms, descriptions, tabs, drawers, and existing Settings section layout; do not build a card-wall UI.

**Tech Stack:** React, TypeScript, Ant Design, TanStack Query, @1flowbase/api-client, existing Settings page shell.

---

## File Structure

**Modify**
- `web/packages/api-client/src/index.ts`: export console data-source/Data Model clients.
- Create: `web/packages/api-client/src/console-data-models.ts`
- Create: `web/app/src/features/settings/api/data-models.ts`
- Create: `web/app/src/features/settings/components/data-models/DataSourcePanel.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelTable.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelDetail.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelFieldDrawer.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelPermissionsTab.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelApiTab.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelAdvisorTab.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelRecordPreview.tsx`
- Create: `web/app/src/features/settings/components/data-models/data-model-panel.css`
- Modify: `web/app/src/features/settings/lib/settings-sections.tsx`
- Modify: `web/app/src/features/settings/pages/settings-page/use-settings-sections.ts`
- Test: `web/app/src/features/settings/_tests/data-models-page.test.tsx`
- Test: `web/app/src/features/settings/api/_tests/settings-api.test.ts`

### Task 1: API Client And Settings Query Wrappers

**Files:**
- Create: `web/packages/api-client/src/console-data-models.ts`
- Modify: `web/packages/api-client/src/index.ts`
- Create: `web/app/src/features/settings/api/data-models.ts`
- Test: `web/app/src/features/settings/api/_tests/settings-api.test.ts`

- [ ] **Step 1: Write failing tests**

Cover wrappers for:

```text
fetch data sources
update data source defaults
fetch Data Models by data source
create/update Data Model
update Data Model status
update API exposure request
fetch fields
create/delete fields
fetch grants
save grants
fetch Advisor findings
fetch record preview
```

- [ ] **Step 2: Implement client functions**

Use existing `transport` helpers and CSRF pattern from settings model provider/file management clients.

- [ ] **Step 3: Run API wrapper tests**

```bash
pnpm --dir web/app test -- settings-api
```

Expected: pass or use the nearest existing targeted Settings test command if the script does not accept a name filter.

### Task 2: Settings Navigation And Data Source Panel

**Files:**
- Modify: `web/app/src/features/settings/lib/settings-sections.tsx`
- Modify: `web/app/src/features/settings/pages/settings-page/use-settings-sections.ts`
- Create: `web/app/src/features/settings/components/data-models/DataSourcePanel.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelTable.tsx`
- Create: `web/app/src/features/settings/components/data-models/data-model-panel.css`
- Test: `web/app/src/features/settings/_tests/data-models-page.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert:

```text
Settings shows 数据源 section
data source list includes main_source
data source detail shows default Data Model status selector
data source detail shows default API exposure status selector
clicking a data source shows Data Model table
```

- [ ] **Step 2: Implement panel**

Use Ant Design `Table`, `Descriptions`, `Form`, `Select`, `Tabs`, `Button`, and `Tag`. Keep page section unframed; use row tables and drawers for repeated records.

- [ ] **Step 3: Run tests**

```bash
node scripts/node/test-frontend.js fast
```

### Task 3: Data Model Detail Tabs

**Files:**
- Create: `web/app/src/features/settings/components/data-models/DataModelDetail.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelFieldDrawer.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelPermissionsTab.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelApiTab.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelAdvisorTab.tsx`
- Create: `web/app/src/features/settings/components/data-models/DataModelRecordPreview.tsx`
- Test: `web/app/src/features/settings/_tests/data-models-page.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Cover:

```text
Data Model detail shows fields tab
status dropdown contains draft/published/disabled/broken
API tab shows published_not_exposed by default
api_exposed_ready is displayed as computed readiness, not a raw unsafe select
permissions tab edits owner/scope_all/system_all
Advisor tab shows blocking/high/info findings
record preview lists data through runtime route
```

- [ ] **Step 2: Implement detail**

Use tabs:

```text
字段
关系
权限
API
记录预览
Advisor
```

Display status controls in the page header or summary area, not hidden inside a form-only drawer.

- [ ] **Step 3: Run targeted tests**

```bash
node scripts/node/test-frontend.js fast
```

### Task 4: Style Boundary And Responsive Checks

**Files:**
- Modify: `web/app/src/style-boundary/scenario-manifest.json`
- Test: Settings page style boundary.

- [ ] **Step 1: Register Settings scenario updates**

Add the new data-model files to the Settings page style boundary scenario.

- [ ] **Step 2: Run style boundary**

```bash
node scripts/node/check-style-boundary.js page.settings
```

Expected: pass.

- [ ] **Step 3: Run frontend fast gate**

```bash
node scripts/node/test-frontend.js fast
```

### Task 5: Plan F Verification And Commit

- [ ] **Step 1: Type and test**

```bash
pnpm --dir web lint
node scripts/node/test-frontend.js fast
```

- [ ] **Step 2: Commit**

```bash
git add web/packages/api-client web/app/src/features/settings web/app/src/style-boundary
git commit -m "feat: add settings data model management"
```
