# 2026-03-16 compat adapter 显式 execution class fail-closed

## 背景

- `docs/dev/runtime-foundation.md` 的 `P0` 已明确指出：当前 graded execution 已具备 execution-aware contract、trace 和部分 capability guard，但 compat adapter 在声明不支持某个 execution class 时，仍会静默回落到首个支持项。
- 这种行为不利于后续把高风险 `tool/plugin` 收口到真实隔离能力，也会让运行轨迹看起来“诚实”，但实际执行语义仍带有隐式降级。

## 目标

- 先把 compat adapter 的显式隔离请求收紧到更诚实的语义：当 `tool_call / tool_policy / runtime_policy` 显式请求非 `inline` 的 execution class，而 adapter 不支持时，不再静默 fallback。
- 保持当前 `worker-first` 的演进节奏，不把 native tool 主链一并改成强制 fail-closed，避免一次性扩大行为面。

## 实现

- 在 `api/app/services/plugin_runtime_types.py` 的 `PluginExecutionDispatchPlan` 新增 `blocked_reason`，让 execution dispatch 同时表达“是否回退”和“是否必须阻断”。
- 在 `api/app/services/plugin_execution_dispatch.py` 中收紧 compat adapter dispatch 规则：
  - 默认执行仍保持现状。
  - 只有在 `tool_call / tool_policy / runtime_policy` 显式请求非 `inline` execution class，且 adapter 不支持时，才生成 `blocked_reason`。
  - 这类请求不再写入 fallback reason，而是要求调用侧 fail-closed。
- 在 `api/app/services/plugin_runtime_proxy.py` 中，当 dispatch plan 带有 `blocked_reason` 时，直接抛出 `PluginInvocationError`，避免继续向 adapter 发送已知不满足隔离约束的调用。
- 保持 native tool 现状：仍记录 `tool.execution.fallback`，不在本轮改变既有 inline fallback 行为。

## 影响范围

- compat adapter 的显式 isolation 请求从“静默回退”变为“明确失败”，更贴近后续 capability-driven 隔离语义。
- `tool_call` / `tool_policy` / `runtime_policy` 对 execution class 的表达变得更可信，后续可以在 UI、run diagnostics 和 operator explanation 上继续承接 `blocked_reason`。
- native tool 仍是当前架构缺口之一：高风险 native tool 还没有统一的 capability-driven fail-closed，本轮未扩大到这条主线。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_plugin_runtime.py`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_service.py tests/test_runtime_service_agent_runtime.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `api/.venv/Scripts/uv.exe run ruff check app/services/plugin_execution_dispatch.py app/services/plugin_runtime_proxy.py app/services/plugin_runtime_types.py tests/test_plugin_runtime.py tests/test_runtime_service.py tests/test_runtime_service_agent_runtime.py`

## 下一步

- 继续把 `blocked_reason` 纳入 tool execution trace / diagnostics 的 operator explanation，而不只停留在异常文案。
- 继续推进 `P0`：为 compat tool 提供真实 `sandbox / microvm` backend，再评估 native tool 的高风险分级与 fail-closed 条件。
