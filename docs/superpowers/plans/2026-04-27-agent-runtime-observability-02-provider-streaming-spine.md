# Provider Streaming Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 provider runtime 从一次性 stdout envelope 升级为 stdio v2 NDJSON streaming，并把 provider raw events 进入 runtime event bus、delta coalescer 和 durable writer。

**Architecture:** `validate/list_models` 继续使用现有 single envelope；`invoke` 使用逐行 NDJSON。每行解析成 `ProviderRuntimeLine`，`result` 行关闭一次 invocation，text/reasoning delta 经 coalescer 后写入 fact spine，bad JSON、stderr、timeout、kill 都归一化为 provider runtime error。

**Tech Stack:** Rust 2021、Tokio process/io、Serde、plugin-framework、plugin-runner、observability crate

---

## File Structure

- Modify: `api/crates/plugin-framework/src/provider_contract.rs`
- Modify: `api/apps/plugin-runner/src/stdio_runtime.rs`
- Modify: `api/apps/plugin-runner/src/provider_host.rs`
- Create: `api/apps/plugin-runner/tests/provider_stdio_streaming_tests.rs`
- Modify: `api/crates/observability/Cargo.toml`
- Modify: `api/crates/observability/src/lib.rs`
- Create: `api/crates/observability/src/event_bus.rs`
- Create: `api/crates/observability/src/delta_coalescer.rs`
- Create: `api/crates/observability/src/_tests/mod.rs`
- Create: `api/crates/observability/src/_tests/delta_coalescer_tests.rs`
- Modify: `api/apps/api-server/src/provider_runtime.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime/persistence.rs`

### Task 1: Add ProviderRuntimeLine Contract

**Files:**
- Modify: `api/crates/plugin-framework/src/provider_contract.rs`

- [x] **Step 1: Add contract test**

Append a unit test in `api/crates/plugin-framework/src/provider_contract.rs`:

```rust
#[cfg(test)]
mod provider_runtime_line_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn provider_runtime_line_result_is_not_a_stream_event() {
        let line = ProviderRuntimeLine::Result {
            result: ProviderInvocationResult {
                final_content: Some("hello".into()),
                ..ProviderInvocationResult::default()
            },
        };

        assert_eq!(line.into_stream_event(), None);
    }

    #[test]
    fn provider_runtime_line_text_maps_to_stream_event() {
        let line = ProviderRuntimeLine::TextDelta { delta: "hello".into() };

        assert_eq!(
            line.into_stream_event(),
            Some(ProviderStreamEvent::TextDelta { delta: "hello".into() })
        );
    }

    #[test]
    fn provider_runtime_line_tool_commit_preserves_arguments() {
        let line = ProviderRuntimeLine::ToolCallCommit {
            call: ProviderToolCall {
                id: "call-1".into(),
                name: "lookup_order".into(),
                arguments: json!({ "order_id": "A-1" }),
            },
        };

        assert!(matches!(line.into_stream_event(), Some(ProviderStreamEvent::ToolCallCommit { .. })));
    }
}
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p plugin-framework provider_runtime_line
```

Expected: FAIL because `ProviderRuntimeLine` does not exist.

- [x] **Step 3: Implement `ProviderRuntimeLine`**

Add to `api/crates/plugin-framework/src/provider_contract.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ProviderRuntimeLine {
    TextDelta { delta: String },
    ReasoningDelta { delta: String },
    ToolCallDelta { call_id: String, delta: Value },
    ToolCallCommit { call: ProviderToolCall },
    McpCallDelta { call_id: String, delta: Value },
    McpCallCommit { call: ProviderMcpCall },
    UsageDelta { usage: ProviderUsage },
    UsageSnapshot { usage: ProviderUsage },
    Finish { reason: ProviderFinishReason },
    Error { error: ProviderRuntimeError },
    Result { result: ProviderInvocationResult },
}

impl ProviderRuntimeLine {
    pub fn into_stream_event(self) -> Option<ProviderStreamEvent> {
        match self {
            Self::TextDelta { delta } => Some(ProviderStreamEvent::TextDelta { delta }),
            Self::ReasoningDelta { delta } => Some(ProviderStreamEvent::ReasoningDelta { delta }),
            Self::ToolCallDelta { call_id, delta } => Some(ProviderStreamEvent::ToolCallDelta { call_id, delta }),
            Self::ToolCallCommit { call } => Some(ProviderStreamEvent::ToolCallCommit { call }),
            Self::McpCallDelta { call_id, delta } => Some(ProviderStreamEvent::McpCallDelta { call_id, delta }),
            Self::McpCallCommit { call } => Some(ProviderStreamEvent::McpCallCommit { call }),
            Self::UsageDelta { usage } => Some(ProviderStreamEvent::UsageDelta { usage }),
            Self::UsageSnapshot { usage } => Some(ProviderStreamEvent::UsageSnapshot { usage }),
            Self::Finish { reason } => Some(ProviderStreamEvent::Finish { reason }),
            Self::Error { error } => Some(ProviderStreamEvent::Error { error }),
            Self::Result { .. } => None,
        }
    }
}
```

- [x] **Step 4: Run test**

Run:

```bash
cargo test -p plugin-framework provider_runtime_line
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/plugin-framework/src/provider_contract.rs
git commit -m "feat: add provider runtime ndjson line contract"
```

### Task 2: Implement Stdio V2 NDJSON Invoke

**Files:**
- Modify: `api/apps/plugin-runner/src/stdio_runtime.rs`
- Modify: `api/apps/plugin-runner/src/provider_host.rs`
- Create: `api/apps/plugin-runner/tests/provider_stdio_streaming_tests.rs`

- [x] **Step 1: Write failing streaming tests**

Create `api/apps/plugin-runner/tests/provider_stdio_streaming_tests.rs`:

```rust
use std::{fs, path::PathBuf};

use plugin_framework::{provider_contract::ProviderStdioRequest, PluginRuntimeLimits};

fn write_script(name: &str, body: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("provider-stdio-v2-{}-{name}", uuid::Uuid::now_v7()));
    fs::create_dir_all(&root).unwrap();
    let script = root.join("provider.sh");
    fs::write(&script, body).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&script).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script, permissions).unwrap();
    }
    script
}

fn invoke_request() -> ProviderStdioRequest {
    ProviderStdioRequest {
        method: plugin_framework::provider_contract::ProviderStdioMethod::Invoke,
        input: serde_json::json!({ "model": "fixture" }),
    }
}

fn limits() -> PluginRuntimeLimits {
    PluginRuntimeLimits {
        timeout_ms: Some(2_000),
        memory_bytes: None,
    }
}

#[tokio::test]
async fn provider_stdio_v2_reads_ndjson_stream_until_result() {
    let script = write_script("success", r#"#!/usr/bin/env bash
read _request
printf '%s\n' '{"type":"text_delta","delta":"hel"}'
printf '%s\n' '{"type":"text_delta","delta":"lo"}'
printf '%s\n' '{"type":"usage_snapshot","usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}'
printf '%s\n' '{"type":"finish","reason":"stop"}'
printf '%s\n' '{"type":"result","result":{"final_content":"hello","usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3},"finish_reason":"stop"}}'
"#);

    let output = plugin_runner::stdio_runtime::call_executable_streaming(&script, &invoke_request(), &limits())
        .await
        .unwrap();

    assert_eq!(output.events.len(), 4);
    assert_eq!(output.result.final_content.as_deref(), Some("hello"));
}

#[tokio::test]
async fn provider_stdio_v2_rejects_bad_json_line() {
    let script = write_script("bad-json", r#"#!/usr/bin/env bash
read _request
printf '%s\n' '{not-json'
"#);

    let error = plugin_runner::stdio_runtime::call_executable_streaming(&script, &invoke_request(), &limits())
        .await
        .unwrap_err();

    assert!(error.to_string().contains("invalid provider ndjson"));
}
```

- [x] **Step 2: Run failing tests**

Run:

```bash
cargo test -p plugin-runner provider_stdio_v2
```

Expected: FAIL because `call_executable_streaming` does not exist.

- [x] **Step 3: Implement streaming function**

In `api/apps/plugin-runner/src/stdio_runtime.rs`, add imports:

```rust
use tokio::io::{AsyncBufReadExt, BufReader};
use plugin_framework::provider_contract::{
    ProviderInvocationResult, ProviderRuntimeLine, ProviderStreamEvent,
};
```

Add:

```rust
pub struct StreamingProviderOutput {
    pub events: Vec<ProviderStreamEvent>,
    pub result: ProviderInvocationResult,
}

pub async fn call_executable_streaming(
    executable_path: &Path,
    request: &ProviderStdioRequest,
    limits: &PluginRuntimeLimits,
) -> FrameworkResult<StreamingProviderOutput> {
    let mut command = Command::new(executable_path);
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    apply_memory_limit(&mut command, limits.memory_bytes)?;

    let mut child = command
        .spawn()
        .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;

    if let Some(mut stdin) = child.stdin.take() {
        let mut payload = serde_json::to_vec(request)
            .map_err(|error| PluginFrameworkError::serialization(None, error.to_string()))?;
        payload.push(b'\n');
        stdin.write_all(&payload).await
            .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;
    }

    let stdout = child.stdout.take().ok_or_else(|| {
        PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "provider_runtime",
            "provider runtime stdout was not captured",
            None,
        ))
    })?;
    let stderr = child.stderr.take();
    let mut lines = BufReader::new(stdout).lines();
    let mut events = Vec::new();
    let mut result = None;

    let read_future = async {
        while let Some(line) = lines.next_line().await
            .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?
        {
            if line.trim().is_empty() {
                continue;
            }
            let runtime_line = serde_json::from_str::<ProviderRuntimeLine>(&line).map_err(|error| {
                PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
                    "invalid_provider_ndjson",
                    format!("invalid provider ndjson: {error}"),
                    Some(&line),
                ))
            })?;
            match runtime_line {
                ProviderRuntimeLine::Result { result: value } => result = Some(value),
                other => {
                    if let Some(event) = other.into_stream_event() {
                        events.push(event);
                    }
                }
            }
        }
        FrameworkResult::Ok(())
    };

    tokio::time::timeout(Duration::from_millis(limits.timeout_ms.unwrap_or(30_000)), read_future)
        .await
        .map_err(|_| PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "invoke",
            "provider runtime timed out",
            None,
        )))??;

    let output = child.wait().await
        .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;
    if !output.success() {
        let stderr_text = if let Some(stderr) = stderr {
            let mut reader = BufReader::new(stderr);
            let mut text = String::new();
            let _ = reader.read_line(&mut text).await;
            text
        } else {
            String::new()
        };
        return Err(PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "provider_runtime",
            if stderr_text.trim().is_empty() { "provider runtime exited with failure" } else { stderr_text.trim() },
            None,
        )));
    }

    let result = result.ok_or_else(|| {
        PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "provider_runtime",
            "provider runtime ended without result line",
            None,
        ))
    })?;

    Ok(StreamingProviderOutput { events, result })
}
```

If the compiler complains about moved stderr, simplify by reading stderr after `wait_with_output` in a follow-up refactor; the test target is stdout NDJSON behavior.

- [x] **Step 4: Wire invoke path**

Modify `api/apps/plugin-runner/src/provider_host.rs` so `invoke_stream` calls `call_executable_streaming`, while `validate` and `list_models` keep `call_executable`.

- [x] **Step 5: Run tests**

Run:

```bash
cargo test -p plugin-runner provider_stdio_v2
cargo test -p api-server provider_runtime
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/apps/plugin-runner/src/stdio_runtime.rs api/apps/plugin-runner/src/provider_host.rs api/apps/plugin-runner/tests/provider_stdio_streaming_tests.rs
git commit -m "feat: stream provider invoke over stdio v2"
```

### Task 3: Add Runtime Event Bus And Delta Coalescer

**Files:**
- Modify: `api/crates/observability/Cargo.toml`
- Modify: `api/crates/observability/src/lib.rs`
- Create: `api/crates/observability/src/event_bus.rs`
- Create: `api/crates/observability/src/delta_coalescer.rs`
- Create: `api/crates/observability/src/_tests/mod.rs`
- Create: `api/crates/observability/src/_tests/delta_coalescer_tests.rs`

- [x] **Step 1: Write failing coalescer tests**

Create `api/crates/observability/src/_tests/delta_coalescer_tests.rs`:

```rust
use observability::{DeltaCoalescer, RuntimeBusEvent};

#[test]
fn coalesces_text_until_limit() {
    let mut coalescer = DeltaCoalescer::new(12);

    assert!(coalescer.push_text("hello ").is_none());
    let event = coalescer.push_text("world!").unwrap();

    assert_eq!(event, RuntimeBusEvent::TextDelta { delta: "hello world!".into() });
}

#[test]
fn flushes_reasoning_delta_explicitly() {
    let mut coalescer = DeltaCoalescer::new(100);

    assert!(coalescer.push_reasoning("thinking").is_none());
    assert_eq!(
        coalescer.flush_reasoning(),
        Some(RuntimeBusEvent::ReasoningDelta { delta: "thinking".into() })
    );
}
```

Create `api/crates/observability/src/_tests/mod.rs`:

```rust
mod delta_coalescer_tests;
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p observability delta_coalescer
```

Expected: FAIL because observability primitives do not exist.

- [x] **Step 3: Add crate dependencies**

Modify `api/crates/observability/Cargo.toml`:

```toml
[dependencies]
domain = { path = "../domain" }
serde.workspace = true
serde_json.workspace = true
tokio.workspace = true
uuid.workspace = true
```

- [x] **Step 4: Implement bus and coalescer**

Create `api/crates/observability/src/event_bus.rs`:

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuntimeBusEvent {
    SpanStarted { span_id: Uuid, kind: String, name: String },
    SpanFinished { span_id: Uuid, status: String },
    TextDelta { delta: String },
    ReasoningDelta { delta: String },
    RuntimeEvent { event_type: String, payload: Value },
    LedgerRef { ledger_ref: String },
    Error { message: String, payload: Value },
}

#[derive(Clone)]
pub struct RuntimeEventBus {
    sender: tokio::sync::broadcast::Sender<RuntimeBusEvent>,
}

impl RuntimeEventBus {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = tokio::sync::broadcast::channel(capacity);
        Self { sender }
    }

    pub fn publish(&self, event: RuntimeBusEvent) {
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<RuntimeBusEvent> {
        self.sender.subscribe()
    }
}
```

Create `api/crates/observability/src/delta_coalescer.rs`:

```rust
use crate::RuntimeBusEvent;

#[derive(Debug, Clone)]
pub struct DeltaCoalescer {
    max_bytes: usize,
    text: String,
    reasoning: String,
}

impl DeltaCoalescer {
    pub fn new(max_bytes: usize) -> Self {
        Self { max_bytes, text: String::new(), reasoning: String::new() }
    }

    pub fn push_text(&mut self, delta: &str) -> Option<RuntimeBusEvent> {
        self.text.push_str(delta);
        if self.text.len() >= self.max_bytes { self.flush_text() } else { None }
    }

    pub fn push_reasoning(&mut self, delta: &str) -> Option<RuntimeBusEvent> {
        self.reasoning.push_str(delta);
        if self.reasoning.len() >= self.max_bytes { self.flush_reasoning() } else { None }
    }

    pub fn flush_text(&mut self) -> Option<RuntimeBusEvent> {
        if self.text.is_empty() { return None; }
        Some(RuntimeBusEvent::TextDelta { delta: std::mem::take(&mut self.text) })
    }

    pub fn flush_reasoning(&mut self) -> Option<RuntimeBusEvent> {
        if self.reasoning.is_empty() { return None; }
        Some(RuntimeBusEvent::ReasoningDelta { delta: std::mem::take(&mut self.reasoning) })
    }
}
```

Modify `api/crates/observability/src/lib.rs`:

```rust
pub mod delta_coalescer;
pub mod event_bus;

pub use delta_coalescer::DeltaCoalescer;
pub use event_bus::{RuntimeBusEvent, RuntimeEventBus};

#[cfg(test)]
mod _tests;
```

- [x] **Step 5: Run tests**

Run:

```bash
cargo test -p observability
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add api/crates/observability
git commit -m "feat: add provider stream event bus"
```

### Task 4: Keep Provider Boundary Narrow In Persistence

**Files:**
- Modify: `api/crates/control-plane/src/orchestration_runtime/persistence.rs`
- Modify: `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`

- [x] **Step 1: Write failing boundary test**

Add to `api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs`:

```rust
#[tokio::test]
async fn provider_tool_commit_is_recorded_as_intent_not_execution() {
    let harness = super::support::runtime_harness_with_provider_events(vec![
        plugin_framework::provider_contract::ProviderStreamEvent::ToolCallCommit {
            call: plugin_framework::provider_contract::ProviderToolCall {
                id: "call-1".into(),
                name: "lookup_order".into(),
                arguments: serde_json::json!({ "order_id": "A-1" }),
            },
        },
    ]).await;

    let detail = harness.start_basic_flow_debug_run().await;
    let events = harness.repository.list_runtime_events(detail.flow_run.id, 0).await.unwrap();

    assert!(events.iter().any(|event| {
        event.event_type == "capability_call_requested"
            && event.layer == domain::RuntimeEventLayer::Capability
            && event.payload["provider_only_intent"] == serde_json::json!(true)
    }));
}
```

- [x] **Step 2: Run failing boundary test**

Run:

```bash
cargo test -p control-plane provider_tool_commit_is_recorded_as_intent_not_execution
```

Expected: FAIL because provider tool commits are currently persisted only as provider events.

- [x] **Step 3: Add capability intent event for provider commits**

In `api/crates/control-plane/src/orchestration_runtime/persistence.rs`, inside `append_provider_stream_events`, add:

```rust
match event {
    ProviderStreamEvent::ToolCallCommit { call } => {
        crate::runtime_observability::append_host_event(
            repository,
            flow_run_id,
            node_run_id,
            None,
            "capability_call_requested",
            domain::RuntimeEventLayer::Capability,
            json!({
                "capability_id": format!("host_tool:model:{}@runtime", call.name),
                "requested_by": "model",
                "provider_only_intent": true,
                "call": call,
            }),
        ).await?;
    }
    ProviderStreamEvent::McpCallCommit { call } => {
        crate::runtime_observability::append_host_event(
            repository,
            flow_run_id,
            node_run_id,
            None,
            "capability_call_requested",
            domain::RuntimeEventLayer::Capability,
            json!({
                "capability_id": format!("mcp_tool:mcp:{}:{}@runtime", call.server, call.method),
                "requested_by": "model",
                "provider_only_intent": true,
                "call": call,
            }),
        ).await?;
    }
    _ => {}
}
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane provider_tool_commit_is_recorded_as_intent_not_execution
cargo test -p control-plane orchestration_runtime
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/crates/control-plane/src/orchestration_runtime/persistence.rs api/crates/control-plane/src/_tests/orchestration_runtime/runtime_observability.rs
git commit -m "feat: record provider capability intent boundary"
```
