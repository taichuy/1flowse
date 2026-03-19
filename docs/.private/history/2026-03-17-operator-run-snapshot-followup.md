# 2026-03-17 Operator 动作 run 快照补链

## 背景

- `runtime-foundation.md` 当前把 `P0 WAITING_CALLBACK` 的重点收敛在 operator explanation / action surface。
- 2026-03-17 上一轮提交已经把手动恢复、审批和通知重试的结果文案统一收口到 presenter，并开始回填部分 waiting / policy 快照。
- 但审批通过、通知送达、cleanup 已执行，并不等于 run 已经真正离开 `waiting`；如果动作结果只展示票据或通知状态，operator 仍然要手动跳回 run detail 才能确认执行有没有推进。

## 目标

- 把 callback cleanup、审批决策、通知重试三类 operator 动作后的最新 run 状态一起带回结果消息。
- 避免继续在多个 server action 中重复解析 `RunDetail`，顺手把 run 快照获取抽成共享 helper。
- 让 published detail、run diagnostics、sensitive access inbox 内的 inline action 都能更明确地区分“动作提交成功”和“run 事实是否推进”。

## 实现

### 1. 抽共享 run snapshot helper

- 新增 `web/app/actions/run-snapshot.ts`，统一负责：
  - 拉取 `/api/runs/{run_id}`
  - 从 `current_node_id + node_runs` 解析当前 `waiting_reason`
  - 返回轻量 `RunSnapshot { status, currentNodeId, waitingReason }`

### 2. 补 operator action 的 run 事实回填

- `web/app/actions/runs.ts`
  - 手动恢复成功后，额外抓取一次最新 run 快照。
  - 若快照读取失败，才回退到 `/resume` 返回里的最小状态信息。
- `web/app/actions/callback-tickets.ts`
  - cleanup 处理完成后回填 run 快照，让 operator 直接看到 cleanup 之后 run 仍是 waiting、已经 running，还是已经 failed。
- `web/app/actions/sensitive-access.ts`
  - 审批决策与通知重试成功后，都附带最新 run 快照再生成结果文案。

### 3. 扩 operator result presenter

- `web/lib/operator-action-result-presenters.ts`
  - `formatCleanupResultMessage`
  - `formatApprovalDecisionResultMessage`
  - `formatNotificationRetryResultMessage`
- 上述结果文案统一支持拼接 `当前 run 状态 / 当前节点 / waiting reason`，明确区分：
  - 审批或通知动作本身的结果
  - 当前 waiting 链路状态
  - run 是否已经真正推进

## 影响范围

- 人类 operator 在 `run diagnostics`、published invocation callback drilldown、sensitive access inline action 中的排障确认成本下降。
- 这项改动直接服务“人与 AI 协作层”的共享事实一致性：动作入口不再只反馈治理动作本身，还能同步反馈 runtime 当前状态。
- 架构上没有新增第二套 waiting 查询模型，仍复用 `RunDetail` 作为事实源，符合 `runs / node_runs / run_events` 为准的约束。

## 解耦判断

- 这次解耦不是为了拆得更碎，而是为了解决同一类 `RunDetail -> RunSnapshot` 解析在多个 action 中重复出现的问题。
- 共享 helper 的判断依据：
  - 职责单一：只负责读取并压缩 run 快照。
  - 复用明确：至少被 `resume / cleanup / sensitive access` 三条动作链同时使用。
  - 后续可扩展：以后若 bulk action 或更多 operator action 需要 run 快照，可直接复用。
  - 对人和 AI 都友好：减少重复 fetch/解析逻辑，后续 review 时也更容易确认动作结果与 run 事实的关联点。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 下一步

1. 继续把 bulk approval / bulk notification retry 也补上聚合 run 恢复摘要，避免批量动作只有数量结果没有恢复判断。
2. 继续把 callback waiting summary / published detail 的 operator explanation 往统一 presenter 收口，避免页面层自行拼接事实描述。
3. 若后续 operator action 类型继续增多，再评估是否把 action 侧的 revalidate + snapshot follow-up 再下沉成更通用的 helper。
