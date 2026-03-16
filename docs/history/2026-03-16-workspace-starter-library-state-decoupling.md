# 2026-03-16 workspace starter library state decoupling

## 背景

- `web/components/workspace-starter-library.tsx` 在连续补 bulk governance、source refresh/rebase、history/source diff 等能力后，已同时承担筛选、选中态、表单态、消息提示、批量治理、单条 mutation 与 source side-effect 编排。
- 这类复杂度继续留在壳组件里，会让后续 workspace starter 的 validation、governance drilldown 和来源同步能力再次回流成单体热点，不利于持续补真。

## 目标

- 保持现有 UI 结构与行为不变。
- 把 library 级 state orchestration 从壳组件下沉到独立 hook，减少页面壳层复杂度。
- 顺手把 validation issue 摘要逻辑收敛到共享工具，避免保存错误处理继续内联膨胀。

## 实现

- 新增 `web/components/workspace-starter-library/use-workspace-starter-library-state.ts`：
  - 集中承载 templates / filters / selection / form / message / bulk result 状态。
  - 收口 `filteredTemplates`、`bulkActionCandidates`、`sourceStatus`、`hasPendingChanges` 等派生数据。
  - 接管 save、archive/restore/delete、bulk action 三类 mutation 编排。
  - 继续复用既有 `useWorkspaceStarterSource`，不改变 source refresh / rebase / history / diff 的事实来源。
- 更新 `web/components/workspace-starter-library/shared.ts`：
  - 新增 `summarizeValidationIssues()`，把 workspace starter 保存失败时的 validation issue 聚合文案抽成共享工具。
- 精简 `web/components/workspace-starter-library.tsx`：
  - 壳组件只负责读取 hook 输出并拼装四个已有 panel。
  - 文件规模从约 `429` 行降到约 `126` 行，避免 UI 壳层继续承担业务推导与副作用细节。

## 影响范围

- `web/components/workspace-starter-library.tsx`
- `web/components/workspace-starter-library/use-workspace-starter-library-state.ts`
- `web/components/workspace-starter-library/shared.ts`

## 验证

- `web/pnpm lint`
- `web/pnpm exec tsc --noEmit`

## 结果

- workspace starter library 的复杂度已从页面壳层下沉到稳定 hook，后续更适合继续拆分 bulk governance、source sync 与字段级校验，而不会把新需求继续堆回顶层组件。
- 当前仍未进入人工界面逐项验收阶段，因此不触发通知脚本。
