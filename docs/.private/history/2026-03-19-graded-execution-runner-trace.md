# 2026-03-19 graded execution runner trace

## 本轮主题

- 继续推进 P0 的 graded execution 主链，把 sandbox-backed tool runner 的 `runner_kind` 暴露到后端 trace、运行事件和前端诊断视图。
- 同时把 sandbox tool runner 的 normalized payload / artifact / runner trace 语义继续接入 `PluginCallResponse -> ToolGateway` 主链，避免强隔离路径重新退回页面侧猜测。

## 已完成

- `PluginExecutionDispatchPlan.as_trace_payload()` 现在会在强隔离 tool path 下输出 `sandbox_runner_kind`。
- `tool.execution.dispatched` 事件与 run view serializer 会透传 `sandbox_runner_kind`。
- run diagnostics 的 tool call badge 现在会直接展示 `runner native-tool` / `runner compat-adapter`。
- sandbox tool runner 返回 normalized `output/content_type/summary/raw_ref/meta/artifact_refs/execution_trace` 时，`PluginCallProxy` 与 `ToolGateway` 会按统一 payload 语义接住。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q`
- `api/.venv/Scripts/uv.exe run ruff check ...changed files`
- `pnpm test`
- `pnpm exec tsc --noEmit`

## 下一步建议

1. 继续把 sandbox runner trace 中更稳定的 contract / phase / artifact 事实收口到 shared run view，而不是让页面读原始 JSON。
2. 把 authoring / preflight 侧的 sandbox readiness 说明进一步对齐 `native-tool` / `compat-adapter` 两种 runner 语义。
3. 评估是否需要把 tool runner 产出的 trace artifact 单独进入 evidence / diagnostics 视图，减少 operator 对原始执行日志的依赖。
