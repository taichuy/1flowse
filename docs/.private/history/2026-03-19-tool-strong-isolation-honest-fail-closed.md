# 2026-03-19 tool 强隔离诚实 fail-closed

## 本轮主题

- 沿 `docs/.private/runtime-foundation.md` 的 `P0 graded execution` 主线，继续收紧高风险执行路径。
- 当前代码虽然已经能给 native tool / compat adapter 生成 `sandbox / microvm` dispatch trace，但真实执行仍停留在 host / adapter 边界，属于“名义强隔离”。本轮优先把这段不诚实链路改成 fail-closed。

## 已完成

- `api/app/services/runtime_execution_adapters.py`
  - Runtime node availability 对 `tool` 节点的 `sandbox / microvm` 请求改成直接 unavailable，不再走 inline fallback 或继续假装可执行。
- `api/app/services/plugin_execution_dispatch.py`
  - Plugin dispatch planner 对 native / compat tool 的强隔离请求统一返回 blocked reason，即使 backend 健康、tool / adapter 自身声明支持，也不再把 host / adapter 调用误写成已隔离执行。
- `api/app/services/workflow_tool_execution_validation.py`
  - workflow 保存与 workspace starter 保存现在会在 authoring 阶段直接阻断这类不可兑现的强隔离 tool 路径，避免继续把问题留到真实 run 时才暴露。
- `api/app/services/run_execution_focus_explanations.py`
  - 新增 tool 强隔离未兑现的 canonical blocker explanation，run diagnostics / publish detail / operator follow-up 后续可继续复用同一口径。
- `docs/technical-design-supplement.md`
  - 把 compat/tool 强隔离一节改成“当前共享事实 + 目标方向”双轨表述，明确当前尚未落地 sandbox tool runner。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_plugin_runtime.py tests/test_run_execution_focus_explanations.py tests/test_runtime_service.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `git diff --check`

## 为什么做这轮

- 这不是局部重构或文案整理，而是把 runtime / authoring / operator 三条链上的一个共享不诚实事实收掉：如果继续让 dispatch trace 写着 `sandbox / microvm`，实际却仍从 host / adapter 执行，就会持续污染治理、排障和后续真实 sandbox 落地。
- 收紧后，虽然当前能力边界更保守，但系统对人和对 AI 都更可理解：哪些路径是真的已实现，哪些只是目标方向，不再混在一起。

## 下一步建议

1. 优先补齐真正的 sandbox tool runner 或等价执行面，让 native / compat tool 强隔离从 fail-closed 进入“真实可执行”。
2. 在 publish detail / run detail / operator result 中继续复用这次新增的 tool blocker explanation，确认所有入口都不再自己拼“backend 可用所以应该能跑”的 copy。
3. 等 tool runner 方向明确后，再回头梳理 `supportedExecutionClasses` 与 sandbox backend capability 的共享 contract，避免文档和实现再次漂移。
