# 2026-03-12 Published Endpoint Audit Time Window

## 背景

上一轮提交 `feat: add published endpoint audit filters` 已经把 publish activity 推进到：

- `status / request_source / api_key_id` 筛选
- API key 维度使用可见性
- 最近失败原因聚合

但 `docs/dev/runtime-foundation.md` 里仍明确存在一个后续缺口：

- publish activity 还缺时间范围筛选
- 失败趋势还没有结构化返回给治理视图

这意味着发布治理虽然已经有“按维度筛选”，但还不足以回答“某一段时间内发生了什么”“失败是在什么时候堆起来的”。

## 目标

在不新增表、不改 runtime 主循环的前提下，继续沿 publish activity 主线补两件事：

1. 为 binding 级 invocation 查询补 `created_from / created_to`
2. 返回可直接给治理页和诊断页复用的 timeline buckets

## 实现方式

### 1. 扩展 invocation 查询过滤条件

`GET /api/workflows/{workflow_id}/published-endpoints/{binding_id}/invocations` 现在额外支持：

- `created_from`
- `created_to`

并在返回体 `filters` 中原样回显，便于前端或后续自动化链路确认当前查询窗口。

### 2. 在 publish activity service 内聚合时间趋势

`PublishedInvocationService` 继续承接 binding 级 audit 聚合，新增：

- 时间窗口条件下的 invocation 查询
- `hour / day` 两档 timeline granularity 自动选择
- 每个时间桶内的 `total / succeeded / failed / rejected` 统计

聚合仍留在 `published_invocations.py`，没有把时间趋势逻辑塞回 route 或 gateway。

### 3. 在路由层补最小输入校验

当 `created_from > created_to` 时，activity route 会直接返回 `422`，避免把明显无效的时间窗口继续透传到 service 和前端。

## 影响范围

- 路由：
  - `api/app/api/routes/published_endpoint_activity.py`
- Schema：
  - `api/app/schemas/workflow_publish.py`
- 服务：
  - `api/app/services/published_invocations.py`
- 测试：
  - `api/tests/test_workflow_publish_routes.py`

## 验证

在 `api/` 目录使用本地 `.venv` 执行：

```powershell
.\.venv\Scripts\python.exe -m ruff format app/api/routes/published_endpoint_activity.py app/schemas/workflow_publish.py app/services/published_invocations.py tests/test_workflow_publish_routes.py
.\.venv\Scripts\python.exe -m ruff check app/api/routes/published_endpoint_activity.py app/schemas/workflow_publish.py app/services/published_invocations.py tests/test_workflow_publish_routes.py
.\.venv\Scripts\python.exe -m pytest tests/test_workflow_publish_routes.py -q
```

结果：

- `ruff format`: passed
- `ruff check`: passed
- `pytest tests/test_workflow_publish_routes.py -q`: `11 passed`

## 当前结论

发布治理主线现在已经从：

- `binding + lifecycle + alias/path + native invoke`
- `activity + audit filters + api key visibility + failure reason summary`

继续推进到：

- `time window filtering + timeline buckets`

这说明 publish activity 已经开始具备“按时间段回看”和“观察失败堆积区间”的最小治理能力，可以继续为后续限流、cache 和开放协议映射提供事实基础。

## 下一步

按优先级建议继续推进：

1. 为 published endpoint 补限流与 cache contract
2. 把 publish activity 的趋势消费接到前端治理或诊断视图
3. 把 OpenAI / Anthropic 协议映射挂到同一条 publish binding + activity 链上
