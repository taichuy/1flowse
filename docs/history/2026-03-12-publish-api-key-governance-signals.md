# 2026-03-12 Publish API Key Governance Signals

## 背景

上一条正式 Git 提交 `feat: audit streaming publish rejections` 已经把 `stream=true` 的 OpenAI / Anthropic 拒绝请求接回 `workflow_published_invocations`，解决了“协议层拒绝静默丢失治理事实”的问题。

但 publish governance 仍有一个明显缺口：

- API key 只有总量 usage，没有 status mix
- timeline 只有 `request_surface` 和 `reason`，看不到“哪把 key 在哪个时间桶开始放量/出问题”
- `api/tests/test_workflow_publish_routes.py` 持续增长，发布治理验证边界开始混在一起

这会让 workflow 页很难回答“限流/失败/放量到底和哪把 key 有关”，也让后续继续补 publish audit 时更容易把测试文件堆成大包。

## 目标

1. 继续承接 publish governance 主线，把 API key 从静态 usage 推进到更可治理的状态信号。
2. 保持当前 `PublishedInvocationService -> published_endpoint_activity route -> workflow publish panel` 的解耦链路，不把治理逻辑塞回 gateway route。
3. 顺手把 publish activity 相关测试从 `test_workflow_publish_routes.py` 中拆出来，控制文件体量。

## 实现

### 1. published invocation audit 补充 API key status mix

后端在 `PublishedInvocationService` 的 `facets.api_key_usage` 中新增：

- `succeeded_count`
- `failed_count`
- `rejected_count`

这样 workflow 页不只知道某把 key 一共被用了多少次，还能看出最近主要是成功流量、失败流量还是治理拒绝。

### 2. timeline buckets 补充 API key 维度

后端在 timeline bucket 中新增 `api_key_counts`，按时间桶聚合 top API key：

- `api_key_id`
- `name`
- `key_prefix`
- `count`

前端 timeline 直接消费该字段，在每个 bucket 中展示 top API key，补上“哪把 key 在某段时间抬头”的最小趋势能力。

### 3. workflow publish panel 补充治理展示

前端更新：

- API key usage 卡片显示 `ok / failed / rejected` status mix
- timeline bucket 显示 top API key 标签

这样 workflow 页面已经能在同一块 publish governance panel 内同时观察：

- 入口/协议面
- 失败原因
- 限流窗口
- API key usage
- API key 时间桶趋势

### 4. publish activity 测试拆分

新增：

- `api/tests/test_workflow_publish_activity.py`
- `api/tests/workflow_publish_helpers.py`

调整：

- 把 publish activity / audit / timeline 相关测试从 `api/tests/test_workflow_publish_routes.py` 拆出
- `test_workflow_publish_routes.py` 继续保留路由与 publish invoke 主链验证

本轮拆分后：

- `api/tests/test_workflow_publish_routes.py` 从 1700+ 行降到约 1169 行
- `api/tests/test_workflow_publish_activity.py` 约 499 行，职责更单一

## 影响范围

- 后端发布治理聚合：`api/app/services/published_invocations.py`
- 发布活动 API 契约：`api/app/schemas/workflow_publish.py`
- 发布活动路由序列化：`api/app/api/routes/published_endpoint_activity.py`
- 前端治理类型与展示：`web/lib/get-workflow-publish.ts`、`web/components/workflow-publish-activity-panel.tsx`、`web/components/workflow-publish-traffic-timeline.tsx`
- 发布活动测试与测试辅助：`api/tests/test_workflow_publish_activity.py`、`api/tests/workflow_publish_helpers.py`

## 验证

计划执行：

```powershell
cd api
.\.venv\Scripts\uv.exe run pytest tests/test_workflow_publish_routes.py tests/test_workflow_publish_activity.py
```

本轮重点关注：

- publish activity 返回的 `api_key_usage` 是否带上 status mix
- timeline bucket 是否带上 `api_key_counts`
- 拆分后的 publish route / activity 测试是否都能通过

## 当前结论

这轮不是去补 streaming 本体，而是继续把 `API 调用开放` 的治理闭环做厚一层，属于对上一条 streaming rejection 审计提交的直接承接。

现在 publish governance 已经能回答：

- 哪种协议面在出问题
- 哪个失败原因在抬头
- 哪把 API key 最近在放量
- 某把 API key 最近主要是成功、失败还是被拒绝

但它仍然没有完成：

- 真正的 streaming / SSE
- 长周期趋势面板
- 更细的 API key / reason / surface 联动钻取

## 下一步

1. 继续补 streaming / SSE，并坚持复用同一条 publish binding + invocation audit + run event chain。
2. 把长期趋势治理做成更稳定的 drilldown，而不是只看单次 workflow 页加载时的 bucket 摘要。
3. 如果 `PublishedInvocationService` 继续增长，优先拆 query / aggregation / timeline builder，而不是继续在单文件里堆逻辑。
