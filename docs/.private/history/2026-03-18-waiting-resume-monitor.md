# 2026-03-18 waiting resume monitor

## 背景

- `WAITING_CALLBACK` 的 durable resume 仍是当前 `P0` 缺口之一。
- 现有 `scheduled_resume` 主要记录 `delay_seconds / reason / source`，一旦 commit 后的单次派发丢失，缺少后台补偿扫描来把等待中的 run 再次推回 resume 主链。

## 本轮实现

1. `scheduled_resume` 现在补齐 `scheduled_at / due_at` 时间事实，并保持对旧 payload 的兼容回收。
2. 新增 `WaitingResumeMonitorService` 与 `runtime.monitor_waiting_resumes` Celery 任务，周期性扫描当前仍处于 `waiting_callback` 的活跃 waiting node。
3. monitor 会对已经到期的 scheduled resume 重新入队，并写入 `run.resume.requeued` 事件，便于 trace / diagnostics 追踪“为什么这次恢复是补偿触发的”。
4. execution view / published invocation waiting lifecycle 现在会把 `scheduled_resume_scheduled_at / scheduled_resume_due_at` 一起暴露出来，方便 operator 判断“原计划何时恢复、是否已经过期未触发”。
5. `.env.example` 已补 waiting resume monitor 的 batch / enabled / interval 配置。

## 验证

- `api/.venv/Scripts/python.exe -m pytest -q tests/test_waiting_resume_monitor.py tests/test_runtime_service_agent_runtime.py tests/test_run_view_routes.py tests/test_workflow_publish_routes.py tests/test_published_invocation_detail_access.py tests/test_celery_app.py`
- `api/.venv/Scripts/python.exe -m pytest -q`
- `api/.venv/Scripts/python.exe -m ruff check ...changed files...`
- `git diff --check`

## 当前剩余缺口

- 这仍不是独立 queue / scheduler；monitor 只是为“派发丢失 / worker 未按计划恢复”补一层 durable compensation。
- `scheduled_resume` 目前仍挂在 checkpoint payload，而不是独立事实表；若后续要做更强的调度审计与去重，需要再把 resume lease / attempt 做成显式模型。
- callback bus、timeout scheduler 与更通用的 waiting/retry orchestration 仍未完全收口。

## 下一步建议

1. 继续把 monitor 视角的 due / overdue 解释接进前端 run diagnostics / inbox 显示，不只停在 API 字段层。
2. 评估是否需要把 waiting resume attempt / lease 提升成独立事实层，减少重复 requeue 与跨 worker 去重问题。
3. 继续把 approval pending / notification retry / callback waiting 的 operator follow-up 收口为统一 blocker explanation。
