# 2026-03-17 Callback blocker delta follow-up

## 背景

- `docs/dev/runtime-foundation.md` 在 `P0` 中明确把 `WAITING_CALLBACK` 的下一步收口为：把 **blocker delta** 接回 callback summary 与 publish detail，避免 operator 需要手工对比多块卡片才能确认阻塞是否真的减少。
- 当前项目在“用户层 / AI 与人协作层 / AI 治理层”三层里，`waiting callback + approval pending + notification retry` 已经进入同一条排障主链，但动作反馈仍主要停留在“动作已提交 + 最新 run snapshot”，缺少“这次动作到底消掉了哪些 blocker”的即时解释。

## 目标

- 在不改动 runtime 核心模型的前提下，把单条 operator action 的前后 blocker 变化直接带回 callback summary。
- 让 run detail 与 publish invocation detail 共用同一套 blocker delta 解释，而不是分别堆一套文案。
- 避免继续把这类逻辑塞回现有 action/result presenter 单体文件中，保持后续可扩展性。

## 实现

### 1. 新增 callback blocker follow-up helper

- 新增 `web/lib/callback-blocker-follow-up.ts`。
- 该 helper 会在 action 前后读取 `RunExecutionView`，按 `nodeRunId` 锁定当前 callback waiting 节点，并复用 `callback-waiting-presenters` 里的 `operatorStatuses` 与 `recommendedAction` 生成轻量 blocker snapshot。
- 通过 `formatCallbackBlockerDeltaSummary()` 统一输出“已解除 / 新增 / 仍然存在 / 建议动作变化”的 delta 文案，避免同类逻辑散落在多个 server action 内。

### 2. 把 delta 接回 callback summary 的所有 inline operator action

- `web/app/actions/runs.ts`
  - 手动 `resume` 现在会在动作前后回读 blocker snapshot，并把 delta 与最新 run snapshot 一起返回。
- `web/app/actions/callback-tickets.ts`
  - callback cleanup 现在会在“处理了多少 ticket / 是否安排恢复”之外，额外补上 blocker 是否真的减少。
- `web/app/actions/sensitive-access.ts`
  - 单条 approval decision / notification retry 现在都会把 blocker delta 带回结果消息，不再只告诉 operator “动作已提交”。

### 3. 补齐 node-scoped hidden input，保证 run / publish 两侧都能命中同一节点

- `web/components/callback-waiting-inline-actions.tsx` 为手动 resume 带上 `nodeRunId`。
- `web/components/sensitive-access-inline-actions.tsx` 扩展 `nodeRunId` 透传。
- `web/components/callback-waiting-summary-card.tsx`
- `web/components/sensitive-access-blocked-card.tsx`
- `web/components/sensitive-access-timeline-entry-list.tsx`

这些入口现在都会尽量把 `approval_ticket.node_run_id` 或当前 callback summary 的 `nodeRunId` 回传给 action，避免动作结果回读到错误节点，导致 delta 失真。

## 影响评估

### 对架构与可维护性

- 这次没有改动 runtime / DB / API 契约，不会破坏既有执行链。
- 新 helper 把“callback blocker follow-up”从 `operator-action-result-presenters.ts` 中拆出，避免继续把“取数 + 比较 + 文案”混在单文件里，属于一次小而明确的解耦。
- 这类解耦同时对人类与 AI 都更友好：后续检索 callback follow-up 逻辑时，不需要在 action 文件、summary card 和 message presenter 之间来回跳。

### 对产品三层闭环

- 用户层：run detail / publish detail 的 operator 反馈更直接，减少“点了按钮但不知道是否真有推进”的不确定性。
- 人与 AI 协作层：callback summary 与 publish detail 共用同一套 blocker delta 语义，便于人和 AI 讨论同一份事实。
- AI 治理层：approval / notification retry 的反馈不再停留在表面成功，而是明确说明治理 blocker 是否解除。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

结果：均通过。

## 下一步

1. 把同类 blocker delta 扩到 `/sensitive-access` inbox 的批量 action 结果，避免单条与批量治理体验继续分叉。
2. 继续把 publish detail / callback summary 中剩余的 blocker 聚合判断抽到 shared presenter，减少页面层手工拼接。
3. 回到更高优先级的全局闭环：继续推进 `P0` 的统一敏感访问控制闭环，以及 editor 侧的 `sensitive access policy` 入口，而不是在 callback 文案上继续细抠。
