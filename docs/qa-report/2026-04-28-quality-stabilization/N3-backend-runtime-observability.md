# N3 后端 Runtime 契约与 Observability 报告

## 范围

涉及区域：

- `api/crates/orchestration-runtime/src/execution_engine.rs`
- `api/crates/control-plane/src/runtime_observability.rs`
- `api/crates/control-plane/src/orchestration_runtime/live_debug_run.rs`
- `api/crates/control-plane/src/orchestration_runtime/persistence.rs`
- `api/apps/api-server/src/routes/applications/application_runtime.rs`
- `api/apps/plugin-runner/tests/provider_runtime_routes.rs`

## 问题

本轮后端发现三类质量问题：

- LLM runtime 输出无条件包含 `structured_output: null`，对纯文本输出契约造成噪声。
- `append_host_span` 参数过长，调用点容易漂移，也触发 clippy 复杂度约束。
- `plugin-runner` 测试临时目录只使用纳秒时间戳，并发下存在碰撞窗口。

## 修复

- 移除 `structured_output: null` 的无条件写入。
- 新增 `AppendHostSpanInput`，将 span 写入参数收拢为结构体。
- 更新 live debug run 和 persistence 调用点。
- 为 `plugin-runner` 测试临时目录加入 `process id + atomic sequence`。
- 同步修正 clippy 暴露的复杂类型和嵌套条件。

## 关键收益

- runtime 输出契约更干净，减少消费者对 null 字段的错误依赖。
- observability 写入入口更稳定，参数新增或变更更容易审查。
- 后端测试并发稳定性提升。
- `cargo clippy -D warnings` 可通过，降低质量门禁噪声。

## 验证

已通过：

- `cargo fmt --all --check`
- `cargo check --workspace --jobs 2`
- `cargo clippy --workspace --all-targets --jobs 2 -- -D warnings`
- `cargo test --workspace --jobs 2 -- --test-threads=2`
- 定向 runtime 测试：
  - `llm_runtime_sends_enabled_model_parameters_and_keeps_text_output_for_json_schema`
- 定向 plugin-runner 测试：
  - `cargo test -p plugin-runner --test provider_runtime_routes -- --test-threads=2`

## 残留风险

无 Blocking / High 风险。

Low：

- 本轮没有扩展 runtime 输出契约文档，仅修正代码和测试。后续如建立公开 runtime schema，应把 `structured_output` 的出现条件写入契约文档。

