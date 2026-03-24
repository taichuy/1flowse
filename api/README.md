# 7Flows API

## 本地开发

```powershell
Copy-Item .env.example .env
uv sync --extra dev
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Worker

```powershell
uv run celery -A app.core.celery_app.celery_app worker --loglevel INFO --pool solo
```

## Scheduler

```powershell
uv run celery -A app.core.celery_app.celery_app beat --loglevel INFO
```

默认会按以下周期任务推进 callback waiting 的后台补偿链路：

- `SEVENFLOWS_CALLBACK_TICKET_CLEANUP_INTERVAL_SECONDS` -> `runtime.cleanup_callback_tickets`
- `SEVENFLOWS_WAITING_RESUME_MONITOR_INTERVAL_SECONDS` -> `runtime.monitor_waiting_resumes`

两者都依赖单独启动的 scheduler 进程；如果 beat 未运行，API / worker 本身不会自动代替这些周期治理动作。`/api/system/overview` 现已额外暴露这两类任务最近一次执行事实，便于区分“配置已打开”和“scheduler 最近真的跑过”。

## 迁移

```powershell
uv run alembic upgrade head
uv run alembic downgrade -1
```
