# 2026-03-19 tool call execution trace diagnostics

## 本轮主题

- 把 strong-isolation tool runner 的执行事实从 `ToolGateway` 持久化到 `ToolCallRecord`，并打通到 run diagnostics 的 tool calls 视图。

## 已完成

- `api/app/models/run.py`
  - 为 `ToolCallRecord` 增加 `execution_trace` JSON 字段。
- `api/app/services/tool_gateway.py`
  - 在 tool 调用前把 `describe_execution_dispatch(...).as_trace_payload()` 落到 `ToolCallRecord.execution_trace`。
- `api/app/services/run_view_serializers.py` / `api/app/schemas/run.py`
  - 将 tool call 的 requested/effective execution class、backend、blocked/fallback reason 与原始 `execution_trace` 暴露到 API。
- `web/lib/get-run-views.ts` / `web/components/run-diagnostics-execution/execution-node-card-sections.tsx`
  - tool calls 卡片现在直接展示 execution badges、blocked/fallback 文案，并保留完整 `execution_trace` JSON。
- `api/migrations/versions/20260319_0026_tool_call_execution_trace.py`
  - 补上持久化迁移。

## 验证

- `api/.venv/Scripts/uv.exe run ruff check app/models/run.py app/services/tool_gateway.py app/schemas/run.py app/services/run_view_serializers.py tests/test_runtime_service.py tests/test_run_view_routes.py tests/test_run_routes.py migrations/versions/20260319_0026_tool_call_execution_trace.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm test`
- `web/pnpm lint`

## 结果判断

- 这轮推进的是 graded execution / strong-isolation 主链，不是样式整理。
- 当前 run diagnostics 已能在 tool call 粒度看到这次调用是否请求强隔离、最终落到哪个 backend，以及为什么 fallback / blocked。

## 下一步建议

1. 继续把 sandbox tool runner 的 payload / artifact / trace 语义做成更统一的 contract，而不只持久化 dispatch trace。
2. 把 tool-call 级 execution trace 进一步接入 operator follow-up / run snapshot 的 canonical explanation，减少 node 级摘要与 tool-call 事实之间的跳转。
3. 如后端开始提供更细粒度 runner telemetry，再决定是否把 `execution_trace` 分解为可聚合字段或二级 trace event。
