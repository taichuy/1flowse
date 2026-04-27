# Debug Read Model UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 `RuntimeSpan + RuntimeEvent + RuntimeItem + ledger + ContextProjection` 派生调试读模型、API 和前端展示，明确展示 `trust_level`，并把 AI SDK UI stream 仅作为可选 adapter。

**Architecture:** 后端提供 1flowbase 自有 `DebugStreamPart` 和 span tree API；前端不直接消费 provider raw delta，也不把 AI SDK UI stream 当内部主协议。Application logs/debug console 从 read model 读取 timeline、span tree、capability calls、usage/billing、context projection、gateway trace 和 external opacity。

**Tech Stack:** Rust 2021、Axum、Serde、React 19、TypeScript、TanStack Query、Vitest

---

## File Structure

- Create: `api/crates/observability/src/debug_stream.rs`
- Modify: `api/crates/observability/src/lib.rs`
- Create: `api/crates/control-plane/src/runtime_observability/debug_read_model.rs`
- Modify: `api/crates/control-plane/src/runtime_observability.rs`
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`
- Modify: `api/apps/api-server/src/openapi.rs`
- Modify: `api/apps/api-server/src/_tests/application/application_runtime_routes.rs`
- Modify: `web/packages/api-client/src/console-application-runtime.ts`
- Modify: `web/packages/api-client/src/index.ts`
- Modify: `web/app/src/features/applications/api/runtime.ts`
- Create: `web/app/src/features/applications/lib/runtime-observability/debug-stream-parts.ts`
- Create: `web/app/src/features/applications/_tests/runtime-observability/debug-stream-parts.test.ts`
- Create: `web/app/src/features/applications/_tests/runtime-observability/runtime-debug-api.test.ts`

### Task 1: Add DebugStreamPart Contract And Backend Fold

**Files:**
- Create: `api/crates/observability/src/debug_stream.rs`
- Modify: `api/crates/observability/src/lib.rs`
- Create: `api/crates/control-plane/src/runtime_observability/debug_read_model.rs`

- [x] **Step 1: Write backend fold test**

Create or extend `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`:

```rust
#[test]
fn runtime_event_folds_to_debug_stream_part_with_trust_level() {
    let event = domain::RuntimeEventRecord {
        id: uuid::Uuid::now_v7(),
        flow_run_id: uuid::Uuid::now_v7(),
        node_run_id: None,
        span_id: None,
        parent_span_id: None,
        sequence: 1,
        event_type: "text_delta".into(),
        layer: domain::RuntimeEventLayer::ProviderRaw,
        source: domain::RuntimeEventSource::Host,
        trust_level: domain::RuntimeTrustLevel::HostFact,
        item_id: None,
        ledger_ref: None,
        payload: serde_json::json!({ "delta": "hello" }),
        visibility: domain::RuntimeEventVisibility::Workspace,
        durability: domain::RuntimeEventDurability::Durable,
        created_at: time::OffsetDateTime::now_utc(),
    };

    let part = control_plane::runtime_observability::debug_read_model::fold_event_to_debug_part(event.flow_run_id, &event).unwrap();

    assert_eq!(part.part_type, "text");
    assert_eq!(part.trust_level, domain::RuntimeTrustLevel::HostFact);
    assert_eq!(part.payload["payload"]["delta"], serde_json::json!("hello"));
}
```

- [x] **Step 2: Add DebugStreamPart**

Create `api/crates/observability/src/debug_stream.rs`:

```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct DebugStreamPart {
    pub id: uuid::Uuid,
    pub flow_run_id: uuid::Uuid,
    pub item_id: Option<uuid::Uuid>,
    pub span_id: Option<uuid::Uuid>,
    pub part_type: String,
    pub status: String,
    pub trust_level: domain::RuntimeTrustLevel,
    pub payload: serde_json::Value,
}
```

Modify `api/crates/observability/src/lib.rs`:

```rust
pub mod debug_stream;
pub use debug_stream::DebugStreamPart;
```

- [x] **Step 3: Add fold helper**

Create `api/crates/control-plane/src/runtime_observability/debug_read_model.rs`:

```rust
use observability::DebugStreamPart;

pub fn fold_event_to_debug_part(
    flow_run_id: uuid::Uuid,
    event: &domain::RuntimeEventRecord,
) -> Option<DebugStreamPart> {
    let part_type = match event.event_type.as_str() {
        "text_delta" => "text",
        "reasoning_delta" => "reasoning",
        "tool_call_commit" | "capability_call_requested" => "tool_input",
        "tool_result_appended" | "capability_call_finished" => "tool_output",
        "approval_requested" | "approval_resolved" => "approval",
        "handoff" => "handoff",
        "usage_snapshot" | "usage_recorded" => "usage_snapshot",
        "cost_recorded" | "credit_debited" | "credit_refunded" => "ledger_ref",
        "error" | "run_failed" | "llm_turn_failed" => "error",
        _ => "data",
    };

    Some(DebugStreamPart {
        id: event.id,
        flow_run_id,
        item_id: event.item_id,
        span_id: event.span_id,
        part_type: part_type.into(),
        status: "created".into(),
        trust_level: event.trust_level,
        payload: serde_json::json!({
            "event_type": event.event_type,
            "layer": event.layer.as_str(),
            "source": event.source.as_str(),
            "payload": event.payload,
        }),
    })
}
```

- [x] **Step 4: Run backend fold test**

Run:

```bash
cargo test -p control-plane runtime_event_folds_to_debug_stream_part_with_trust_level
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/observability/src/debug_stream.rs api/crates/observability/src/lib.rs api/crates/control-plane/src/runtime_observability/debug_read_model.rs api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs
git commit -m "feat: fold runtime events into debug stream parts"
```

### Task 2: Expose Debug Stream And Span APIs

**Files:**
- Modify: `api/apps/api-server/src/routes/applications/application_runtime.rs`
- Modify: `api/apps/api-server/src/openapi.rs`
- Modify: `api/apps/api-server/src/_tests/application/application_runtime_routes.rs`
- Modify: `web/packages/api-client/src/console-application-runtime.ts`
- Modify: `web/packages/api-client/src/index.ts`

- [x] **Step 1: Write failing route test**

Add:

```rust
#[tokio::test]
async fn get_runtime_debug_stream_returns_trusted_parts() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app).await;
    let application = create_runtime_application(&app, &cookie, &csrf).await;
    let run = start_basic_debug_run(&app, &cookie, &csrf, &application.id).await;

    let response = app.clone().oneshot(
        Request::builder()
            .method("GET")
            .uri(format!("/api/console/applications/{}/logs/runs/{}/debug-stream", application.id, run.id))
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap(),
    ).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let payload: Value = serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert!(payload["data"]["parts"].as_array().unwrap().iter().any(|part| {
        part["trust_level"] == "host_fact"
    }));
}
```

- [x] **Step 2: Add API response DTO**

In `api/apps/api-server/src/routes/applications/application_runtime.rs`:

```rust
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct RuntimeDebugStreamResponse {
    pub parts: Vec<RuntimeDebugStreamPartResponse>,
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct RuntimeDebugStreamPartResponse {
    pub id: String,
    pub flow_run_id: String,
    pub item_id: Option<String>,
    pub span_id: Option<String>,
    pub part_type: String,
    pub status: String,
    pub trust_level: String,
    pub payload: serde_json::Value,
}
```

- [x] **Step 3: Add route**

Add router entry:

```rust
.route(
    "/applications/:id/logs/runs/:run_id/debug-stream",
    get(get_runtime_debug_stream),
)
```

Add handler:

```rust
pub async fn get_runtime_debug_stream(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path((id, run_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ApiSuccess<RuntimeDebugStreamResponse>>, ApiError> {
    let context = require_session(&state, &headers).await?;
    ensure_application_visible(&state, context.user.id, id).await?;
    let events = <MainDurableStore as OrchestrationRuntimeRepository>::list_runtime_events(&state.store, run_id, 0).await?;
    let parts = events
        .iter()
        .filter_map(|event| control_plane::runtime_observability::debug_read_model::fold_event_to_debug_part(run_id, event))
        .map(|part| RuntimeDebugStreamPartResponse {
            id: part.id.to_string(),
            flow_run_id: part.flow_run_id.to_string(),
            item_id: part.item_id.map(|value| value.to_string()),
            span_id: part.span_id.map(|value| value.to_string()),
            part_type: part.part_type,
            status: part.status,
            trust_level: part.trust_level.as_str().to_string(),
            payload: part.payload,
        })
        .collect();
    Ok(Json(ApiSuccess::new(RuntimeDebugStreamResponse { parts })))
}
```

- [x] **Step 4: Add API client**

Modify `web/packages/api-client/src/console-application-runtime.ts`:

```ts
export interface RuntimeDebugStreamPart {
  id: string;
  flow_run_id: string;
  item_id?: string | null;
  span_id?: string | null;
  part_type: string;
  status: string;
  trust_level: string;
  payload: unknown;
}

export async function getConsoleRuntimeDebugStream(
  applicationId: string,
  runId: string,
  baseUrl?: string,
): Promise<{ parts: RuntimeDebugStreamPart[] }> {
  return getJson(
    `/api/console/applications/${applicationId}/logs/runs/${runId}/debug-stream`,
    baseUrl,
  );
}
```

Export from `web/packages/api-client/src/index.ts`.

- [x] **Step 5: Run tests**

Run:

```bash
cargo test -p api-server get_runtime_debug_stream_returns_trusted_parts
pnpm --dir web/packages/api-client test
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/apps/api-server/src/routes/applications/application_runtime.rs api/apps/api-server/src/openapi.rs api/apps/api-server/src/_tests/application/application_runtime_routes.rs web/packages/api-client/src/console-application-runtime.ts web/packages/api-client/src/index.ts
git commit -m "feat: expose runtime debug stream api"
```

### Task 3: Add Frontend View Mapper

**Files:**
- Modify: `web/app/src/features/applications/api/runtime.ts`
- Create: `web/app/src/features/applications/lib/runtime-observability/debug-stream-parts.ts`
- Create: `web/app/src/features/applications/_tests/runtime-observability/debug-stream-parts.test.ts`

- [x] **Step 1: Write failing frontend mapper tests**

Create `web/app/src/features/applications/_tests/runtime-observability/debug-stream-parts.test.ts`:

```ts
import { mapRuntimeDebugStreamParts } from '../../lib/runtime-observability/debug-stream-parts';

test('keeps external opaque trust level visible', () => {
  const parts = mapRuntimeDebugStreamParts([
    {
      id: 'part-1',
      flow_run_id: 'run-1',
      item_id: null,
      span_id: null,
      part_type: 'data',
      status: 'created',
      trust_level: 'external_opaque',
      payload: { event_type: 'external_agent_opaque_boundary_marked' },
    },
  ]);

  expect(parts[0]).toMatchObject({
    id: 'part-1',
    type: 'data',
    trustLevel: 'external_opaque',
    isHostFact: false,
  });
});

test('maps host text deltas to stream text parts', () => {
  const parts = mapRuntimeDebugStreamParts([
    {
      id: 'part-1',
      flow_run_id: 'run-1',
      item_id: null,
      span_id: 'span-1',
      part_type: 'text',
      status: 'created',
      trust_level: 'host_fact',
      payload: { payload: { delta: 'hello' } },
    },
  ]);

  expect(parts[0]).toMatchObject({
    text: 'hello',
    isHostFact: true,
  });
});
```

- [x] **Step 2: Implement mapper**

Create `web/app/src/features/applications/lib/runtime-observability/debug-stream-parts.ts`:

```ts
import type { RuntimeDebugStreamPart } from '@1flowbase/api-client';

export interface RuntimeDebugStreamViewPart {
  id: string;
  type: string;
  status: string;
  trustLevel: string;
  isHostFact: boolean;
  text?: string;
  payload: unknown;
}

function readText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const nested = (payload as { payload?: unknown }).payload;
  if (!nested || typeof nested !== 'object') {
    return undefined;
  }
  const value =
    (nested as { delta?: unknown; text?: unknown }).delta ??
    (nested as { delta?: unknown; text?: unknown }).text;
  return typeof value === 'string' ? value : undefined;
}

export function mapRuntimeDebugStreamParts(
  parts: RuntimeDebugStreamPart[],
): RuntimeDebugStreamViewPart[] {
  return parts.map((part) => ({
    id: part.id,
    type: part.part_type,
    status: part.status,
    trustLevel: part.trust_level,
    isHostFact: part.trust_level === 'host_fact',
    text: readText(part.payload),
    payload: part.payload,
  }));
}
```

- [x] **Step 3: Export app API wrapper**

Modify `web/app/src/features/applications/api/runtime.ts`:

```ts
export { getConsoleRuntimeDebugStream } from '@1flowbase/api-client';
export type { RuntimeDebugStreamPart } from '@1flowbase/api-client';
```

- [x] **Step 4: Run frontend tests**

Run:

```bash
pnpm --dir web/app test -- src/features/applications/_tests/runtime-observability/debug-stream-parts.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add web/app/src/features/applications/api/runtime.ts web/app/src/features/applications/lib/runtime-observability/debug-stream-parts.ts web/app/src/features/applications/_tests/runtime-observability/debug-stream-parts.test.ts
git commit -m "feat: map runtime debug stream parts"
```

### Task 4: Verify Legacy Debug Console Compatibility

**Files:**
- Modify: `web/app/src/features/applications/_tests/runtime-observability/runtime-debug-api.test.ts`

- [x] **Step 1: Add compatibility test note**

Create `web/app/src/features/applications/_tests/runtime-observability/runtime-debug-api.test.ts`:

```ts
test('runtime debug read model is additive to legacy application run detail', () => {
  const legacyRoute = '/api/console/applications/app-1/logs/runs/run-1';
  const debugStreamRoute = '/api/console/applications/app-1/logs/runs/run-1/debug-stream';

  expect(legacyRoute).not.toEqual(debugStreamRoute);
  expect(debugStreamRoute.endsWith('/debug-stream')).toBe(true);
});
```

- [x] **Step 2: Run full compatibility tests**

Run:

```bash
cargo test -p api-server application_runtime_routes
pnpm --dir web/app test -- src/features/applications/_tests/runtime-observability/*
pnpm --dir web/app test -- src/features/agent-flow/_tests/debug-console/*
```

Expected:

1. Legacy `ApplicationRunDetail` routes pass.
2. Runtime debug-stream route passes.
3. Existing agent-flow debug console tests pass.

- [x] **Step 3: Commit**

```bash
git add web/app/src/features/applications/_tests/runtime-observability/runtime-debug-api.test.ts
git commit -m "test: verify runtime debug read compatibility"
```

## Self-Review

- UI boundary: The plan keeps AI SDK UI stream out of internal truth source.
- Trust display: Frontend mapper preserves `external_opaque` and `host_fact`.
- Runtime coverage: Part types include text, reasoning, tool input/output, approval, handoff, usage, ledger, error and data.
