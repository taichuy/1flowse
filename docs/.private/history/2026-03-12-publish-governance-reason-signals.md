# Publish Governance Reason Signals

## 背景

- 上一轮刚补上同步 published endpoint 命中 `waiting` 时必须明确拒绝，避免把未完成 run 误包装成成功协议响应。
- 但 workflow 页的 publish 治理面板当时仍只能看到原始 `error_message`，很难快速分清是限流、鉴权、协议边界，还是运行时失败。
- 当前 P0 主线仍是 `API 调用开放`，因此发布治理不仅要记录调用事实，还要能解释拒绝原因和当前限流压力。

## 目标

- 给 published invocation audit 增加稳定的“原因码”层，而不是只暴露原始报错文本。
- 让 workflow 页能直接显示最近拒绝/失败的治理信号，帮助判断是否要看 API key、rate limit 或 sync/waiting 边界。
- 在不引入新持久化表和不破坏现有 audit 结构的前提下，继续沿当前 publish binding + activity 分层推进。

## 实现

- 在 `api/app/services/published_invocations.py` 新增 published invocation reason classifier：
  - 当前先对 `rate_limit_exceeded`
  - `api_key_invalid`
  - `api_key_required`
  - `sync_waiting_unsupported`
  - `streaming_unsupported`
  - `auth_mode_unsupported`
  - `protocol_mismatch`
  - `runtime_failed`
  - 以及若干缺失依赖场景做归类。
- `GET /api/workflows/{workflow_id}/published-endpoints/{binding_id}/invocations` 现在会额外返回：
  - `summary.last_reason_code`
  - `facets.reason_counts`
  - `items[].reason_code`
- `GET /api/workflows/{workflow_id}/published-endpoints` 返回的 `activity` 摘要也同步带上 `last_reason_code`，方便治理卡片直接消费。
- `web/components/workflow-publish-activity-panel.tsx` 现在新增：
  - issue signals 区块，用原因码聚合展示最近 `failed / rejected` 调用
  - rate limit pressure 展示，用当前窗口使用量解释“快撞限流没有”
  - recent items 上的原因标签，而不再只留 raw error message
- 新增 `web/lib/published-invocation-presenters.ts` 收口原因码标签与限流压力格式化，避免把展示规则继续堆回组件。

## 影响范围

- `api/app/services/published_invocations.py`
- `api/app/api/routes/published_endpoint_activity.py`
- `api/app/api/routes/workflow_publish.py`
- `api/app/schemas/workflow_publish.py`
- `api/tests/test_workflow_publish_routes.py`
- `web/lib/get-workflow-publish.ts`
- `web/lib/published-invocation-presenters.ts`
- `web/components/workflow-publish-activity-panel.tsx`

## 验证

- `api/.venv/Scripts/uv.exe run pytest tests/test_workflow_publish_routes.py`
- `cd web && pnpm lint`
- `cd web && pnpm build`

## 下一步

1. 继续把 publish activity 做成可筛选治理区块，显式支持按 reason code、status、API key 和时间窗钻取。
2. 继续把 streaming / SSE 挂到统一发布链与事件流，让 sync/waiting 的当前拒绝边界未来有正式承接路径。
3. 若 publish activity 继续长出更多筛选和趋势对比，优先把 `workflow-publish-activity-panel.tsx` 继续拆成 summary / reason / timeline / recent-items 子块。
