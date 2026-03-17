# 2026-03-17 workflow editor sidebar governance summary

## Background

- The `P0 sandbox / protocol` line had already pushed shared tool-governance visibility into the dashboard, starter creation flow, workflow tool binding panel, and workspace starter library.
- The remaining authoring gap was the workflow editor sidebar: authors could still switch between workflows there without seeing node count, governed-tool count, strong-isolation defaults, or catalog drift.
- At the same time, the new workflow-list governance summary contract had landed in code but still needed explicit backend coverage so future refactors would not silently drop the fields that the authoring UI now depends on.

## Goal

1. Finish the workflow-list governance rollout across the remaining editor entry point.
2. Keep the authoring surfaces on one shared contract instead of letting the editor sidebar drift back to a thinner, less honest workflow chip.
3. Lock the new `/api/workflows` and workflow-detail governance fields down with focused tests.

## Implementation

### 1. Share the richer workflow chip inside the editor sidebar

- `web/components/workflow-editor-workbench/workflow-editor-sidebar.tsx` now reuses `WorkflowChipLink` instead of rendering its own minimal `Link` chip.
- The editor sidebar therefore shows the same workflow facts already exposed on the dashboard and create/binding entry points:
  - workflow version and status
  - `node_count`
  - governed-tool count
  - strong-isolation count
  - missing catalog tool flags
- This keeps workflow switching inside the editor aligned with the same governance summary authors already saw before entering the canvas.

### 2. Cover the governance helper directly

- Added `api/tests/test_workflow_definition_governance.py`.
- The new tests verify that the helper layer:
  - counts nodes safely for malformed definitions
  - collects tool references from both direct `tool` bindings and `llm_agent.toolPolicy.allowedToolIds`
  - reports governed, strong-isolation, and missing-tool counts correctly

### 3. Cover the route contract that feeds the UI

- Extended `api/tests/test_workflow_routes.py` with a route-level contract test.
- The new coverage verifies that both `/api/workflows` and `/api/workflows/{workflow_id}` expose:
  - `node_count`
  - `tool_governance.referenced_tool_ids`
  - `tool_governance.missing_tool_ids`
  - `tool_governance.governed_tool_count`
  - `tool_governance.strong_isolation_tool_count`
- The test uses a fake workflow-library service so the route contract stays focused on serialization behavior rather than plugin sync setup.

## Impact

- **Authoring honesty**: authors can now see governed-tool pressure and catalog drift before leaving any workflow list entry point, including the editor sidebar.
- **Shared contract stability**: the richer workflow list item is no longer just an implementation detail of one or two pages; it is now treated as a cross-surface contract and protected by tests.
- **Mainline closure**: this round finishes the current list-level governance rollout instead of starting another isolated UI branch.

## Validation

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_workflow_definition_governance.py tests/test_workflow_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `api/.venv/Scripts/uv.exe run ruff check app/api/routes/workflows.py app/schemas/workflow.py app/services/workflow_views.py app/services/workflow_definition_governance.py tests/test_workflow_routes.py tests/test_workflow_definition_governance.py`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## Next Steps

1. Shift the `P0 sandbox / protocol` focus back to deeper compat/native execution hardening and profile/dependency governance now that the remaining workflow-list visibility gap is closed.
2. If authoring still needs more governance help, prefer higher-resolution drilldowns in workflow detail/editor panels instead of adding more list-level summaries.
3. Keep extending route-level coverage whenever shared authoring contracts become inputs for multiple surfaces.
