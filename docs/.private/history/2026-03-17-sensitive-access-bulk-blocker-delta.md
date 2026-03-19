# 2026-03-17 Sensitive access bulk blocker delta

## 背景

- `docs/dev/runtime-foundation.md` 已把 `P0 WAITING_CALLBACK` 的下一步收敛到：把单条 action 已具备的 `blocker delta` 语义继续扩到 `/sensitive-access` inbox 的 bulk governance，避免 operator 只能看到“批量动作提交成功”和样本 run snapshot，却仍要手工判断 blocker 是否真的减少。
- 当前项目的批量治理主链已经具备 `bulk approval / bulk notification retry + sampled run follow-up`，但还缺少与单条 action 对齐的 callback blocker 前后对比，因此 bulk card 和 callback summary / publish detail 之间仍有一层事实表达断档。

## 目标

1. 让 bulk approval / bulk notification retry 也能回读动作前后的 callback blocker snapshot。
2. 保持复用现有 `callback-blocker-follow-up` 与 operator presenter，而不是让 bulk action 长出第二套结果解释模型。
3. 把结构化 blocker 指标回填到 bulk governance card，减少 operator 只靠长消息扫读的负担。

## 实现

### 1. 扩展 bulk blocker helper

- 更新 `web/lib/callback-blocker-follow-up.ts`。
- 新增 bulk 级别的 scope、snapshot 与 summary helper：
  - `fetchCallbackBlockerSnapshots()`
  - `summarizeBulkCallbackBlockerDelta()`
- 统一负责：
  - 按 `runId + nodeRunId` 去重采样
  - 成对比较 before / after blocker
  - 汇总 `changed / cleared / fully cleared / still blocked`
  - 生成适合 bulk result presenter 直接复用的 summary 文案

### 2. bulk action 带入当前筛选结果的 run/node scope

- 更新 `web/components/sensitive-access-inbox-panel.tsx`。
- 批量审批不再只传 `ticketId[]`，批量通知重试也不再只传 `dispatchId[]`，而是把当前筛选结果中的：
  - `ticketId / dispatchId`
  - `approvalTicketId`
  - `runId`
  - `nodeRunId`
  一起带进 server action。
- 这样 bulk server action 可以只针对“本次真正更新成功”的 scope 做 blocker 前后对比，而不是回退到全局猜测。

### 3. bulk action 接回 blocker delta 与结构化指标

- 更新 `web/app/actions/sensitive-access.ts`
- bulk approval / bulk notification retry 现在都会：
  - 在动作前预取候选 scope 的 blocker snapshot
  - 在后端返回后，仅针对真正成功处理的 ticket scope 回读 after snapshot
  - 生成 bulk blocker delta summary
  - 把结构化指标写回 `SensitiveAccessBulkActionResult`
- 更新 `web/lib/operator-action-result-presenters.ts`
  - bulk result message 现会把 blocker delta summary 接到 run follow-up 之前，和单条 action 的说明风格保持一致。
- 更新 `web/lib/get-sensitive-access.ts`
  - `SensitiveAccessBulkActionResult` 新增：
    - `blockerSampleCount`
    - `blockerChangedCount`
    - `blockerClearedCount`
    - `blockerFullyClearedCount`
    - `blockerStillBlockedCount`

### 4. bulk governance card 展示结构化 blocker 反馈

- 更新 `web/components/sensitive-access-bulk-governance-card.tsx`
- bulk card 现在除既有的 `affected runs / sampled / waiting / running / failed` 之外，还会直接展示：
  - `blocker samples`
  - `changed`
  - `cleared`
  - `fully cleared`
  - `still blocked`
- 这样 operator 在批量治理后，不必先读整段消息才能快速判断这次动作有没有真正减轻 blocker。

## 影响评估

### 架构与可维护性

- 这轮仍然沿着已有的 `callback-blocker-follow-up -> server action -> operator presenter -> bulk card` 主链推进，没有新增第二套批量执行状态机。
- 单条与批量 action 现在开始共享同一类 blocker delta 语义，减少后续再出现“单条结果解释很完整，批量入口只剩计数”的分叉。
- bulk action 的 scope 解析保持在当前页入口完成，server action 只消费结构化 scope，不需要反向依赖页面筛选实现细节。

### 对产品闭环的帮助

- 用户层：`/sensitive-access` inbox 的批量治理更接近真正的 operator 工作面，而不只是“发批量请求的按钮区”。
- AI 与人协作层：bulk action 也开始输出与单条 action 一致的 blocker facts，便于 AI 和人类围绕同一套恢复事实沟通。
- AI 治理层：批量审批 / 通知重试不再只显示“动作成功”，而是直接说明样本 blocker 是否真的减少、是否仍停在治理阻塞链路里。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

结果：

- `tsc` 通过
- `lint` 通过
- `git diff --check` 通过（仅有工作区行尾转换警告，无语法/空白错误）

## 下一步

1. 继续把同类结构化 blocker summary 收口到 callback summary / publish detail，避免 bulk card 独自变强而其他 operator 入口继续分叉。
2. 继续把 bulk action 内的 shared follow-up / scope filtering helper 稳定下来，减少 `sensitive-access.ts` 再次吸收重复 orchestration 逻辑。
3. 待 `WAITING_CALLBACK` 的 operator explanation 主链更稳定后，再回到 `P0 sandbox / protocol` 与 `P1 editor completeness` 的剩余热点，不在同一轮里切换主主题。
