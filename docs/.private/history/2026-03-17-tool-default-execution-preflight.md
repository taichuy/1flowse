# 2026-03-17 tool default execution preflight

## 背景

- `docs/dev/runtime-foundation.md` 在上一轮已经把 `plugin_tools.supported_execution_classes / default_execution_class` 持久化为真实事实，并把默认 execution payload 接回 native invoker / compat adapter 主链。
- 继续复核后发现仍有一个作者侧断点：保存前校验主要只覆盖显式 `runtimePolicy.execution` / `toolPolicy.execution`。当 tool 自己的 `default_execution_class` 指向 `sandbox / microvm` 时，workflow author 仍可能把 tool node、`llm_agent.toolPolicy.allowedToolIds` 或 `mockPlan.toolCalls` 保存成功，直到 runtime 才因 backend readiness 不足被 fail-closed。
- 这会让“tool contract 已声明默认强隔离”与“作者保存前能否感知 readiness gap”之间继续断层，不利于可靠性和安全链路前移。

## 目标

- 把默认 `sandbox / microvm` tool 的 readiness gap 从 runtime honesty 前移到 definition honesty。
- 让 workflow / workspace starter 持久化链路与 editor 本地 preflight 都能在 tool default execution 不可兑现时直接阻断保存。
- 继续保持显式 execution target 与默认 execution target 的语义分层：显式声明仍走原有校验链，默认强隔离则补成独立的 preflight guard，不混成一套含糊文案。

## 本轮实现

### 1. 后端补齐 default execution validation

- 更新 `api/app/services/workflow_tool_execution_validation.py`
- 当 `tool` 节点没有显式 `runtimePolicy.execution` 时，后端现在会检查所绑定 tool 的 `default_execution_class`。
- 当 `llm_agent.toolPolicy.allowedToolIds` 未显式声明 `toolPolicy.execution` 时，后端也会逐个检查所允许的 tool 是否默认依赖 `sandbox / microvm`，以及当前 adapter / backend readiness 是否满足。
- `mockPlan.toolCalls` 同样补上默认 execution 校验，避免 mock plan 先通过、真实运行再 blocked。

### 2. 前端 editor preflight 与后端规则对齐

- 更新 `web/lib/workflow-tool-execution-validation.ts`
- 更新 `web/lib/workflow-tool-execution-validation-helpers.ts`
- editor 本地 preflight 现在不只在显式 execution target 下做能力校验；当 tool catalog 的 `default_execution_class` 为 `sandbox / microvm` 时，也会在 tool binding、`allowedToolIds`、`mockPlan.toolCalls` 这些入口直接给出阻断性 issue。
- 文案会区分“显式请求 execution class”和“依赖工具默认执行级别”，避免作者误以为是自己手工写了 execution override。

### 3. 回归测试覆盖 workflow 与 starter 两条保存链

- 更新 `api/tests/test_workflow_routes.py`
- 更新 `api/tests/test_workspace_starter_routes.py`
- 新增用例覆盖：
  - native tool 默认 `sandbox`、backend 不可用时阻断 workflow 保存
  - compat tool 默认 `microvm`、被 `allowedToolIds` 引用且 backend 不可用时阻断 workflow 保存
  - 同样场景也会阻断 workspace starter 保存，避免模板链路与 workflow 链路出现语义漂移

## 影响评估

### 架构链条

- **扩展性增强**：tool contract 的默认执行约束开始被 authoring/preflight 直接消费，后续继续接 `sensitivity_level -> default execution class` 时不需要再补一套新的保存前框架。
- **兼容性增强**：workflow 保存、starter 保存、editor 本地 preflight 与 runtime fail-closed 现在围绕同一份 `default_execution_class` 事实工作，减少“前端能存、后端能存、运行时才爆”的分叉。
- **可靠性 / 稳定性增强**：高风险 tool 的默认隔离要求更早暴露，降低 operator 只有在真实执行时才看到 blocked run 的概率。
- **安全性增强**：默认强隔离不再只是 runtime 最后的兜底；作者在保存时就会被提醒“当前 backend 还不支持这个默认强隔离 contract”。

### 对产品闭环的帮助

- 这轮属于 **人与 AI 协作层 + AI 治理层** 的直接推进，不是停留在纯代码整理。
- **人使用**：workflow 作者、模板作者在保存前就能知道当前 tool catalog 的默认强隔离能力是否可兑现。
- **AI 使用 / AI 协作**：`llm_agent` 在 `allowedToolIds` 或 `mockPlan` 中引用默认强隔离 tool 时，不会再把 readiness gap 留到真实执行阶段才暴露。
- **AI 治理**：default execution contract 终于同时进入 runtime、持久化与作者侧 preflight，为下一步把敏感等级驱动的默认隔离规则收口进同一条 contract 打下基础。

## 验证

- 定向后端测试：`api/.venv/Scripts/uv.exe run pytest -q tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
  - 结果：`78 passed`
- 后端 changed-files 检查：`api/.venv/Scripts/uv.exe run ruff check app/services/workflow_tool_execution_validation.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
  - 结果：通过
- 后端全量测试：`api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`338 passed in 61.28s`
- 前端类型检查：`web/pnpm exec tsc --noEmit`
  - 结果：通过
- 前端 lint：`web/pnpm lint`
  - 结果：通过（仅有 Next.js 自身关于 `next lint` 的弃用提示）
- diff 检查：`git diff --check`
  - 结果：无 diff error；仅有 LF/CRLF 提示

## 下一步

1. 把高风险 native / compat tool 的 `sensitivity_level -> default execution class` 规则收口到同一份 tool contract，不再只靠手动声明 `default_execution_class`。
2. 继续推进 compat adapter / native invoker 对已声明 execution class 的真实隔离兑现，让 `sandboxBackend` 绑定不只停留在 host dispatch 层。
3. 在 editor / tool catalog UI 中继续补“为什么这个 tool 默认强隔离”的解释，减少作者只看到 blocked 文案却看不懂治理意图的情况。
