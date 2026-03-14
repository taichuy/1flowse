# 2026-03-12 Published Endpoint Audit

## 背景

上一轮提交 `feat: track published endpoint activity` 已经补上：

- `workflow_published_invocations` 活动事实表
- publish binding 列表上的 activity 摘要
- binding 级 invocation 查询入口

但当前发布治理仍有两个直接缺口：

- invocation 列表只能按最近时间查看，缺少最小筛选能力；
- 已有 API key 生命周期管理，但活动查询还看不到“哪个 key 在用”“失败主要因为什么”。

这意味着发布链路已经从“可调用”进入“可观测起步”，但还没有达到“可审计、可治理起步”。

## 目标

在不把逻辑塞回 `runtime.py` 的前提下，继续沿发布主线补一层最小治理能力：

- 为 published invocation 查询补上筛选条件；
- 让活动接口返回失败原因聚合；
- 让活动接口显式暴露 API key 维度使用情况；
- 保持 publish binding、published gateway、published activity 三层职责继续解耦。

## 实现方式

### 1. 扩展 published invocation 查询契约

`GET /api/workflows/{workflow_id}/published-endpoints/{binding_id}/invocations` 现在支持：

- `status`
- `request_source`
- `api_key_id`
- `limit`

返回体增加：

- `filters`
- `facets.status_counts`
- `facets.request_source_counts`
- `facets.api_key_usage`
- `facets.recent_failure_reasons`

这样发布治理页、诊断页和后续开放 API 管理可以直接复用同一条活动查询链路，而不用再自己拼聚合逻辑。

### 2. 在服务层补 audit 聚合

`PublishedInvocationService` 新增 binding 级 audit 聚合能力：

- 汇总筛选后的总调用数、成功/失败/拒绝数
- 聚合 request source 分布
- 聚合 API key 使用次数与最近状态
- 聚合最近失败原因

实现仍然落在 `published_invocations.py` 内部，不把 audit 逻辑揉进 gateway route 或 runtime 执行器。

### 3. 把 API key 元数据带回 invocation item

invocation item 现在除 `api_key_id` 外，还会返回：

- `api_key_name`
- `api_key_prefix`
- `api_key_status`

这让“发布活动 -> API key 治理”之间形成可导航的事实链路，而不是只有一个裸 ID。

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
.\.venv\Scripts\python.exe -m ruff check app/api/routes/published_endpoint_activity.py app/schemas/workflow_publish.py app/services/published_invocations.py tests/test_workflow_publish_routes.py
.\.venv\Scripts\python.exe -m pytest tests/test_workflow_publish_routes.py tests/test_published_endpoint_api_keys.py -q
```

结果：

- `ruff check`: passed
- `14 passed`

本轮重点验证了：

- invocation 查询支持 `status / request_source / api_key_id` 筛选
- 活动接口会返回 API key 维度使用统计
- 活动接口会聚合最近失败原因
- invocation item 会带回 API key 基本元数据
- 现有 publish invoke 与 API key 管理链路未回归

## 当前结论

当前发布主线已经从：

- `binding + lifecycle + alias/path + native invoke`

继续推进到：

- `activity + audit filters + api key visibility + failure reason summary`

这说明开放 API 主线可以继续沿 publish binding 演进，而不需要回头改 runtime 主循环或再造第二套审计模型。

## 下一步

按优先级建议继续推进：

1. 补 publish endpoint 的限流与 cache contract
2. 为 publish activity 增加时间范围和更细的审计筛选
3. 把 OpenAI / Anthropic 协议映射挂到同一条 publish binding + activity 链上
