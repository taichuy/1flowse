# 2026-03-16 Workflow tool execution validation split

## 背景

- `docs/dev/runtime-foundation.md` 继续把 `workflow-tool-execution-validation.ts` 列为 editor / publish 热点之一。
- 当前编辑器保存前的 `tool execution capability` 校验已经进入主链，会同时影响 `tool` 节点与 `llm_agent.toolPolicy/mockPlan` 的可保存性。
- 如果继续把 issue type、adapter/execution helper 与 node-level orchestrator 全部堆在一个文件里，后续补 execution-aware explanation、更多校验变体或 editor 提示时，复杂度会重新回流到同一个热点。

## 目标

1. 降低 `web/lib/workflow-tool-execution-validation.ts` 的聚合复杂度。
2. 保持 `buildWorkflowToolExecutionValidationIssues` 的对外 API 不变，避免影响现有 validation hook。
3. 为后续继续补 execution-aware explanation / guard 预留更稳定的 helper/type 边界。

## 实现

- 新增 `web/lib/workflow-tool-execution-validation-types.ts`
  - 收口 `WorkflowToolExecutionValidationIssue`、共享上下文与 helper option 类型。
- 新增 `web/lib/workflow-tool-execution-validation-helpers.ts`
  - 下沉显式 adapter 绑定校验、execution capability 校验、adapter 可见性判断与 execution class 提取逻辑。
- 收窄 `web/lib/workflow-tool-execution-validation.ts`
  - 保留 `buildWorkflowToolExecutionValidationIssues` 与按节点遍历的 orchestrator 职责。
  - 继续兼容现有 `use-workflow-editor-validation.ts` 的 import surface，不改业务语义。

## 影响范围

- `workflow-tool-execution-validation.ts` 从约 434 行降到约 254 行，不再同时承担“类型定义 + adapter/execution helper + orchestration”三类职责。
- 现有 workflow editor 的 tool execution preflight、validation navigator 与保存前阻断语义保持不变。
- 后续若继续补 execution-aware explanation 或针对 `sensitive access / graded execution` 的编辑器提示，可以直接落在 helper/type 层，而不是继续堆回单文件。

## 验证

- `cd web; pnpm exec tsc --noEmit`
- `cd web; pnpm lint`
- `git diff --check`

## 评估结论

### 1. 对架构 / 扩展 / 稳定性的帮助

- 这轮不改变 runtime、publish API 或 sensitive access 主链，而是继续治理 editor 侧热点，符合“当前不回头重搭骨架、沿主线拆热点”的方向。
- 通过把 execution capability 相关 helper 抽成独立模块，后续扩 execution-aware 校验时更容易复用，也更不容易在单文件里引入回归。
- 对兼容性的帮助体现在：保留原入口与现有校验语义，降低后续继续演进 editor validation 时的改动扩散面。

### 2. 对业务闭环推进的帮助

- 对用户层：workflow editor 的保存前校验链更容易继续细化，不必为拆热点而牺牲现有可用性。
- 对 AI 与人协作层：execution capability 问题继续在保存前被明确拦下，减少运行时才暴露“请求了不受支持 execution class”的情况。
- 对 AI 治理层：后续如果继续把 `graded execution`、`fail-closed` 语义映射到 editor explanation，本轮拆层提供了更清晰的落点。

## 下一步

1. 继续沿 `runtime-foundation` 的 P0/P1 顺序，优先补真实隔离 backend / waiting callback / sensitive access explanation 的主链闭环。
2. 在 editor 侧继续治理 `workflow-editor-variable-form.tsx`、`use-workflow-editor-graph.ts` 等剩余热点，避免复杂度回流。
3. 在 execution helper 边界稳定后，再考虑把 capability issue 的更细 explanation 或 structured hint 暴露到 editor UI。
