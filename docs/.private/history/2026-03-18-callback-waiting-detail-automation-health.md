# 2026-03-18-callback-waiting-detail-automation-health

## 本轮判断

- 当前 P0 仍然是 `WAITING_CALLBACK` durable resume 的 operator 可追踪性，而不是样式整理。
- 首页 `callback_waiting_automation` 已经能回答 scheduler 最近是否跑过，但 run detail / publish detail 的 blocker explanation 仍然只能泛化地提示“inspect scheduler or worker”，口径分裂。
- 这会让 operator 在详情页看见 overdue scheduled resume 时，还得回首页补查 scheduler health，削弱同一事实链的闭环。

## 本轮实现

1. `web/app/runs/[runId]/page.tsx` + run diagnostics 链路
   - 详情页额外拉取 `getSystemOverview()`，把 `callback_waiting_automation` 透传到 execution overview blocker 卡片和节点卡片。
2. `web/app/workflows/[workflowId]/page.tsx` + publish activity 链路
   - 复用 workflow 页面已拿到的 `systemOverview.callback_waiting_automation`，一路透传到 invocation detail 的 callback waiting drilldown。
3. `web/lib/callback-waiting-presenters.ts`
   - callback waiting presenter 现在能基于同一份 automation facts 生成 `Automation` blocker row。
   - 当 scheduled resume overdue / cleanup blocker 出现时，详情页会附带相关 scheduler health 摘要；如果 health 不是 healthy，还会补 `scheduler degraded/offline/...` chip。
   - overdue 推荐动作不再只说“inspect scheduler or worker”，会带上当前 automation / scheduler health 摘要。
4. 测试
   - 为 presenter 补充 scheduler health blocker row 和 scheduler chip 的断言，锁住 run/publish 详情解释的新增行为。

## 验证

- `cd web; pnpm exec tsc --noEmit`
- `cd web; pnpm exec vitest run lib/callback-waiting-presenters.test.ts lib/callback-blocker-follow-up.test.ts`
- `cd web; pnpm lint`
- `git diff --check`（仅 CRLF 提示，无新增 diff 错误）

## 下一步建议

1. P0：把相同的 automation health 摘要继续接到 sensitive access inbox 的 callback follow-up，避免第三个入口继续掉队。
2. P0：评估是否把 `callback-blocker-follow-up` 的 before/after snapshot 也带上 automation health，便于 operator 动作后直接判断是否仍被 scheduler 卡住。
3. P1：若后续 waiting 类治理任务继续增多，可把 callback waiting / approval pending 的 automation summary 抽成共享 presenter，避免详情层继续复制解释逻辑。
