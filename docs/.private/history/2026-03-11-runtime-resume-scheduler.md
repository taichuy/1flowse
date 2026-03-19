# 2026-03-11 Runtime Resume Scheduler

## 背景

Durable Agent Runtime Phase 1 已经把 `waiting / resume / checkpoint / phase` 的最小闭环做出来，但运行恢复仍有两个明显断层：

- `POST /api/runs/{run_id}/resume` 还是手动入口，worker 没有接住 waiting run
- 节点重试的 backoff 仍使用同步阻塞等待，会拖住当前执行线程

这意味着 runtime 已经“可恢复”，但还没有真正迈进“可被后台调度恢复”的阶段。

## 目标

本轮不做完整 queue / callback bus，而是补一个最小可用的恢复调度层：

1. 让 waiting run 能被 worker 侧任务重新唤醒
2. 让带 backoff 的 retry 不再依赖 `time.sleep`
3. 让 tool waiting 可以通过元数据声明自动恢复计划
4. 保持现有 `checkpoint + resume` 语义不变，不额外引入第二套状态机

## 实现决策

### 1. 新增独立的 Run Resume Scheduler

新增：

- `api/app/services/run_resume_scheduler.py`

职责：

- 封装“恢复一个 run”的调度请求
- 默认把调度请求投递给 Celery，而不是把队列细节写进 `RuntimeService`
- 允许测试时注入自定义 dispatcher，避免 runtime 测试依赖真实 broker

这让“执行器”和“调度器”开始分层，而不是继续把后台恢复逻辑塞回 `runtime.py`。

### 2. Worker 新增 `runtime.resume_run` 任务

新增：

- `api/app/tasks/runtime.py`
- `api/app/core/celery_app.py`

当前行为：

- worker 可以消费 `runtime.resume_run`
- 任务会先检查 run 是否仍处于 `waiting`
- 若 run 已被手动恢复或已结束，则任务幂等跳过
- 若 run 仍在等待，则调用现有 `RuntimeService.resume_run(...)`

这一步还不是完整 callback bus，但已经让后台恢复有了真实执行入口。

### 3. Retry backoff 改为“挂起 + 调度恢复”

修改：

- `api/app/services/runtime.py`

当前行为：

- 节点失败且还有重试次数时，仍记录 `node.retrying`
- 当 `backoffSeconds > 0`，不再同步 `sleep`
- runtime 会把 run 标记为 `waiting`，把 node 标记为 `retrying`
- `node_runs.checkpoint_payload.retry_state` 会记录下一次尝试编号和延迟信息
- scheduler 会投递一次 `run.resume.scheduled`

这意味着 retry 终于开始复用 durable waiting 语义，而不是继续走“同步重试 + 阻塞线程”的临时路径。

### 4. Tool waiting 支持声明式自动恢复

修改：

- `api/app/services/agent_runtime.py`
- `api/app/services/runtime_types.py`

当前约定：

- tool 返回 `status = "waiting"` 时，可额外提供：
  - `meta.waiting_status`
    - 当前支持 `waiting_tool` / `waiting_callback`
  - `meta.resume_after_seconds`
    - 告诉 runtime 何时自动恢复

如果声明了 `resume_after_seconds`：

- runtime 会写入 `node_runs.checkpoint_payload.scheduled_resume`
- worker 侧会收到恢复调度
- 事件流会记录 `run.resume.scheduled`

如果没有声明：

- 仍保持现有手动 `resume` 路径

### 5. 顺手修正了 waiting tool 的恢复语义

在补调度测试时发现两个隐藏问题，一并修正：

1. `next_tool_index = 0` 在恢复时会被 `or` 误判为假值，导致恢复路径可能跳过真正的 tool 重试
2. 同一个 tool call 从 `waiting` 恢复后，最终结果不应继续追加到列表尾部，而应覆盖原来的 waiting 占位结果

这两个问题都落在：

- `api/app/services/agent_runtime.py`

修完之后，tool waiting 的恢复语义与新的自动调度路径保持一致。

## 影响范围

- `api/app/services/runtime.py`
- `api/app/services/agent_runtime.py`
- `api/app/services/runtime_types.py`
- `api/app/services/run_resume_scheduler.py`
- `api/app/tasks/runtime.py`
- `api/app/core/celery_app.py`
- `api/app/api/routes/runs.py`
- `api/tests/test_runtime_service.py`

## 验证

已完成验证：

- `api/.venv/Scripts/python.exe -m ruff check app/services/run_resume_scheduler.py app/tasks/runtime.py app/services/runtime.py app/services/agent_runtime.py app/services/runtime_types.py app/api/routes/runs.py tests/test_runtime_service.py`
- `api/.venv/Scripts/python.exe -m pytest tests/test_runtime_service.py -q`
- `api/.venv/Scripts/python.exe -m pytest tests/test_run_routes.py -q`
- `api/.venv/Scripts/python.exe -m pytest -q`

重点覆盖：

- retry backoff 会进入 `waiting + retrying`，并产出恢复调度
- waiting callback 可以声明 `resume_after_seconds`
- 恢复后的 tool 结果会覆盖 waiting 占位结果，而不是重复叠加
- 现有 runs 路由与完整后端测试集不回归

## 当前结论

本轮完成后，7Flows runtime 已经从“只有手动 resume 的可恢复执行器”，推进到“具备最小后台恢复入口的 Phase 1.5”：

- 还没有完整 callback event bus
- 还没有 scheduler 级别的 dead-letter / dedupe / metrics
- 但 worker 已经能接手部分 waiting / retry 恢复闭环

## 未决问题

1. `WAITING_CALLBACK` 目前仍缺少正式的外部回调入口，自动恢复仍主要依赖时间驱动而不是事件驱动。
2. 调度任务目前是最小实现，还没有队列隔离、失败重投策略和更细的观测面。
3. `RuntimeService` 现在 1187 行，虽然仍在后端文件体量偏好之内，但如果继续把 callback ingress、scheduler 观测和 publish binding 都加进去，下一轮应优先继续拆分。
