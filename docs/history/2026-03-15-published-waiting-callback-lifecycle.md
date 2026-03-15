# 2026-03-15 Published waiting surface 复用 callback lifecycle 摘要

## 背景

- `123b28e feat: add callback waiting lifecycle summaries` 已经把 `WAITING_CALLBACK` 的 repeated expiry backoff、late callback 事件与 execution view 摘要补齐。
- 但 published activity / invocation detail 仍只展示 callback ticket 数量和 scheduled resume，无法直接回答“这个 waiting run 已经等了几轮、有没有 late callback、最近一次 backoff 是多少”。
- 同时，`web/components/workflow-publish-invocation-detail-panel.tsx` 仍在假设一组仓库当前并不存在的 callback ticket 字段，导致 published detail 面板和后端真实契约存在偏差。

## 目标

- 把 runtime node checkpoint 里的 `callback_waiting_lifecycle` 摘要复用到 published activity / detail surface。
- 保持 `Run / NodeRun / RunCallbackTicket / checkpoint_payload` 仍是 published waiting surface 的事实来源，不在发布层另造第二套 waiting 状态模型。
- 让 publish 面板改成消费当前后端真实 callback ticket 契约，避免前后端继续在同一块排障数据上漂移。

## 实现

- `api/app/schemas/workflow_publish.py`
  - 为 `PublishedEndpointInvocationWaitingLifecycle` 增加 `callback_waiting_lifecycle` 字段，直接复用 `CallbackWaitingLifecycleSummary`。
- `api/app/api/routes/published_endpoint_invocation_support.py`
  - 在 `serialize_waiting_lifecycle()` 中读取 node checkpoint 的 `callback_waiting_lifecycle`，统一序列化进 published invocation list/detail。
  - 这样 native / OpenAI / Anthropic published waiting surface 都沿同一条 runtime 事实链拿摘要，而不是发布层再做一次衍生统计。
- `web/lib/get-workflow-publish.ts`
  - 同步 published waiting lifecycle 类型定义，补上 `callback_waiting_lifecycle`。
  - published invocation detail 的 callback ticket 类型改为复用 `RunCallbackTicketItem`，与后端响应保持一致。
- `web/components/workflow-publish-invocation-entry-card.tsx`
  - 在 waiting drilldown 文案里直接展示 wait cycle / late callback / backoff 摘要。
- `web/components/workflow-publish-invocation-detail-panel.tsx`
  - Run drilldown 区块新增 callback lifecycle / callback tickets / scheduled resume 摘要。
  - callback ticket 卡片改为展示当前真实存在的字段：`ticket / tool_id / tool_call_index / waiting_status / reason / created_at / expires_at / consumed_at / canceled_at / expired_at / callback_payload`。
- `web/lib/get-run-views.ts`
  - 补齐共享 `RunCallbackTicketItem` 类型里的 `expires_at / expired_at`，让 published detail 和 run execution view 共享同一契约。

## 影响范围

- published activity / detail 现在可以直接回答 waiting invocation 的 durable 状态，而不需要用户跳回 run execution view 才知道回调已经等了几轮。
- published detail 面板不再依赖不存在的 callback ticket 字段，前后端对 callback ticket 的契约重新对齐。
- 这次改动继续保持 `RuntimeService` 单一主控：发布层只做事实复用与展示，不接管 callback 调度语义。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_workflow_publish_routes.py tests/test_published_invocation_detail_access.py tests/test_published_native_async_routes.py tests/test_published_protocol_async_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `api/.venv/Scripts/uv.exe run ruff check app/api/routes/published_endpoint_invocation_support.py app/schemas/workflow_publish.py tests/test_workflow_publish_routes.py tests/test_published_invocation_detail_access.py tests/test_published_native_async_routes.py tests/test_published_protocol_async_routes.py`
- `web/pnpm lint`
- `web/pnpm exec tsc --noEmit`

## 下一步

- 优先继续补 `WAITING_CALLBACK` 的最大重试 / 终止策略，避免 callback 长时间缺席时只有 backoff 没有明确停机边界。
- 继续把 callback source 聚合、published callback drilldown 与后续 publish export 治理收成统一的排障入口。
