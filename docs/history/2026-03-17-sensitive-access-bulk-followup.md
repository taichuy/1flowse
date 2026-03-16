# 2026-03-17 Sensitive Access Bulk Follow-up

## 背景

- `docs/dev/runtime-foundation.md` 已把 `P0 WAITING_CALLBACK` 的下一步收敛到“bulk operator action 的恢复摘要”和“页面层残余手工结果拼接”。
- 2026-03-17 此前几轮已经把单条 operator action 的 expectation/result、实时 run snapshot follow-up 补到手动恢复、callback cleanup、审批决策和通知重试。
- 但 `/sensitive-access` inbox 里的 bulk governance 仍只返回“更新了多少、跳过了多少”的静态计数，operator 还需要自己再跳进多个 run detail 才知道这次批量动作后是否真的减少了 blocker。

## 目标

- 让 bulk approval / bulk notification retry 也接入同一套 run follow-up 语义。
- 保持当前 action / presenter / inbox card 分层，不新增第二套批量结果模型。
- 继续沿“在统一治理入口里解释动作后事实”的主线推进，而不是回到纯结构整理或局部样式修补。

## 实现

### 1. 抽批量 run snapshot helper

- 更新 `web/app/actions/run-snapshot.ts`
  - 在现有 `fetchRunSnapshot()` 之上新增 `fetchRunSnapshots()`。
  - 统一完成 run id 去重、裁样和批量快照读取，避免 bulk action 再各自手写 follow-up 查询。

### 2. 扩展 operator result presenter

- 更新 `web/lib/operator-action-result-presenters.ts`
  - 新增 bulk follow-up formatter，统一汇总：
    - 这次动作影响了多少个 run
    - 已回读多少个样本 run
    - 当前样本的状态分布
    - 每个样本 run 的最新 `status / current node / waiting reason`
  - 继续复用现有单条 action 的 presenter 风格，不把这层解释散回各个 server action。

### 3. 把 bulk approval / retry 接回真实 run follow-up

- 更新 `web/app/actions/sensitive-access.ts`
  - `bulkDecideSensitiveAccessApprovalTickets()` 现在会基于后端返回的 `decided_items.run_id` 回读一组样本 run snapshot，再交给 bulk presenter 生成结果消息。
  - `bulkRetrySensitiveAccessNotificationDispatches()` 现在会基于 `retried_items.approval_ticket.run_id` 做同样的 follow-up。
  - skip reason 文案继续保留在共享 helper 中，避免 bulk approval / retry 重复拼接字符串。

## 影响

### 架构与扩展性

- 增强的是现有 **operator action explanation layer**，不是新增执行模型。
- 这继续证明当前架构已经足以承接后续功能性开发：
  - 结果解释仍围绕同一套 runtime facts（`/api/runs/{run_id}`）
  - bulk action 没有演化出第二套“批量恢复状态机”
  - 批量 follow-up 仍复用 presenter + action helper 边界

### 业务闭环价值

- 对象：主要服务 **人类 operator**，同时为后续 AI 读取统一治理入口提供更稳定事实表达。
- 场景：`/sensitive-access` inbox 中的 bulk approval / bulk notification retry。
- 变化前：operator 只能知道“这次批量动作提交了多少条”。
- 变化后：operator 还能马上看到“这些动作影响到的 run 现在大致停在哪、有没有继续推进”。
- 提升点：减少批量治理后的二次跳转和上下文丢失，让 waiting callback / approval pending / notification retry 更接近真正的闭环排障入口。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 下一步

1. 把 bulk follow-up 的 blocker delta 继续接到 inbox card / publish detail，而不只是放在动作结果消息里。
2. 继续把页面层残余的手工结果拼接收口到 presenter / helper，避免 bulk 与单条 action 再次分叉。
3. 在 `WAITING_CALLBACK` 主线稳定后，再回到 editor / publish 的 P1 热点，不打断当前治理闭环。
