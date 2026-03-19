# 2026-03-18 scheduled resume overdue 可见性补齐

## 本轮判断

- 当前项目仍未进入“只剩样式整理或人工验收”的阶段，`WAITING_CALLBACK` 的 durable resume 仍是 P0 主线。
- 后端已把 `scheduled_resume_scheduled_at / scheduled_resume_due_at` 暴露到 API，但前端 run diagnostics、publish detail 与 sensitive inbox 还没有把“何时计划恢复、是否已经过期未触发”接入统一 blocker explanation。
- 这会让 operator 只能看到“有 scheduled resume”，却看不到“已经超过 due_at 仍未恢复”，不利于定位 scheduler / worker 是否漏跑。

## 本轮实现

1. `web/lib/get-run-views.ts` 与 `web/lib/workflow-publish-types.ts`
   - 补齐 `scheduled_resume_scheduled_at / scheduled_resume_due_at` 前端类型。
2. `web/lib/callback-waiting-presenters.ts`
   - 新增 scheduled resume timing 解析与格式化。
   - 在 blocker status、chips、recommended action、detail rows 中统一暴露 `scheduled / due / overdue`。
   - 当恢复已过 `due_at` 时，不再继续提示被动等待，而是建议检查 scheduler/worker 并可人工恢复。
3. `web/components/*callback*`、`run-diagnostics`、`workflow-publish`、`sensitive-access-inbox`
   - 三个入口统一透传 scheduled resume timing 字段，复用同一份 summary card / presenter 口径。
4. 测试
   - 扩展 `callback-waiting-presenters.test.ts`
   - 更新 `sensitive-access-inbox-callback-context.test.ts`
   - 保持 `callback-blocker-follow-up.test.ts` 通过

## 验证

- `cd web; pnpm exec tsc --noEmit`
- `cd web; pnpm test`
- `cd web; pnpm lint`

## 下一步建议

1. P0：把 overdue scheduled resume 的解释继续接入后端 system overview / scheduler health，避免当前只能看到 due facts，看不到 scheduler 最近是否真的执行。
2. P0：继续统一 callback waiting / approval pending / notification retry 的 blocker summary 文案，减少 publish、run、inbox 三处轻微差异。
3. P1：评估是否需要把 waiting resume attempt / lease 升成独立事实层，避免未来跨 worker 重复 requeue 与可观测性不足。
