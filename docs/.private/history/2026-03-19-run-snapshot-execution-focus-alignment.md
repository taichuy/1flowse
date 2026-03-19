# 2026-03-19 run snapshot execution focus alignment

## 本轮主题
- 把 operator 侧 `fetchRunSnapshot` 从只读 `/api/runs/{id}` 的降级快照，推进到同时回读 `execution-view`，让手动恢复、callback cleanup 等入口也消费 backend canonical execution focus。

## 已完成
- `web/app/actions/run-snapshot.ts` 现在会在读取基础 run detail 后继续读取 `/api/runs/{id}/execution-view`，把 `executionFocusReason`、`executionFocusNodeId`、`executionFocusNodeRunId` 与 `executionFocusExplanation` 合并进统一 snapshot。
- 保留了 execution view 不可用时的降级行为：仍返回基础 `status / workflowId / currentNodeId / waitingReason`，避免把 operator 入口变成硬依赖。
- 顺手补上 `encodeURIComponent`，避免 run id 含特殊字符时生成不稳定路径。
- 新增 `web/lib/run-snapshot-action.test.ts`，锁住三种关键行为：
  - detail + execution view 一起返回时，优先带回 backend execution focus
  - execution view 不可用时，仍回退到基础 snapshot
  - detail 不可用时，返回 `null`

## 验证
- `pnpm exec vitest run lib/run-snapshot-action.test.ts lib/operator-action-result-presenters.test.ts`
- `pnpm exec tsc --noEmit`
- `pnpm lint`

## 为什么做这轮
- 最近几轮已经把 operator action outcome、run snapshot、run follow-up 一步步收口到后端解释层，但 `fetchRunSnapshot` 仍停留在 `waitingReason` 降级口径，导致手动恢复 / callback cleanup 的 follow-up 文案和 sensitive access 路径不一致。
- 这不是样式或局部美化问题，而是 AI 与人协作层主链的一段事实源不一致；补齐后，operator 不必再在不同入口之间切换脑内模型。

## 下一步建议
1. 继续评估其他 operator 回读入口是否仍在直接拼 `waitingReason` 或状态枚举，而没有消费 canonical execution focus。
2. 继续把 blocker delta / action detail 里真正稳定的部分下沉到后端共享解释层，减少页面侧分散 copy。
3. 继续推进 published detail、run detail 与 operator result 的解释层对齐，避免同一 blocking fact 在不同页面使用不同口径。
