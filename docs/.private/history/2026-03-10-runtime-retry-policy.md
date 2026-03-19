# Runtime Retry Policy

## Background

`docs/history/2026-03-10-runtime-branching.md` landed explicit branch activation and failure-path continuation, but the runtime still lacked a minimal retry layer.
That left transient node failures with only two outcomes:

- fail the whole run immediately
- route to an explicit failure branch immediately

This was too sharp for the next stage of runtime work because even the MVP executor now needs a small amount of resilience and observability around retried node execution.

## Goal

Add a minimal node-level retry policy that works with the existing runtime model:

- no new tables or migration in this step
- reuse the existing `node_runs` record and `run_events` stream
- allow retries before a node is marked failed
- keep explicit failure branches working after retries are exhausted

## Decision

### 1. Retry policy lives in `runtimePolicy.retry`

Workflow node definitions now accept:

```json
{
  "runtimePolicy": {
    "retry": {
      "maxAttempts": 3,
      "backoffSeconds": 1,
      "backoffMultiplier": 2
    }
  }
}
```

Current semantics:

- `maxAttempts` counts the initial execution attempt
- `backoffSeconds` is the base delay before the next retry
- `backoffMultiplier` scales the delay for later retries

### 2. Retries reuse the existing `NodeRun`

This step does not create one `NodeRun` per attempt.
Instead:

- a node still owns one `NodeRun` per workflow run
- intermediate retry attempts are emitted through `run_events`
- the final persisted node status is still `succeeded` or `failed`

This keeps the current schema stable while making retries visible.

### 3. Intermediate failures emit `node.retrying`

When an attempt fails but the retry budget is not exhausted, the runtime emits:

- `node.retrying`

with payload fields such as:

- `attempt`
- `max_attempts`
- `error`
- `next_retry_in_seconds`

Only the terminal failure emits `node.failed`.
This avoids treating a recovered node as permanently failed in the event stream.

### 4. Failure branches run after retries are exhausted

If the final attempt still fails:

- the node becomes `failed`
- a terminal `node.failed` event is written
- explicit failure edges such as `condition=failed` still activate as before

This preserves the current branching contract while making it retry-aware.

## Impact

- `api/app/schemas/workflow.py`
  - adds structured validation for `runtimePolicy.retry`
- `api/app/services/runtime.py`
  - adds retry execution, backoff calculation, and `node.retrying` events
  - adds `mock_error_sequence` to support deterministic retry tests
- `api/tests/test_runtime_service.py`
  - covers retry-then-success and retry-then-failure-branch flows
- `api/tests/test_run_routes.py`
  - verifies retry events are exposed through the API
- `api/tests/test_workflow_routes.py`
  - verifies retry policy validation on workflow create

## Verification

Run from [`api`](E:/code/taichuCode/7flows/api):

```powershell
.\.venv\Scripts\pytest.exe -q
.\.venv\Scripts\python.exe -m ruff check app tests
```

## Current Boundary

This still does not implement:

- retry classification by error type
- timeout-aware retries
- per-attempt persistence in a separate attempts table
- frontend retry visualization beyond raw events
- condition expression evaluation beyond the current MVP branching model
