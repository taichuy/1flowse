# 2026-03-16 compat execution blocked trace 补链

## 背景

- 上一轮已经把 compat adapter 对显式 unsupported execution class 的行为从静默 fallback 收紧为 fail-closed。
- 但阻断原因当时主要停留在异常文案里，run trace / diagnostics 里缺少结构化事件，operator 只能从节点失败文案反推发生了什么。

## 目标

- 把 compat execution fail-closed 的阻断原因补回统一 runtime 事件流。
- 保持现有 fail-closed 语义不变，不把这轮工作扩大成新的 execution policy 设计。

## 实现

- 为 `WorkflowExecutionError` 增加 `metadata` 和 `runtime_events`，允许底层执行错误把结构化上下文往上游透传。
- 在 `api/app/services/tool_execution_events.py` 新增复用 helper，统一构造：
  - `tool.execution.dispatched`
  - `tool.execution.blocked`
  - `tool.execution.fallback`
- 在 `api/app/services/tool_gateway.py` 捕获 compat adapter 的 `PluginInvocationError` 时，把 execution trace 转成 `runtime_events` 附着到 `WorkflowExecutionError`，不再只抛字符串异常。
- 在 `api/app/services/agent_runtime.py` 中，当 agent 走 fallback output 路径时，先把这些 runtime events 合并进节点事件流。
- 在 `api/app/services/runtime_execution_progress_support.py` 中，当节点最终失败时，也会把异常携带的 runtime events 写入 `run_events`，避免失败路径丢失 execution trace。

## 影响范围

- compat tool 因 execution class 不受支持而被 host 侧阻断时，run trace 现在会稳定保留 `tool.execution.dispatched` + `tool.execution.blocked`。
- 这让 diagnostics / operator explanation 能直接消费结构化事件，而不是继续依赖字符串错误消息解析。
- 当前改动不改变 native tool 的 inline fallback 行为，也不替代真实 `sandbox / microvm` backend。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_service_agent_runtime.py -k compat`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_service.py tests/test_plugin_runtime.py`

## 下一步

- 把 `tool.execution.blocked` 继续聚合进 run diagnostics 的 execution summary / node card，而不只停留在 trace 事件列表。
- 继续推进真实 `sandbox / microvm` backend，让 `blocked` 不只是“诚实失败”，还能逐步变成“有后续承载能力的治理入口”。
