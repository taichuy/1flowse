# 2026-03-15 runtime execution policy editor and trace

## Background

The previous commit `65950d3` only aligned the graded-execution architecture at the documentation layer. It clarified that:

- `NodeType` and `execution class` are separate concerns
- the workflow executor remains the single orchestration owner
- 7Flows should not sandbox every node by default

Code still lagged behind that decision because:

- workflow schema did not accept `runtimePolicy.execution`
- the workflow editor only had structured controls for retry / join
- runtime traces could not tell which execution boundary a node actually used
- the execution adapter registry had no IR or UI landing point yet

This round closes that gap with a minimal but real code handoff from docs to implementation.

## Goals

- Accept `runtimePolicy.execution` in workflow schema validation.
- Add a structured execution-policy form in the workflow editor inspector.
- Record the effective execution boundary in runtime input and execution-view summaries.
- Keep the frontend form growth under control while adding this new runtime section.

## Implementation

### 1. Backend schema now accepts `runtimePolicy.execution`

`api/app/schemas/workflow.py` now defines `WorkflowNodeExecutionPolicy` with:

- `class`
- `profile`
- `timeoutMs`
- `networkPolicy`
- `filesystemPolicy`

`WorkflowNodeRuntimePolicy` now includes `execution`, and `execution` is treated as a runtime-managed input root so edge mappings cannot overwrite it.

### 2. Runtime resolves default execution policy

A new helper module, `api/app/services/runtime_execution_policy.py`, now:

- resolves explicit `runtimePolicy.execution`
- applies default execution classes by node type
- produces reusable payloads for runtime input and execution views

Current default mapping is intentionally small:

- `sandbox_code -> sandbox`
- every other node type -> `inline`

This is only the first slice. Real adapter dispatch is still pending.

### 3. Runtime input and execution view expose execution boundary

`api/app/services/runtime_node_preparation_support.py` now injects the resolved execution payload into:

- `node_run.input_payload.execution`
- `node.started` event payload under `execution`

`api/app/schemas/run_views.py` and `api/app/services/run_views.py` now expose execution summary fields in execution view:

- `execution_class`
- `execution_source`
- `execution_profile`
- `execution_timeout_ms`
- `execution_network_policy`
- `execution_filesystem_policy`

This gives later execution adapters, sandbox dispatch, and tool-level mapping a stable trace surface to build on.

### 4. Workflow editor now has a structured execution section

Frontend additions:

- `web/lib/workflow-runtime-policy.ts`
- `web/components/workflow-node-config-form/runtime-policy-helpers.ts`
- `web/components/workflow-node-config-form/runtime-policy-execution-section.tsx`

`web/components/workflow-node-config-form/runtime-policy-form.tsx` now orchestrates execution / retry / join, while the new execution section handles:

- effective default class display
- explicit override vs resolved default state
- `profile`, `timeoutMs`, `networkPolicy`, `filesystemPolicy`
- normalization so default values do not get persisted unnecessarily

### 5. Run diagnostics now shows execution boundary summary

`web/components/run-diagnostics-execution-sections.tsx` now displays execution class/source and optional execution profile, timeout, network, and filesystem hints for each node run.

## Impact

Touched paths include:

- `api/app/schemas/workflow.py`
- `api/app/services/runtime_execution_policy.py`
- `api/app/services/runtime_node_preparation_support.py`
- `api/app/schemas/run_views.py`
- `api/app/services/run_views.py`
- `api/tests/test_workflow_routes.py`
- `api/tests/test_runtime_service.py`
- `api/tests/test_run_routes.py`
- `web/lib/workflow-runtime-policy.ts`
- `web/lib/get-workflows.ts`
- `web/lib/workflow-editor.ts`
- `web/lib/get-run-views.ts`
- `web/components/workflow-node-config-form/runtime-policy-form.tsx`
- `web/components/workflow-node-config-form/runtime-policy-helpers.ts`
- `web/components/workflow-node-config-form/runtime-policy-execution-section.tsx`
- `web/components/workflow-editor-inspector.tsx`
- `web/components/run-diagnostics-execution-sections.tsx`
- `docs/dev/runtime-foundation.md`
- `README.md`

## Validation

### Backend

From `api/`:

```powershell
.\.venv\Scripts\uv.exe run pytest
.\.venv\Scripts\uv.exe run ruff check app/schemas/workflow.py app/services/runtime_execution_policy.py app/services/runtime_node_preparation_support.py app/services/run_views.py tests/test_workflow_routes.py tests/test_runtime_service.py tests/test_run_routes.py
```

Result:

- `pytest`: `219 passed`
- targeted `ruff check`: passed

### Frontend

From `web/`:

```powershell
pnpm exec next lint --file components/workflow-editor-inspector.tsx --file components/run-diagnostics-execution-sections.tsx --file components/workflow-node-config-form/runtime-policy-form.tsx --file components/workflow-node-config-form/runtime-policy-helpers.ts --file components/workflow-node-config-form/runtime-policy-execution-section.tsx --file lib/get-workflows.ts --file lib/workflow-editor.ts --file lib/get-run-views.ts --file lib/workflow-runtime-policy.ts
pnpm exec tsc --noEmit
```

Result:

- targeted `next lint --file ...`: passed
- `tsc --noEmit`: passed

### Existing repo-wide lint debt

Two repo-wide checks are still blocked by pre-existing issues outside this change set:

- `web/pnpm lint` fails on `web/components/credential-store-panel.tsx`
- `api/uv run ruff check` still reports historical issues in unrelated files

This round ensures all touched backend files pass targeted Ruff, and all touched frontend files pass targeted Next lint plus full TypeScript checking.

## Conclusion

This round is the direct continuation of `65950d3`: it converts graded-execution architecture from documentation into IR, editor, and runtime-trace reality.

The project foundation is still strong enough to keep pushing core product functionality, but it is not yet at the stage where only manual UI design / end-to-end human acceptance remains. Because of that, the manual-notification script is not triggered in this round.

## Next Steps

1. Connect `runtimePolicy.execution` to a real Execution Adapter Registry.
2. Push tool/plugin default execution-class mapping into Tool Gateway, not just node input.
3. Land the unified sensitive-access-control fact layer so `execution class` and `sensitivity_level` become real orthogonal governance axes in runtime.
4. Continue splitting `web/components/run-diagnostics-execution-sections.tsx`, which is still growing as execution/evidence details accumulate.
