# 2026-03-15 WAITING_CALLBACK 最大过期次数与终止边界

## 背景

- `c88dd5a feat: surface callback lifecycle in published waiting views` 已经把 `callback_waiting_lifecycle` 摘要挂到 published waiting surface，但 runtime 侧仍缺少“重复过期多少次后应该明确停机”的边界。
- 当前工作区里已经开始补 `WAITING_CALLBACK` 的 repeated expiry 终止策略；在收尾验证中，`api/.venv/Scripts/uv.exe run pytest -q` 额外暴露出一个遗漏：`RuntimeService.receive_callback()` 在收到已过期 callback 时，已经会主动走 follow-up resume/backoff，但旧测试还停留在“不会调度 resume”的假设，并因此误触发默认 Celery/Redis 调度路径。
- 这意味着本轮不仅要把终止策略闭环补齐，也要把 direct expired-callback 路径的测试与运行事实对齐，避免后续 callback 型节点又回到“语义在变、测试没跟上”的状态。

## 目标

- 为 `WAITING_CALLBACK` 建立最小可用的“最大过期次数 -> 终止失败”边界，避免 run 长期无限 backoff。
- 让 cleanup、manual cleanup 和 direct expired callback 三条入口共用同一套 durable waiting 生命周期事实，而不是在 route/runtime/published 各自长出一套特判。
- 同步更新 run diagnostics / published waiting surface 的展示与测试，使终止态、最大过期次数和 follow-up resume 行为都有稳定验证。

## 实现

- `api/app/core/config.py`
  - 新增 `callback_ticket_max_expired_cycles` 配置，作为 runtime 统一终止阈值。
- `api/app/services/callback_waiting_lifecycle.py`
  - 为 checkpoint 内的 `callback_waiting_lifecycle` 增加 `max_expired_ticket_count`、`terminated`、`termination_reason`、`terminated_at`。
  - 新增 termination policy / termination record helper，让 repeated expiry、termination summary 与后续展示共享同一份 payload 结构。
- `api/app/services/run_callback_ticket_cleanup.py`
  - cleanup 过期 ticket 后会先刷新 lifecycle，再按阈值判断是继续 schedule resume，还是直接写入 `run.callback.waiting.terminated` / `run.failed` 并终止对应 run 与 node run。
  - `cleanup_stale_tickets()` 的结果摘要同步带出 `terminated_count` 与 `terminated_run_ids`，便于 API、worker 和后续治理面复用。
- `api/app/services/runtime_run_support.py`
  - `receive_callback()` 在发现 ticket 已过期时，沿用同一套 `expire_ticket_and_follow_up()` 逻辑；如果 run 仍处于 waiting，会继续 schedule follow-up resume/backoff，而不是停留在“记录 expired 但没有后续动作”的半闭环。
- `api/app/schemas/run.py`、`api/app/schemas/run_views.py`、`api/app/services/run_views.py`
  - run views / execution diagnostics 补齐新的 lifecycle 字段，使 API 响应能直接表达最大过期次数与终止态。
- `web/components/run-diagnostics-execution-sections.tsx`
  - execution view 增加 `max expired` 与 `terminated` 摘要，终止后直接显示 reason / timestamp。
- `web/components/workflow-publish-invocation-detail-panel.tsx`、`web/components/workflow-publish-invocation-entry-card.tsx`、`web/lib/get-run-views.ts`
  - published waiting surface 同步消费新的 lifecycle 字段，保证 run diagnostics 与 published 详情页看到的是同一套 callback waiting 事实。
- `api/tests/test_run_callback_ticket_routes.py`、`api/tests/test_run_routes.py`、`api/tests/test_run_view_routes.py`、`api/tests/test_workflow_publish_routes.py`、`api/tests/test_published_invocation_detail_access.py`
  - 覆盖 cleanup、route、run views 与 published surface 上的 termination / max-expired 语义。
- `api/tests/test_runtime_service_agent_runtime.py`
  - 把 direct expired callback 用例改成显式注入 `RunResumeScheduler(dispatcher=scheduled_resumes.append)`，并验证“拒绝过期 callback + 仍为 waiting run 安排 follow-up resume”的当前事实，避免测试误触真实 Celery/Redis。

## 影响范围

- `WAITING_CALLBACK` 现在既能 repeated expiry backoff，也有明确的 stop boundary；callback 型节点不再只能“不断等下去”。
- direct expired callback 路径和 cleanup 路径重新收敛到统一事实链：`ticket expired -> lifecycle update -> resume or terminate -> shared run/published views`。
- run diagnostics 与 published waiting surface 现在都能直接回答“当前允许最多过期几次、是否已经终止、为什么终止”。
- 这次改动仍保持 runtime 唯一主控：终止语义由 runtime/callback lifecycle 主链决定，前端和 published 层只做事实复用与展示。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_run_callback_ticket_routes.py tests/test_run_routes.py tests/test_run_view_routes.py tests/test_workflow_publish_routes.py tests/test_published_invocation_detail_access.py`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_service_agent_runtime.py::test_expired_callback_ticket_is_rejected_and_schedules_waiting_run_resume`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `web/pnpm lint`
- `web/pnpm exec tsc --noEmit`

## 下一步

- 优先把 callback source 聚合成更稳定的诊断摘要，避免 cleanup / route / external callback 来源仍然分散在事件文案里。
- 继续补 published callback drilldown 与通知 worker / inbox，把 callback 型 waiting run 的人工治理入口统一到同一条链路。
- 在前端侧继续拆 `web/components/run-diagnostics-execution-sections.tsx`，避免 callback lifecycle、tool trace 和 node diagnostics 长期堆在一个 500+ 行组件里。
