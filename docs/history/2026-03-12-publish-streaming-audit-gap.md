# 2026-03-12 Publish Streaming Audit Gap

## 背景

上一条正式提交已经把 publish invocation governance 推进到 timeline breakdown，但发布协议入口仍有一个明显事实缺口：

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/messages`

当请求携带 `stream=true` 时，路由会直接返回 `422`，导致这类“外部已经在尝试流式接入”的信号没有进入 `workflow_published_invocations`。

这会带来两个问题：

- workflow 页的 publish governance 会误以为没有这类请求压力
- 在真正开始补 SSE / streaming 之前，无法先判断哪些协议面、哪些 key、哪些 binding 已经在触发流式诉求

## 目标

- 保持当前 MVP 诚实边界，继续拒绝未实现的流式调用
- 不引入第二套审计或路由层私有日志
- 让协议层 `stream=true` 的拒绝也进入既有 publish invocation audit

## 实现

### 1. 发布网关增加协议级 rejection 记录入口

在 `api/app/services/published_gateway.py` 新增 `record_protocol_rejection_by_alias()`：

- 仍然通过 active publish binding alias 定位 binding
- 只在 binding 存在且协议匹配时记录 rejection
- 若 binding 使用 `api_key`，会在不改变返回错误优先级的前提下尝试解析有效 key，并把 `api_key_id` 归档到审计事实
- 统一复用 `PublishedInvocationService.record_invocation()`，不在路由层新造审计模型

### 2. 协议路由保留 422，但不再丢失治理事实

在 `api/app/api/routes/published_gateway.py`：

- `chat.completions`
- `responses`
- `messages`

三条协议路由在检测到 `stream=true` 时，先调用 `record_protocol_rejection_by_alias()`，再继续返回原有的 `422`。

这样可以保持现有外部行为稳定，同时把 rejection 写回：

- `request_surface`
- `reason_code`
- `api_key_id`（可解析时）

### 3. 原因码识别放宽到协议面文本

`api/app/services/published_invocations.py` 里的 `classify_invocation_reason()` 不再只匹配单一提示文案，而是按：

- 包含 `stream`
- 且包含 `not supported yet`

统一归类为 `streaming_unsupported`，避免协议面提示文案差异导致治理筛选失效。

## 影响范围

- 发布协议入口的 rejection 现在会更完整地进入 `workflow_published_invocations`
- workflow 页按 `request_surface / reason_code / api_key` 的治理视图可以提前看到 streaming 诉求
- 该改动没有把真正的 streaming/SSE 执行链假装成已完成，仍然保持当前 `422` 边界

## 验证

在 `api/` 下执行：

```powershell
.\.venv\Scripts\uv.exe run pytest tests/test_workflow_publish_routes.py -q
```

结果：

- `22 passed`

新增测试覆盖：

- `test_protocol_streaming_rejections_are_recorded_in_publish_audit`

验证点包括：

- OpenAI `chat.completions` 和 `responses` 的 `stream=true` 会进入 binding 级 invocation audit
- Anthropic `messages` 的 `stream=true` 会进入 binding 级 invocation audit
- `request_surface`、`reason_code=streaming_unsupported`、`api_key_usage` 都会正确聚合

## 未决问题 / 下一步

1. 这次只补了“流式请求被拒绝时的治理可见性”，还没有实现真正的 SSE / streaming 输出链路。
2. 若下一轮进入真正的 streaming 实现，应继续坚持：
   - 统一从 `run_events` 映射协议流
   - 不为 OpenAI / Anthropic 各自复制执行逻辑
3. publish governance 的下一步仍应优先补：
   - streaming 调用的活动趋势与长期审计消费
   - 更完整的协议字段映射
   - API key 趋势治理
