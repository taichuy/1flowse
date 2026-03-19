# 2026-03-18 callback blocker automation health follow-up

## 本轮判断

- 当前项目仍处于主链持续加厚阶段，不是只剩样式整理；`WAITING_CALLBACK` durable resume 仍是 P0。
- 近几轮已经把 callback waiting automation health 接到 run detail / publish detail / sensitive access inbox 的解释层，但 operator action 的 before/after blocker follow-up 仍只比较 blocker kind 与 recommended action。
- 这会让审批、通知重试、manual resume、callback cleanup 之后的结果文案无法回答“现在是不是仍被 scheduler / automation 卡住”，operator 还得跳回 system overview 二次确认。

## 本轮实现

1. `web/lib/callback-waiting-presenters.ts`
   - 新增 `getCallbackWaitingAutomationHealthSnapshot()`，把 callback waiting automation 的 relevant step / overall status / scheduler health 收口成可复用 health snapshot。
2. `web/lib/callback-blocker-follow-up.ts`
   - blocker snapshot 现在会携带 `automationHealth`。
   - `formatCallbackBlockerDeltaSummary()` 在 blocker 没变化时也会附带 automation 摘要；若 automation health 发生变化，会明确给出 before/after 对比。
   - `summarizeBulkCallbackBlockerDelta()` 把 automation health 变化也计入 `changedScopeCount`，避免 bulk follow-up 误报“没有变化”。
3. `web/app/actions/callback-tickets.ts`、`web/app/actions/runs.ts`、`web/app/actions/sensitive-access.ts`
   - operator action 现在会在动作后重新读取一遍 `getSystemOverview().callback_waiting_automation`，而不是复用动作前的 automation snapshot。
   - 这样 cleanup / manual resume / bulk approval / bulk retry 的 follow-up message 会反映最新 automation health。
4. `web/lib/callback-blocker-follow-up.test.ts`
   - 补测试锁住 automation snapshot、automation-only delta summary，以及 bulk changed count 的新行为。

## 验证

- `cd web; pnpm exec vitest run lib/callback-blocker-follow-up.test.ts`
- `cd web; pnpm exec tsc --noEmit`
- `cd web; pnpm lint`

## 下一步建议

1. P0：把同样的 automation health delta 继续接到 run / inbox 上的 operator toast 或 inline result card，减少“动作成功但原因仍不明”的认知断层。
2. P0：继续回到统一高风险执行主链，检查 execution preflight / runtime blocker explanation / system overview 是否还有同类“前后事实不一致”的口径漂移。
3. P1：若后续 waiting 类治理继续扩张，可把 operator follow-up 的 snapshot/delta 结构沉淀成共享 helper，避免 callback / approval / notification 三条链继续平行演化。
