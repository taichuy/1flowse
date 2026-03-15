# 2026-03-15 手动 callback cleanup 与 after-commit resume 一致化

## 背景

- `ba0b0e5 feat: wake waiting callbacks after cleanup` 已经把后台 `runtime.cleanup_callback_tickets` 接到“过期 ticket -> immediate resume”主链。
- 但同一轮复核里仍有两个续接缺口：
  - 手动 `/api/runs/callback-tickets/cleanup` 只会过期 ticket，不会继续调度 resume。
  - `RunResumeScheduler` 在多个主链上都是“先派发、后提交事务”，理论上可能让 worker / Celery 先读到未提交的 waiting-state 变更。

## 目标

- 让手动 cleanup 与后台 cleanup 保持一致，避免 operator 路径和 scheduler 路径语义分叉。
- 把 run resume 调度改成 transaction-aware after-commit dispatch，降低 waiting / approval / cleanup 场景的竞态风险。

## 实现

- `api/app/services/run_resume_scheduler.py`
  - 为 `RunResumeScheduler.schedule()` 增加 `db` 参数。
  - 当调度附着在 SQLAlchemy `Session` 上时，不再立刻派发，而是把 resume 请求暂存到 `session.info`。
  - 通过 `after_commit` 统一派发，`after_rollback` / `after_soft_rollback` 统一清理，避免未提交事务也触发 resume。
- `api/app/services/runtime_lifecycle_support.py`
  - runtime `waiting resume` 改为跟随当前事务提交后派发。
- `api/app/services/sensitive_access_control.py`
  - 审批通过后的 run resume 改为 after-commit dispatch，避免审批记录尚未提交就恢复执行。
- `api/app/services/run_callback_ticket_cleanup.py`
  - cleanup service 返回 `scheduled_resume_count` / `scheduled_resume_run_ids`，让 API 和测试可以直接看到 cleanup 是否真的排队 resume。
  - callback cleanup 的 resume 调度改为 after-commit dispatch。
- `api/app/api/routes/run_callback_tickets.py`
  - 手动 cleanup 路由默认开启 `schedule_resumes`，让 operator 路径与后台路径行为一致。
  - 保留 `schedule_resumes=false` 作为显式退出口，便于只做 ticket 过期检查或 dry-run。
- `api/app/schemas/run.py`
  - cleanup request/response 补齐 `schedule_resumes` 与调度结果字段。

## 影响范围

- `waiting_callback` 场景下，后台 cleanup 和手动 cleanup 现在都会把 run 接回统一 resume 主链，不再出现“后台能续跑、人工入口只做半套”的分叉。
- `runtime_waiting`、`sensitive_access_decision`、`callback_ticket_cleanup` 的 resume 派发现在都晚于事务提交，降低 worker 抢先读未提交状态的风险。
- operator API 现在能直接看到 cleanup 本轮是否安排了 resume，有利于工作台和后续 AI 排障复用相同事实。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q .\tests\test_run_callback_ticket_routes.py .\tests\test_run_resume_scheduler.py`
- `api/.venv/Scripts/uv.exe run ruff check app/api/routes/run_callback_tickets.py app/schemas/run.py app/services/run_callback_ticket_cleanup.py app/services/run_resume_scheduler.py app/services/runtime_execution_progress_support.py app/services/runtime_lifecycle_support.py app/services/sensitive_access_control.py tests/test_run_callback_ticket_routes.py tests/test_run_resume_scheduler.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `git diff --check`

## 未决问题 / 下一步

1. 继续补 `WAITING_CALLBACK` 的 late callback、repeated waiting 和退避摘要，避免外部 callback 型节点边界行为仍不清晰。
2. 继续把统一敏感访问控制扩到 publish export 和真实通知 worker / inbox。
3. 继续治理 `agent_runtime_llm_support.py`、`runtime_node_dispatch_support.py`、`run-diagnostics-execution-sections.tsx` 等结构热点，避免可靠性逻辑再次回流到单体文件。
