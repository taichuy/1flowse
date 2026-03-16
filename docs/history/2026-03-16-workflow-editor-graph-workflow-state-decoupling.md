# 2026-03-16 Workflow Editor Graph Workflow-State Decoupling

## 背景

- 2026-03-16 前几轮 workflow editor 已连续补上 node support、tool reference / execution guard、publish version preflight、variables validation，以及 validation navigation / focus。
- 最近一次提交 `fd7d3bf refactor: split workflow editor workbench orchestration` 已把 `workflow-editor-workbench.tsx` 的 validation / persistence 从主壳层拆出，但 `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts` 仍同时持有 nodes / edges / selection / node mutation / workflow variables / workflow publish 多类状态。
- 按本轮项目现状复核结论，当前项目不需要回头重搭基础框架，更高优先级是顺着既有 editor 主线继续治理热点，避免复杂度从 workbench 壳层重新回流到 graph hook。

## 目标

- 把 workflow-level 的 `variables` / `publish` 状态与 mutation 从 `use-workflow-editor-graph.ts` 中继续拆出。
- 保持 workflow editor inspector、保存前校验和 persistence 语义不变，不引入第二套 workflow state 协议。
- 为后续继续补 schema builder、sensitive access policy、starter portability guard 时，保留更清晰的 editor state 分层。

## 实现

### 1. 新增 workflow-level state hook

- 新增 `web/components/workflow-editor-workbench/use-workflow-editor-workflow-state.ts`
- 统一承接：
  - `workflowVariables` 初始化与 reset
  - `workflowPublish` 初始化与 reset
  - `updateWorkflowVariables()`
  - `updateWorkflowPublish()`
  - workflow-level mutation 成功提示与 idle reset
- 继续复用原有 normalize 语义，不改变 editor 传给 preflight / persistence 的 definition 结构。

### 2. graph hook 回收到“画布 + node/edge orchestration”定位

- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
  - 不再内联维护 `normalizeWorkflowVariables()` / `normalizeWorkflowPublishDraft()`。
  - 改为组合 `useWorkflowEditorWorkflowState()`，把 workflow-level state reset 接到 workflow 切换的 effect。
  - `currentDefinition` 仍由 graph hook 统一组装，但 workflow-level mutation 已从主文件挪到专用 hook，避免继续横向膨胀。

### 3. 保持现有调用面不变

- `WorkflowEditorWorkbench` 与 `WorkflowEditorInspector` 不需要调整 props 契约。
- 保存前 validation、workspace starter persistence、publish / variables 表单交互和消息反馈语义保持不变。

## 影响范围

- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
- `web/components/workflow-editor-workbench/use-workflow-editor-workflow-state.ts`
- `docs/dev/runtime-foundation.md`
- `docs/history/2026-03-16-project-status-assessment-and-priority-bridge.md`

## 验证

- `web/pnpm lint`
  - 通过
- `web/pnpm exec tsc --noEmit`
  - 通过

## 结论

- 当前项目基础框架已经足够支撑持续功能开发；本轮继续选择“沿上一轮边界顺拆 editor 热点”，而不是重搭主骨架，是更符合当前优先级的动作。
- `use-workflow-editor-graph.ts` 已从“同时管理画布状态 + workflow-level variables/publish mutation”的混合定位，进一步收口为更接近 graph orchestration 的 hook。
- 下一步应继续沿同一主线推进 node config / runtime policy / schema builder 的字段级聚焦，以及 publish binding identity / starter portability 的更细校验，而不是让复杂度重新堆回 graph hook。
