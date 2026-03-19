# 2026-03-16 Sensitive Access Notification Worker

## 背景

- 用户要求先系统阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md`，再结合最近一次 Git 提交判断项目现状、基础框架是否成立、上一次提交是否需要衔接，以及当前架构是否足以继续推进产品设计要求。
- 复核最近提交 `e24c00e feat: add sensitive access timeline drilldown` 后，结论是：上一轮已经把敏感访问 timeline 的筛选、cross-link 和 inbox slice 做到位，但通知链仍停留在“request path 直接写失败”的占位实现，这会把 `NotificationDispatch` 的 durable 语义和 worker/adapter 扩展点都提前锁死。
- 结合 `docs/dev/runtime-foundation.md` 的优先级，本轮最值得衔接的不是返工 workflow/runtime 基座，而是继续沿敏感访问主线，把通知从“事实层可见”推进到“事务后可派发、可重试、可扩真实 adapter”的状态。

## 项目现状判断

### 1. 上一次 Git 提交是否需要衔接

- 结论：**需要继续衔接。** `e24c00e` 已经把敏感访问 timeline 做成 operator 可用的 drilldown 入口，但如果通知仍在 request path 里直接标记 `failed`，那 inbox / timeline / retry 只是 UI 层更完整，底层却没有真正的异步派发语义，后续很难安全补 webhook/slack/email/feishu adapter。

### 2. 基础框架是否已经写好

- 结论：**是。** 当前仓库已经具备 `SensitiveResource / SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 事实层、`waiting/resume` 主链、Celery worker 与 transaction-aware scheduler 模式（`RunResumeScheduler`），这足以承载通知 worker 的同类落地，不需要另起第二套执行控制面。

### 3. 架构是否满足后续功能推进、扩展性与稳定性

- 结论：**满足，但通知链需要收口到独立 service 边界。**
- 后端整体仍坚持 `7Flows IR + 单一 runtime orchestration + shared fact layer`，没有因敏感访问、publish 或 run diagnostics 派生第二套核心模型。
- 现有热点中，`runtime_node_dispatch_support.py`、`agent_runtime_llm_support.py`、`run_views.py` 仍较长，但都已经有明确子模块拆层方向；本轮补通知 worker 时继续沿 `scheduler / delivery adapter / task` 分层扩展，没有把逻辑重新堆回 `sensitive_access_control.py`。
- 前端热点仍主要集中在 `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`、`web/components/workflow-editor-publish-endpoint-card.tsx`、`web/components/sensitive-access-timeline-entry-list.tsx`，但这些热点当前更多是交互完整度问题，而不是阻断后续功能开发的架构性缺陷。

## 本轮目标

1. 把外部通知从“创建即失败”改成真正的 `pending -> worker -> delivered/failed` 主链。
2. 复用现有 transaction-aware scheduler 模式，避免 worker 在事务提交前读取不到新建 `NotificationDispatchRecord`。
3. 为 webhook/slack/feishu/email 保留明确 adapter 扩展点，同时先交付最小真实 webhook 投递能力。

## 实现

### 1. 新增 transaction-aware 的通知调度器

- 新增 `api/app/services/notification_dispatch_scheduler.py`。
- 设计与既有 `RunResumeScheduler` 对齐：
  - `schedule(..., db=...)` 先把 dispatch 请求挂到 session info
  - 事务 `after_commit` 后再真正派发
  - rollback / soft rollback 时清空待派发请求
- 这样敏感访问请求与 notification dispatch 可以共享同一条“先提交事实，再异步派发”的一致语义。

### 2. 新增通知投递 service 与 adapter 分层

- 新增 `api/app/services/notification_delivery.py`。
- 把投递逻辑从 `SensitiveAccessControlService` 中拆到独立 delivery service，避免审批请求创建与投递实现耦死在同一个 service。
- 当前 adapter 语义：
  - `in_app`：继续即时记为 `delivered`
  - `webhook`：新增最小真实 HTTP POST 投递
  - `slack` / `feishu`：当 `target` 直接提供 webhook URL 时可投递；否则明确失败
  - `email`：保留独立 adapter 槽位，当前明确返回“尚未配置 mail adapter”而不是假装成功

### 3. 新增 Celery task，真正承接 dispatch worker

- 新增 `api/app/tasks/notifications.py`，任务名为 `notifications.deliver_dispatch`。
- `api/app/core/celery_app.py` 已把 `app.tasks.notifications` 纳入 Celery include。
- `SensitiveAccessControlService` 现在只负责：
  - 创建 `NotificationDispatchRecord`
  - 为外部通道初始化 `pending` 状态
  - 在 request / retry 后通过 scheduler 派发 worker

### 4. 敏感访问 request/retry 语义调整

- `in_app` 通道仍保持即时 `delivered`，不需要 worker。
- `webhook / slack / feishu / email` 不再在 request path 直接写 `failed`，而是先写 `pending`，再交给 worker 决定最终结果。
- `/api/sensitive-access/notification-dispatches/{dispatch_id}/retry` 现在也复用相同链路：新 attempt 先写 `pending`，然后重新入队。

## 影响范围

- 后端敏感访问主链：`api/app/services/sensitive_access_control.py`
- 新增投递/调度层：
  - `api/app/services/notification_dispatch_scheduler.py`
  - `api/app/services/notification_delivery.py`
  - `api/app/tasks/notifications.py`
- 配置与环境说明：
  - `api/app/core/config.py`
  - `api/.env.example`
- 测试：
  - `api/tests/test_notification_dispatch_scheduler.py`
  - `api/tests/test_notification_delivery.py`
  - `api/tests/test_sensitive_access_routes.py`
  - `api/tests/test_celery_app.py`

## 验证

在 `api/` 目录执行：

```powershell
uv run pytest -q
uv run ruff check app/services/notification_dispatch_scheduler.py app/services/notification_delivery.py app/tasks/notifications.py app/services/sensitive_access_control.py tests/test_notification_dispatch_scheduler.py tests/test_notification_delivery.py tests/test_sensitive_access_routes.py tests/test_celery_app.py
```

结果：通过。

- `uv run pytest -q`：`278 passed`
- `uv run ruff check ...`：All checks passed

## 结论

- 当前项目的基础框架已经足够支撑继续围绕产品设计推进，不需要为“通知 worker”另起执行引擎、第二套事件流或专用审批 DSL。
- 当前架构对后续插件扩展性、兼容性、可靠性与安全性的主要约束仍然是“继续在既有 service/task/fact layer 上拆层前进”，而不是整体推翻。
- 部分代码文件仍然偏长，但当前更值得优先拆的仍是 runtime / run view / editor graph 热点，而不是本轮已经拆开的敏感访问通知链。
- 项目**仍未进入**“只剩人工逐项界面设计 / 全链路人工验收”的阶段，因此本轮**不触发** `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。

## 下一步建议

1. **P0**：补 `email / slack / feishu` 的真实 adapter 配置与 delivery contract，避免外部通道仍只支持 webhook URL 模式或诚实失败。
2. **P0**：在 inbox / run / published detail 中增加批量 retry、批量 approve/reject 与统一 security explanation，继续把 operator 控制面补完整。
3. **P1**：继续拆 `api/app/services/run_views.py`、`api/app/services/agent_runtime_llm_support.py`、`web/components/workflow-editor-workbench/use-workflow-editor-graph.ts` 等结构热点，避免下一轮主业务功能把这些文件重新推回单体。
