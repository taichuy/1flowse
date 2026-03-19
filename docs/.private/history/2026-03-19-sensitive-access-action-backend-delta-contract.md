# 2026-03-19 sensitive access action backend delta contract

## 本轮主题

- 沿 `docs/.private/runtime-foundation.md` 的 shared explanation layer 主线，继续把 sensitive access operator action 的前后端契约收口到后端事实层。
- 当前工作区已经存在一组未提交的 sensitive access 脏改动，主题集中在 `callback_blocker_delta` 下沉；本轮不改方向，重点把前端 action 对这组后端字段的消费路径锁成可回归验证的契约。

## 已完成

- `web/app/actions/sensitive-access.ts`
  - 把四类 sensitive access action response 中重复的 `outcome_explanation` / `callback_blocker_delta` 内联类型收口为共享别名，减少单条审批、单条重试、批量审批、批量重试之间的契约漂移。
- `web/lib/sensitive-access-actions.test.ts`
  - 新增前端 action 契约测试，覆盖两条关键路径：
    - 单条审批在后端已返回 `callback_blocker_delta` 与 `run_snapshot` 时，直接消费后端事实，不再额外回退读取前端 run snapshot。
    - 批量通知重试在后端已返回 `callback_blocker_delta` 与 `run_follow_up` 时，直接消费后端聚合事实，不再触发额外的前端 follow-up 拼装请求。
  - 额外锁住调用次数，确保这些路径保持单次 action 请求闭环。

## 验证

- `web/pnpm exec vitest run lib/sensitive-access-actions.test.ts lib/operator-action-result-presenters.test.ts`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 为什么做这轮

- 最近几轮一直在把 waiting / execution / sensitive access 的 operator explanation 收口到后端 canonical facts，但前端 action 层此前没有回归测试来锁定“优先消费后端 blocker delta / run follow-up”的约束。
- 这不是测试洁癖，而是在 AI 与人协作层补齐一段易回退的事实链：如果未来又把 bulk action 退回到前端补拉 snapshot / system overview，就会重新引入不同页面之间的解释漂移。

## 下一步建议

1. 继续为 `bulkDecideSensitiveAccessApprovalTickets` 与 `retrySensitiveAccessNotificationDispatch` 补对应前端 action 契约测试，确保四条 action 路径都锁住后端 canonical explanation。
2. 继续把 publish detail / operator result / run detail 里仍由页面拼接的 callback blocker 解释下沉到共享 response 字段，而不是继续散落在组件层。
3. 在不偏离当前主线的前提下，继续观察 graded execution / sandbox readiness 与 waiting callback shared explanation 的交界处，优先找仍存在双事实源的入口。
