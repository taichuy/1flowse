# 2026-03-19 tool sandbox runner timeout

## 本轮主题

- 延续 graded execution / 强隔离主链，收口 compat tool/plugin 通过 sandbox backend 执行时的真实调用契约。
- 当前工作区已有一组围绕 sandbox-backed tool execution 的未提交改动，本轮不改题，优先把这条主链补成可验证的稳定中间态。

## 本轮新增修正

- `PluginCallProxy` 在 compat adapter 走 sandbox tool runner 时，改为优先透传 `execution.timeoutMs`，不再错误回落到 `PluginCallRequest.timeout_ms` 默认值 `30000`。
- 顺手清理本批改动引入的 `ruff` 问题，确保这条 runtime 主线在测试和静态检查层都可交付。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_plugin_runtime.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
- `api/.venv/Scripts/uv.exe run ruff check app/services/plugin_execution_dispatch.py app/services/plugin_runtime_proxy.py app/services/runtime_execution_adapters.py app/services/sandbox_backends.py app/services/workflow_tool_execution_validation.py tests/test_plugin_runtime.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`

## 下一步

1. 继续补真正的 sandbox tool runner / backend 执行面，不让当前 contract 只停留在 proxy 与 validation 层。
2. 把同类 execution contract 与 blocker explanation 继续统一到 publish detail / operator result 等共享解释入口。
3. 在 editor preflight 与 run diagnostics 中继续压平 compat tool / native tool 的 execution readiness 差异。
