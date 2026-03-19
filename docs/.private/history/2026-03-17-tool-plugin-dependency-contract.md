# 2026-03-17 tool / plugin dependency contract 扩面

## 背景

- 当天前几轮已经把 `sandbox_code` 的 `dependencyMode / builtinPackageSet / dependencyRef / backendExtensions` contract 接到 runtime payload、sandbox backend capability gate 和 definition 校验。
- 但高风险 `tool/plugin` 仍停留在“只认识 execution class / profile / network / filesystem”的阶段：
  - runtime dispatch 不会把 dependency contract 带进 sandbox backend 选择。
  - workflow / workspace starter 保存前也不会基于 dependency contract fail-close。
  - 前端结构化编辑会在 normalize execution 时吞掉这些字段。

## 本轮实现

### 1. 后端 execution policy 与 dispatch 打通 dependency contract

- 更新 `api/app/schemas/workflow_runtime_policy.py`
- 更新 `api/app/services/runtime_execution_policy.py`
- 更新 `api/app/services/plugin_execution_dispatch.py`
- 更新 `api/app/services/plugin_runtime_types.py`
- 更新 `api/app/services/tool_execution_events.py`

完成内容：

- `WorkflowNodeExecutionPolicy` 正式支持：
  - `dependencyMode`
  - `builtinPackageSet`
  - `dependencyRef`
  - `backendExtensions`
- 运行时 `ResolvedExecutionPolicy` 会把这些字段解析进 node run input / tool call payload，并回写到 runtime payload。
- native tool 与 compat adapter 的 dispatch planner 在 `sandbox / microvm` 路径下，会把 dependency contract 一并交给 `describe_tool_execution_backend()` 做 capability gate。
- tool execution trace 事件现在会显式记录 dependency contract 摘要，不再只有 execution class。

### 2. 保存前校验补上 dependency-aware fail-close

- 更新 `api/app/services/workflow_tool_execution_validation.py`

完成内容：

- tool 节点 `runtimePolicy.execution`
- agent `toolPolicy.execution`
- agent `mockPlan.toolCalls[*].execution`

这些路径在显式请求 `sandbox / microvm` 时，现在不仅检查 backend 是否支持 execution class，也会继续检查：

- backend 是否支持请求的 `dependencyMode`
- `builtinPackageSet` 是否要求 builtin package hint 能力
- `backendExtensions` 是否要求 backend extension payload 能力

这样 definition 可以在保存前就诚实失败，而不是运行时才暴露“隔离执行体不兼容”。

### 3. 前端保真与本地 preflight 同步

- 更新 `web/lib/workflow-runtime-policy.ts`
- 更新 `web/components/workflow-node-config-form/runtime-policy-helpers.ts`
- 更新 `web/components/workflow-node-config-form/llm-agent-tool-policy-form.tsx`
- 更新 `web/lib/workflow-tool-execution-validation.ts`
- 更新 `web/lib/workflow-tool-execution-validation-helpers.ts`
- 更新 `web/lib/workflow-tool-execution-validation-types.ts`

完成内容：

- execution policy 类型正式纳入 dependency contract 字段。
- 结构化编辑在修改 class / profile / timeout / network / filesystem 时，不会再把已有 dependency contract 静默吞掉。
- 本地 tool execution preflight 也会基于 `sandboxReadiness` 聚合能力，对 dependency mode / builtin package set / backendExtensions 给出阻断提示。

## 验证

- 定向后端测试：
  - `api/.venv/Scripts/uv.exe run pytest -q tests/test_plugin_runtime.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
  - 结果：`109 passed`
- 后端全量测试：
  - `api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`373 passed`
- 后端 lint：
  - `api/.venv/Scripts/uv.exe run ruff check app/schemas/workflow_runtime_policy.py app/services/runtime_execution_policy.py app/services/plugin_execution_dispatch.py app/services/plugin_runtime_types.py app/services/tool_execution_events.py app/services/workflow_tool_execution_validation.py tests/test_plugin_runtime.py tests/test_runtime_service.py tests/test_runtime_service_agent_runtime.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
  - 结果：通过
- 前端类型与 lint：
  - `web/pnpm exec tsc --noEmit`
  - `web/pnpm lint`
  - 结果：通过

## 影响判断

- 这轮继续推进的是 **graded execution / 强隔离主链**，不是局部 polish。
- `sandbox_code` 与高风险 `tool/plugin` 现在开始共享同一套 dependency-aware backend gate，execution contract 不再只在代码节点兑现。
- editor 结构化表单与本地 preflight 口径也更接近后端真实语义，减少“保存后字段丢失”或“后端挡住但前端没提示”的偏差。

## 下一步建议

1. 把同一套 dependency-aware execution trace 补到 run diagnostics 展示层，让 operator 能直接看见 tool execution 的 dependency contract 与 backend block reason。
2. 回到 `WAITING_CALLBACK` durable resume / operator follow-up 主线，继续补厚 callback waiting、resume 调度与跨入口 blocker explanation。
3. 继续推进高风险 native tool / plugin 的 profile 与 dependency governance，可再评估是否需要在 editor 中暴露受控填写入口，而不仅是保真与 preflight。
