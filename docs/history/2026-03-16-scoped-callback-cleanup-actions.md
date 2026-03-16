# 2026-03-16 Scoped callback cleanup actions

## 背景

- `runtime-foundation` 把 `WAITING_CALLBACK` 的 durable resume 语义列为持续 `P0`，但此前 operator 虽然已经能在 run diagnostics、published invocation detail 和 `/sensitive-access` 里看到 callback waiting 事实，却还缺一个“按当前 run / node slice 精确触发 cleanup + resume”的低跳转动作面。
- 现有 `/api/runs/callback-tickets/cleanup` 更偏全局批处理，无法围绕单次 run 或单个 waiting node 做针对性排障，这会让 operator 在怀疑某个 callback ticket 已过期时，要么等 scheduler，要么手工扫全局批次。

## 目标

- 让 callback cleanup 从“后台批任务能力”变成“诊断主链中的可定点运维动作”。
- 保持现有 runtime / waiting 模型不变，只把 cleanup 能力收敛成支持 `run_id / node_run_id` 精确过滤的最小扩展。

## 实现

- 后端为 callback cleanup request 补上 `run_id / node_run_id`，并把过滤下沉到 `RunCallbackTicketService.list_expired_pending_tickets()`，避免在路由或上层 service 里再做第二遍筛选。
- `/api/runs/callback-tickets/cleanup` 现在支持只处理某个 run 或某个 waiting node slice 下的过期 pending ticket，并继续复用原有的过期、schedule resume、termination 逻辑。
- 前端新增 `CallbackWaitingInlineActions`，把“处理过期 ticket 并尝试恢复”直接挂到 `CallbackWaitingSummaryCard`，因此 run diagnostics 与 published invocation callback drilldown 都能共享同一套 callback 运维入口。
- 新的前端动作通过 server action 调用 scoped cleanup route，并按 run 失效刷新首页、`/runs/[id]` 与 `/sensitive-access`，保持 operator 主链里的事实同步。

## 影响范围

- 后端：`api/app/services/run_callback_tickets.py`、`api/app/services/run_callback_ticket_cleanup.py`、`api/app/api/routes/run_callback_tickets.py`、`api/app/schemas/run.py`
- 前端：`web/app/actions/callback-tickets.ts`、`web/components/callback-waiting-inline-actions.tsx`、`web/components/callback-waiting-summary-card.tsx`、`web/components/run-diagnostics-execution/execution-node-card.tsx`、`web/components/run-diagnostics-execution-sections.tsx`、`web/components/workflow-publish-invocation-callback-section.tsx`

## 验证

- `api/.venv/Scripts/uv.exe run pytest tests/test_run_callback_ticket_routes.py -q`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 结果判断

- 这轮不是在修纯展示细节，而是在补 `WAITING_CALLBACK` 的 operator 恢复闭环：callback waiting 现在不仅“看得到”，也开始“能定点处理”。
- 这项改动增强的是应用可靠性、稳定性与运维可恢复性，同时保持了当前架构的扩展性：后续如果接入更真实的 scheduler / sandbox / external callback backend，这个 scoped cleanup 入口仍可复用，不需要再重做 operator surface。

## 下一步

1. 把 callback waiting 的 scoped cleanup 结果进一步汇总到 run execution overview / publish overview 首屏 blocker 摘要。
2. 评估是否需要补“非过期但已满足恢复条件”的 manual resume / reconcile 动作，与 scoped cleanup 形成互补。
3. 继续把 execution / waiting / sensitive access 的 operator 动作抽成共享 action strip，避免 diagnostics 和 publish detail 继续各自长大。
