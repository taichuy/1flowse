# 2026-03-17 Callback waiting shared blocker summary

## 背景

- `docs/dev/runtime-foundation.md` 已把 `P0 WAITING_CALLBACK` 的下一步收敛到：把 bulk governance 已具备的结构化 blocker 事实继续收口到 callback summary / publish detail，避免 operator 在不同入口看到的是相似但不一致的字段拼接。
- 当前 `CallbackWaitingSummaryCard` 与 `workflow-publish-invocation-callback-section.tsx` 都在消费同一批 callback waiting 事实，但两边仍分别手写 `Status / Approvals / Notification / Scheduled resume / Latest ticket` 等内容，导致 run detail 与 published invocation detail 的 operator 视图仍有表达漂移。

## 目标

1. 把 callback waiting 的结构化 blocker / event 摘要收口到共享 presenter。
2. 让 run detail summary 与 publish detail drilldown 复用同一份行模型，而不是继续并行维护两套拼装逻辑。
3. 在不重做组件层级的前提下，继续推进 `WAITING_CALLBACK` 的 operator 主链一致性。

## 实现

### 1. 为 callback waiting 新增共享 detail rows

- 更新 `web/lib/callback-waiting-presenters.ts`。
- 新增：
  - `CallbackWaitingDetailRow`
  - `listCallbackWaitingBlockerRows()`
  - `listCallbackWaitingEventRows()`
- 这些 helper 基于现有 presenter 继续生成稳定的结构化行，而不是重新发明一套状态判断：
  - blocker rows：`Status / Ticket status mix / Approvals / Sensitive access / Notification / Resume / Lifecycle / Termination / Recommended next action`
  - event rows：`Latest ticket / Latest late callback / Waiting node run / Waiting reason`

### 2. callback summary card 改吃共享 rows

- 更新 `web/components/callback-waiting-summary-card.tsx`。
- run detail 中的 callback summary 现在不再分别手写：
  - `Status`
  - `Approval`
  - `Sensitive access`
  - `Notification`
  - `Resume`
  - `Lifecycle`
  - `Recommended next action`
- 改为统一渲染 `listCallbackWaitingBlockerRows()` 返回的结构化行，并继续保留：
  - headline
  - status chips
  - waiting reason
  - inline sensitive access actions
  - callback inline actions
  - termination error strip

### 3. publish callback drilldown 复用同一份摘要模型

- 更新 `web/components/workflow-publish-invocation-callback-section.tsx`。
- published invocation detail 现在通过：
  - `listCallbackWaitingBlockerRows()` 渲染 `Resume blockers`
  - `listCallbackWaitingEventRows()` 渲染 `Latest callback events`
- 并把 `waitingReason` 显式传给 `CallbackWaitingSummaryCard`，让 publish detail 顶部 summary 与下方 drilldown 使用完全一致的 callback waiting 事实来源。

## 影响评估

### 架构与可维护性

- callback waiting 的摘要表达从“两个组件各自手写字段”变成“共享 presenter 生成结构化 rows，再由各入口按布局消费”。
- 这轮没有新增第二套 callback view model，也没有把业务判断重新塞回 JSX；变化继续停留在 presenter / section helper 层。
- 后续若要继续把同类 summary 接到 execution node card 或 callback ticket 列表，可直接复用同一批 rows，而不是复制字符串拼接。

### 对主链闭环的帮助

- 用户层：run detail 与 publish detail 的 callback 摘要表达更一致，operator 切换入口时认知成本更低。
- AI 与人协作层：callback blocker facts 进一步收口为统一可复用的结构化行，便于 AI 和人围绕同一份事实继续解释与排障。
- AI 治理层：approval / notification / callback / scheduled resume 的关系不再在不同页面被拆成不同文案风格，治理解释更稳定。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

结果：

- `tsc` 通过
- `lint` 通过
- `git diff --check` 通过（仅有工作区行尾转换提示，无语法/空白错误）

## 下一步

1. 继续把 `execution-node-card` 与 callback ticket 列表里的残余手工摘要接到同一批 callback waiting rows / section helper。
2. 继续减少 publish detail 和 run diagnostics 页面层的手工字符串拼接，优先把 operator 入口统一到 presenter 层。
3. 待 `WAITING_CALLBACK` 的 operator 主链进一步稳定后，再回到 `P0 sandbox / protocol` 与 `P1 editor completeness` 的剩余热点，不在同一轮里切换主主题。
