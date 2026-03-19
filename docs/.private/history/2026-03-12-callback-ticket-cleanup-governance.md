# 2026-03-12 Callback Ticket Cleanup Governance

## 背景

上一轮已经把 `run_callback_tickets` 从“只有 waiting 状态占位”推进到带 TTL、过期态和事件留痕的生命周期对象，但当时仍缺两块关键治理能力：

- 过期 ticket 只能在“迟到 callback 到达时”被动标记为 `expired`
- 没有独立入口对 stale `pending` tickets 做批量清理，也没有把清理来源写入统一事件流

这意味着 TTL 虽然已经定义，但运行时还没有真正的“清理动作”，`callback ticket` 生命周期并未闭环。

## 目标

- 为 stale `pending` callback tickets 提供独立的批量清理能力
- 避免把治理逻辑继续塞回 `runtime.py` 或 `runs.py`
- 让清理动作复用统一 `run_events`，而不是另起一套治理日志
- 为后续 worker/beat 调度保留直接可复用的任务入口

## 实现

### 1. 新增独立 cleanup orchestration service

新增：

- `api/app/services/run_callback_ticket_cleanup.py`

职责：

- 查询已过期但仍处于 `pending` 的 callback tickets
- 按批次执行 `expired` 转换
- 记录 `run.callback.ticket.expired` 事件
- 返回批量治理结果，供 API 与 worker 复用

这样做的原因是：

- `RunCallbackTicketService` 继续专注单 ticket 的生命周期原语
- 批量清理编排落到独立 service，不继续扩大 `RuntimeService`

### 2. 扩展 ticket lifecycle 原语

更新：

- `api/app/services/run_callback_tickets.py`

新增/补强：

- `snapshot(record)`：对外暴露快照，避免 cleanup service 依赖私有方法
- `list_expired_pending_tickets(...)`：统一 stale ticket 选择逻辑
- `expire_ticket(..., callback_payload=...)`：允许把 `source/cleanup` 等治理来源写入 ticket payload

### 3. 新增独立清理 API

新增：

- `POST /api/runs/callback-tickets/cleanup`

位置：

- `api/app/api/routes/run_callback_tickets.py`

请求支持：

- `source`
- `limit`
- `dry_run`

响应返回：

- 匹配数
- 实际过期数
- 受影响 run IDs
- 每个 ticket 的治理结果明细

这让运行时治理有了可人工触发的最小入口，也便于系统诊断和后续后台任务接入。

### 4. 新增 worker task

更新：

- `api/app/tasks/runtime.py`

新增任务：

- `runtime.cleanup_callback_tickets`

当前作用：

- 为后续 scheduler / beat 自动清理提供直接入口
- 复用同一 cleanup service，不再把过期逻辑散落在 worker 和 API 各写一份

### 5. 统一过期事件中的来源审计

更新：

- `api/app/services/runtime.py`
- `api/app/services/run_callback_ticket_cleanup.py`

当前 `run.callback.ticket.expired` 事件 payload 会显式带出：

- `source`
- `cleanup`
- `ticket`
- `node_id`
- `tool_id`
- `tool_call_id`
- `expires_at`
- `expired_at`

这样无论是“迟到 callback 导致过期”还是“批量 cleanup 导致过期”，都能在同一事件流里区分来源。

## 影响范围

- `api/app/services/runtime.py`
- `api/app/services/run_callback_tickets.py`
- `api/app/services/run_callback_ticket_cleanup.py`
- `api/app/api/routes/run_callback_tickets.py`
- `api/app/tasks/runtime.py`
- `api/app/schemas/run.py`
- `api/app/main.py`
- `api/.env.example`

## 验证

在 `api/.venv` 内执行：

```powershell
.\.venv\Scripts\uv.exe run pytest tests/test_run_callback_ticket_routes.py tests/test_runtime_service.py -q
.\.venv\Scripts\uv.exe run pytest tests/test_run_routes.py -q
```

结果：

- `27 passed`
- `19 passed`

覆盖点：

- cleanup route 可批量过期 stale tickets
- `dry_run` 不改数据库状态
- runtime 侧迟到 callback 过期路径仍然成立
- 原有 run routes 未被新 route 接线破坏

## 当前边界

本轮只补了“批量清理 + 来源审计 + worker 入口”，还没有宣称 callback ticket 治理已经完全完成。

仍未完成：

- 周期性自动调度（beat / cron）还未接线
- callback ingress 的更强鉴权形态还未落地
- 清理结果还没有接到系统诊断首页或运行态治理面板

## 下一步

1. 把 `runtime.cleanup_callback_tickets` 接到正式的周期调度入口，形成真正的自动清理。
2. 继续补 callback ingress 的来源鉴权与签名校验，避免 ticket URL 成为过弱入口。
3. 把 cleanup summary 接入系统诊断或 runtime activity，提供面向人类的治理可见性。
