# 2026-03-12 Callback Ticket Lifecycle Hardening

## 背景

`waiting_callback` 在前几轮已经具备最小 callback ingress，但 `run_callback_tickets` 仍只是一次性占位记录：

- 没有 TTL 或到期时间，外部 callback 永远可以继续尝试消费旧 ticket
- 没有显式 `expired` 状态，执行视图和事件流无法区分“重复回调”和“过期回调”
- `runtime.py` 因持续叠加职责逼近文件体量上限，需要顺手收口

在补 callback 生命周期时，全量 `api` 测试又暴露出另一个老问题：workflow version 和 workspace starter history 只按时间戳单键排序，SQLite 下会因为时间精度抖动导致验证结果不稳定。

## 目标

1. 把 callback ticket 从“最小占位记录”提升为“带 TTL 的生命周期对象”
2. 让 callback 过期态进入统一运行事实层，而不是只在路由里返回错误
3. 把本轮验证基线恢复为稳定可重复，避免后续开发被历史排序抖动干扰
4. 在不继续堆叠 `runtime.py` 的前提下完成改动

## 实现与决策

### 1. Callback ticket 增加 TTL / 过期态

本轮新增：

- 配置项 `SEVENFLOWS_CALLBACK_TICKET_TTL_SECONDS`
- `run_callback_tickets.expires_at`
- `run_callback_tickets.expired_at`
- callback 返回状态 `expired`

对应实现：

- `RunCallbackTicketService.issue_ticket()` 在签发 ticket 时写入 `expires_at`
- `RuntimeService.receive_callback()` 在消费前统一判断 ticket 是否过期
- 过期时不再尝试恢复 run，而是：
  - 把 ticket 标记为 `expired`
  - 写入 `run.callback.ticket.expired`
  - 返回 `callback_status=expired`

这样 callback 生命周期现在至少具备：

- `pending`
- `consumed`
- `canceled`
- `expired`

### 2. execution view / checkpoint 同步暴露生命周期信息

为了让人类面板和机器侧追溯都能直接看到 ticket 生命周期，而不是依赖额外推断：

- `callback_ticket` checkpoint 现在会带上 `expires_at`
- `execution-view` 中的 `callback_tickets` 现在会返回：
  - `expires_at`
  - `expired_at`

这保证调试面板、执行视图和回放链路都继续建立在统一运行事实之上，而不是为了过期态临时拼一层 UI 私有状态。

### 3. runtime.py 轻量拆分，重新压回体量阈值内

由于 callback 生命周期补完后 `api/app/services/runtime.py` 超过了后端 1500 行偏好阈值，本轮同步做了轻量拆分：

- 新增 `api/app/services/runtime_records.py`
- 把 `ExecutionArtifacts` 与 `CallbackHandleResult` 从 `runtime.py` 抽离

结果：

- `runtime.py` 当前约 1496 行，重新回到阈值内
- 主执行器继续聚焦执行编排，而不是堆积返回模型定义

### 4. 验证过程中顺手修复历史排序抖动

为恢复全量 `api` 验证基线，本轮额外收口了两处老问题：

- workflow versions 改为按语义版本号 + 时间做稳定排序
- workspace starter history 在写入时保证时间戳单调递增，并在查询时增加稳定次序

这不是 callback 功能本身的一部分，但它直接影响“本轮修改是否真的能被稳定验证”，因此一并修复。

## 影响范围

- `api/app/core/config.py`
- `api/app/models/run.py`
- `api/app/services/run_callback_tickets.py`
- `api/app/services/runtime.py`
- `api/app/services/runtime_records.py`
- `api/app/services/run_views.py`
- `api/app/api/routes/workflows.py`
- `api/app/services/workspace_starter_templates.py`
- `api/app/schemas/run.py`
- `api/app/schemas/run_views.py`
- `api/migrations/versions/20260312_0015_run_callback_ticket_expiry.py`

## 验证

已执行：

```powershell
cd api
.\.venv\Scripts\python.exe -m pytest
```

结果：

- `119 passed`

另外单独验证了 callback 相关链路：

- runtime service callback 恢复
- expired callback 拒绝消费
- route callback 返回 `expired`
- execution view 返回 ticket 生命周期时间字段

## 当前边界

本轮只是把 callback ticket 做成“最小生命周期对象”，还没有完成：

- ticket 自动清理 job
- callback 来源审计
- 更强的 callback 鉴权
- callback bus / scheduler 的完整异步治理

## 下一步

1. 继续收口 callback ticket 的剩余治理：自动清理、来源审计、更强鉴权
2. 把发布层继续建在 publish binding 上，推进 OpenAI / Anthropic 映射，而不是另起一条执行链
3. 继续盯住 `runtime.py`、`runs.py` 和 `workspace-starter-library.tsx` 的体量，避免在下一轮再次回涨
