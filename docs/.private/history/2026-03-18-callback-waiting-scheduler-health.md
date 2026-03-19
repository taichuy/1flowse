# 2026-03-18 callback waiting scheduler health

## 本轮判断

- 当前项目仍未进入“只剩样式整理或人工验收”的阶段，`WAITING_CALLBACK` durable resume 仍是 P0 主线之一。
- 前几轮已把 callback waiting automation 的“配置事实”与 overdue blocker 暴露出来，但首页 / system overview 还无法回答“scheduler 最近是否真的跑过”。
- 这会让 operator 只能看到 beat 已配置，却看不到 beat/worker 是否真的在持续执行，影响对后台补偿链路的可信判断。

## 本轮实现

1. `api/app/models/scheduler.py` + migration
   - 新增 `scheduled_task_runs` 持久化事实表，记录周期任务的开始/结束、状态、matched/affected 计数与摘要。
2. `api/app/tasks/runtime.py`
   - 为 `runtime.cleanup_callback_tickets` 与 `runtime.monitor_waiting_resumes` 增加成功 / 失败执行事实落库。
   - 即使本次 matched/affected 为 0，也会留下“scheduler 至少跑过一次”的事实。
3. `api/app/api/routes/system.py` + `api/app/schemas/system.py`
   - `callback_waiting_automation` 从“只有配置状态”扩成“配置状态 + scheduler health”。
   - 每个 step 现在都会返回最近执行状态、开始/完成时间、matched/affected 计数与新鲜度解释。
4. `web/components/callback-waiting-automation-panel.tsx`
   - 首页面板新增 scheduler health 汇总与 step 级最近执行信息，直接区分“已配置”和“最近真跑过”。
5. 文档
   - 更新 `README.md`、`api/README.md`，把首页/system overview 已能暴露 scheduler 最近执行事实写明。

## 验证

- `cd api; ./.venv/Scripts/uv.exe run pytest -q tests/test_system_routes.py tests/test_runtime_tasks.py tests/test_celery_app.py`
- `cd api; ./.venv/Scripts/uv.exe run ruff check app/models/scheduler.py app/services/scheduled_task_activity.py app/api/routes/system.py app/schemas/system.py app/tasks/runtime.py tests/test_system_routes.py tests/test_runtime_tasks.py`
- `cd web; pnpm exec tsc --noEmit`
- `cd web; pnpm lint`
- `git diff --check`（仅现有 LF/CRLF 警告）

## 额外观察

- 后端全量 `pytest -q` 目前仍有一个与本轮无关的既有失败：
  - `api/tests/test_workflow_publish_routes.py::test_get_published_invocation_detail_drills_into_run_callback_and_cache`
  - 现象是断言未接受已有返回字段 `sensitive_access_summary`。
- 本轮未触碰 published invocation detail 相关实现，先按“既有失败”记录，后续若要清全量 pytest，可单独收束该测试/契约。

## 下一步建议

1. P0：把 callback waiting automation 的最近执行事实继续接入 run detail / publish detail 的 blocker explanation，避免首页与详情页口径分裂。
2. P0：评估是否把 approval ticket expiry scheduler 也接入同一套 `scheduled_task_runs` 事实，统一等待类治理任务的 operator 可信度判断。
3. P1：如果后续要做更强的 scheduler 可信审计，可继续补 heartbeat / lease / last success lag，而不只停留在 latest run snapshot。
