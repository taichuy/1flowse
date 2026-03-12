# 2026-03-12 Published OpenAI / Anthropic Gateway

## 背景

最近一次正式提交已经把 `publish binding + lifecycle + cache inventory + workflow 页面治理入口` 接回了主链路，但 `docs/dev/runtime-foundation.md` 里仍明确标注：

- `native` 发布调用之外，`openai / anthropic` 的正式协议映射与开放调用入口还没有落地
- 发布层距离“可被外部系统直接接入”仍差一层协议适配

同时，当前工作区里还有一组未提交的前端 publish panel 拆分改动，方向已经开始往 invocation / rate limit 治理可见性推进。本轮不继续在前端 publish WIP 上叠加逻辑，而优先把后端开放 API 的协议入口补齐。

## 目标

1. 在不破坏现有 `publish binding -> compiled blueprint -> runtime -> invocation/cache audit` 主链的前提下，补上最小 OpenAI / Anthropic 协议入口。
2. 保持架构分层，不把协议适配逻辑重新塞回 `runtime.py` 或 workflow CRUD。
3. 对当前 MVP 边界保持诚实：先支持非流式最小形态，不假装已经完整实现 SSE / streaming / 全量协议字段。

## 实现

### 1. 新增协议入口

本轮新增以下路由：

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/messages`

三者都继续复用 `PublishedEndpointGatewayService`，并沿用现有的：

- published binding 查找
- `api_key / internal` 鉴权
- rate limit
- publish cache
- invocation audit

### 2. 协议映射从运行时主循环旁路出去

新增 `api/app/services/published_protocol_mapper.py`，专门承接：

- workflow 输出到 OpenAI / Anthropic 返回体的格式转换
- 发布 cache 的 surface identity 构造

这样协议形态转换没有继续堆进 `RuntimeService`，也避免 `published_gateway.py` 再长成把所有响应细节都硬编码的第二个大文件。

### 3. model -> published binding 的收口方式

OpenAI / Anthropic 路由当前统一通过 `model` 命中已发布 binding 的 `endpoint_alias`：

- `protocol=openai` 的 binding 可被 `/v1/chat/completions` 和 `/v1/responses` 命中
- `protocol=anthropic` 的 binding 可被 `/v1/messages` 命中

这延续了产品文档里“外部协议通过发布层映射到 workflow-backed provider”的思路，而不是让外部协议直接理解内部 workflow DSL。

### 4. cache 与审计的承接方式

为了避免同一个 `openai` binding 在 `/v1/chat/completions` 与 `/v1/responses` 之间发生响应缓存串型，本轮把 publish cache identity 增补了 surface 维度：

- `openai.chat.completions`
- `openai.responses`
- `anthropic.messages`

这样同一个 binding 的不同协议面不会错误复用对方缓存。

同时，invocation audit 仍继续复用现有 published invocation 事实层，没有再另起表或旁路日志。

## 影响范围

- `api/app/api/routes/published_gateway.py`
- `api/app/schemas/workflow_publish.py`
- `api/app/services/published_gateway.py`
- `api/app/services/published_protocol_mapper.py`
- `api/tests/test_workflow_publish_routes.py`

## 验证

已在 `api/.venv` 中执行：

```powershell
cd api
.\.venv\Scripts\uv.exe run pytest tests\test_workflow_publish_routes.py -q
```

结果：

- `20 passed`

覆盖点包含：

- native publish 既有链路未回归
- OpenAI chat completion 可通过 `model -> endpoint_alias` 命中 published binding
- OpenAI responses 与 chat completions 在同一 binding 下具备独立 cache surface
- Anthropic messages 可通过 `model -> endpoint_alias` 命中 published binding
- 非流式 MVP 边界保持明确

## 当前结论

- 这轮补齐后，发布层已经不再只有 `native` 自有入口，开始具备对外协议适配能力。
- 当前实现仍是最小闭环，不等于完整兼容：
  - 还没有 streaming / SSE
  - 还没有更完整的 OpenAI / Anthropic 字段透传与 usage 映射
  - invocation audit 目前仍主要按 binding 和现有 source 维度聚合，协议面更细的治理视图可后续再补

## 下一步

1. 把 OpenAI / Anthropic 的 streaming / SSE 挂到统一事件流，而不是在发布层各自拼实现。
2. 补 publish activity 对协议面调用的更细治理可见性，避免前端面板只能看 native 风格入口。
3. 继续补 API key、rate limit、cache 在 workflow 页面和系统诊断中的联动消费。
