# 2026-03-15 Waiting Callback Background Resume

## 背景

- 本轮先按仓库约定复核了 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/open-source-commercial-strategy.md`、`docs/technical-design-supplement.md` 与 `docs/dev/runtime-foundation.md`，并检查了最近提交与当前代码热点。
- 最近一次提交 `39de386 feat: surface run trace export blocked states` 主要补的是 run diagnostics / workflow overlay 的 trace export 阻断 UI。它把前端安全落点补齐了，但不需要回头做补救式返工；更合理的衔接是继续回到当前 P0 主线。
- 复核当前实现后，项目已经不是“只有底座”的空框架：`runs / node_runs / run_events / run_artifacts / tool_call_records / ai_call_records`、workflow publish、published gateway、graded execution、sensitive access、callback ticket / waiting-resume 等主干都已具备，能够继续支撑功能性开发、插件扩展、兼容层演进与运行可靠性建设。
- 当前最明显的可靠性缺口之一是：callback ticket cleanup 虽然会把过期票据标成 `expired` 并写 `run.callback.ticket.expired` 事件，但不会继续触发后台 resume，导致 run 可能长期停在 `waiting`，形成“发现过期、却没有续跑”的半闭环。

## 本轮判断

- **基础框架已写到可持续推进主业务完整度的阶段**：后端 runtime、published surface、workflow editor、工作台诊断和统一敏感访问控制都已形成连续骨架，当前不是重新讨论“框架是否存在”的阶段，而是继续沿优先级消化主链缺口。
- **架构方向整体满足后续功能性开发与扩展要求**：当前实现仍坚持 `7Flows IR`、唯一 orchestration owner、统一 `run_events` 事实流、上下文显式授权、execution class 与 node type 分离，以及 published surface 旁挂映射，没有发现兼容协议反客为主或第二套内部 DSL 已经成形的问题。
- **可靠性 / 稳定性仍需继续补强，但不是推倒重来**：P0 主要集中在真实执行隔离、统一敏感访问控制继续闭环、以及 `WAITING_CALLBACK` durable resume；本轮选择先补最后一项，是因为它直接影响“run 是否能从后台自然恢复”，属于最靠近 runtime 主链的可靠性缺口。
- **长文件热点仍然存在，适合继续治理但不阻塞本轮 P0**：后端主要热点仍是 `api/app/services/agent_runtime_llm_support.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/tool_gateway.py`、`api/app/services/run_views.py`；前端热点仍是 `web/components/run-diagnostics-execution-sections.tsx`、`web/lib/get-workflow-publish.ts`、`web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`、`web/components/workspace-starter-library.tsx`。
- **当前仍未进入“只剩人工逐项界面设计 / 人工验收”阶段**：因此本轮不触发用户要求的本地通知脚本。

## 实现

- `api/app/services/run_callback_ticket_cleanup.py`
  - 为 cleanup service 接入 `RunResumeScheduler`。
  - 在 `schedule_resumes=True` 时，把“过期 callback ticket”继续推进为即时 resume 调度，而不是只停留在票据过期与事件落库。
  - 对仍处于 `run.status == waiting` 且 `waiting_status == waiting_callback` 的节点，补写 `checkpoint_payload.scheduled_resume`，并追加统一的 `run.resume.scheduled` 事件，保持 run diagnostics / published detail 能看到相同事实。
- `api/app/tasks/runtime.py`
  - 将 `runtime.cleanup_callback_tickets` Celery 任务接到上述能力，默认在后台清理过期 ticket 后，通过 `callback_ticket_monitor` 继续排队即时 resume，补上 beat -> cleanup -> resume 的后台链路。
- `api/tests/test_run_callback_ticket_routes.py`
  - 新增测试，验证 cleanup service 在 ticket 过期后会：更新 ticket 状态、调度 resume、写入 `scheduled_resume` checkpoint，并落库 `run.resume.scheduled` 事件。

## 影响范围

- 后台定时 cleanup 不再只是“把票据标记成 expired”，而会继续把 run 送回 runtime 主链，避免 `waiting_callback` 场景长时间挂死在无后续动作的状态。
- `run_events` 与 `checkpoint_payload.scheduled_resume` 现在会同步体现这次后台唤醒决定，工作台、publish detail 和后续 AI 排障都能从统一事实层读取到相同信息。
- 本轮没有改变 callback receipt 的对外 contract：晚到回调仍会收到 `expired` 状态；只是后台清理过期票据后，系统终于会主动安排后续 resume，而不是让 run 永远停在等待态。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q .\tests\test_run_callback_ticket_routes.py`
- `api/.venv/Scripts/uv.exe run ruff check app/services/run_callback_ticket_cleanup.py app/tasks/runtime.py tests/test_run_callback_ticket_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`

## 下一步

1. **P0**：继续把 `WAITING_CALLBACK` 的 late callback / repeated waiting / retry-backoff 语义收清，避免某些外部 callback 型工具在边界场景里反复挂起。
2. **P0**：继续扩统一敏感访问控制到 publish export 与真实通知 worker / inbox，避免安全治理仍只停留在局部主链。
3. **P0**：继续把 graded execution 从 execution-aware 扩成真实隔离能力，优先补 `sandbox` / `microvm` tool adapter 与 compat plugin execution boundary。
4. **P1**：继续治理 `agent_runtime_llm_support.py`、`runtime_node_dispatch_support.py`、`run-diagnostics-execution-sections.tsx` 等结构热点，避免复杂逻辑重新回涨成新的单体文件。
