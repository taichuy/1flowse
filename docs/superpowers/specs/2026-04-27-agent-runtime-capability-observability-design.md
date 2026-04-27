# Agent Runtime、Capability Runtime 与可观测中转架构设计稿

日期：2026-04-27

状态：设计稿已落地，待评审后进入实现拆分

## 1. 目标

本设计把 1flowbase 的运行时方向从单一 `RuntimeEvent` 扩展为：

```text
Agent Runtime Event Bus
+ RuntimeSpan 调用树
+ CapabilityCatalog 能力目录
+ CapabilityRuntime 宿主执行层
+ Model Gateway / Relay
+ provider stdio v2 NDJSON streaming
```

目标不是只记录模型输出，而是让用户能看清一次 agent 运行中发生了什么：调用了哪个模型、使用了哪些 tool/MCP/skill/workflow/data source/approval、是否触发压缩、是否调用子 agent、用了多少 token、缓存命中多少、失败在哪里、哪些步骤由外部 agent 自己执行而宿主只能旁路审计。

## 2. 设计边界

### 2.1 必须纳入

- 模型供应商、普通工具、MCP 工具、skill、workflow-as-tool、数据检索、人工审批统一进入能力目录和能力调用运行时。
- Provider 插件只产出模型事件和能力调用意图，不直接执行工具、不直连 MCP、不加载 skill。
- SSE、blocking API、调试台、审计日志从同一条 runtime event stream 派生。
- 记录模型 token 使用、cache hit、reasoning token、费用归因、上游转发链路和失败原因。
- 记录同一会话内的上下文投影、自动压缩、压缩摘要、压缩前后 token 和压缩触发原因。
- 记录子 agent / 本地 agent / 系统内部 agent 的父子关系、能力授权、事件摘要和 usage 汇总。
- 支持 1flowbase 作为本地 agent 的 OpenAI-compatible 模型供应商入口，也支持 1flowbase 自己托管编排 agent。
- 支持中转站商业模式：上游官方 API、OpenAI-compatible 中转站、内部 agent、外部 agent 都能被纳入调用链和账单链。

### 2.2 暂不作为本阶段目标

- 不在本阶段要求直接切换到 gRPC 或 Unix socket。
- 不要求外部 CLI agent 必须立即改造客户端。基础模式先保证请求、响应、usage 和链路审计；完整 tool/skill/subagent 可观测能力通过可选 telemetry/callback 接入。
- 不把 provider 插件扩展成任意运行时宿主。provider 插件边界仍然只负责上游模型协议适配。
- 不让 runtime extension 或 capability plugin 自行注册 HTTP 路由。外部入口由宿主提供固定 API，插件只贡献能力和 schema。
- 不在事件表里持久化大段 skill 正文、完整文件内容或大 blob。大内容进入 artifact 存储，事件只保存引用和 hash。

## 3. 参考结论

### 3.1 当前 1flowbase

- `provider_contract.rs` 已有 `TextDelta`、`ToolCallDelta`、`McpCallDelta`、`ProviderUsage` 等雏形，但只是 provider stream 合同，还没有 host-owned capability loop。
- `plugin-runner` 仍在 `stdio_runtime.rs` 使用 `wait_with_output()` 等 provider 退出，不是真正逐行 streaming。
- `execution_engine.rs` 仍是一轮 provider 调用后集中处理结果，tool/MCP/skill 还没有统一进入调用树。
- `RunEventRecord` 还没有 span 关系，SSE 仍主要从持久化事件轮询。

### 3.2 Dify

Dify 的关键启发是：tool 不是单一函数。来源包括 built-in、plugin、workflow、API、app、dataset retrieval、MCP；返回也不是纯文本，而是 text/json/file/blob/link/variable/retriever resources 等多形态。agent loop 是 LLM -> tool -> message -> LLM 的多轮循环，并有 max iteration。

### 3.3 n8n

n8n 的关键启发是：LLM tool call 会变成 host engine request，而不是模型 provider 自己执行。MCP Client Tool 也被投影成 host-owned toolkit，并纳入 timeout、tool selection、取消和结果归一化。

### 3.4 AionUi / AionRS / Codex / OpenClaw

- skill 不是普通 tool，更接近可加载的能力包或指令包。必须记录 skill index、按需加载、版本、路径、hash 和 loaded snapshot。
- Codex 和 AionRS 都把自动压缩作为 session 内的重要事件处理：压缩后发给模型的是 projection，不应丢掉原始 transcript 和压缩审计。
- Codex、AionRS、OpenClaw 都存在子 agent / delegated agent / spawn agent 类能力。父子 agent 必须进入 span tree，并能汇总子运行的 token、工具和失败。
- OpenClaw 的 gateway 文档说明本地 agent 可以把服务端当作 OpenAI-compatible 模型入口；这种模式下外部 agent 可能自己调用本地工具，宿主只能在 gateway 层审计，除非外部 agent 主动上报 telemetry。

### 3.5 MCP 官方边界

MCP tools 是 server 暴露、client 发现并调用的 model-controlled functions；MCP prompts 是可复用模板资源，和 tool/skill 不是同一种对象。1flowbase 应作为 MCP client/host 发现和调用 MCP tool，不应让 provider 插件绕过宿主直连 MCP。

参考：

- [MCP Tools](https://modelcontextprotocol.io/docs/concepts/tools)
- [MCP Prompts specification](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)

## 4. 产品形态

### 4.1 1flowbase 托管编排 agent

用户在 1flowbase 内构建 agent flow。运行时按编排顺序执行，LLM 节点通过 provider stdio v2 访问模型，tool/MCP/skill/workflow/data source/approval 由 CapabilityRuntime 执行并记录。

### 4.2 1flowbase 作为本地 agent 的模型供应商

Codex、OpenClaw、AionRS、Hermes Agent 等本地 agent 可以把 1flowbase 当作 OpenAI-compatible 上游模型。1flowbase 可以：

- 直接转发到官方模型或中转站；
- 根据 `model` 或 route 选择一个 1flowbase agent/flow，让本地 agent 像调用模型一样调用编排 agent；
- 记录请求、响应、上游、usage、cache、费用和错误；
- 如果外部 agent 接入 telemetry/callback，再记录其内部 tool/MCP/skill/subagent 事件。

### 4.3 内部系统守护 agent / AI 员工

类似 NocoBase AI 员工的内部 agent 属于 `system_agent` 能力。它可以调用内部业务能力、workflow、审批和 skill，但必须通过 CapabilityRuntime 申请、授权、执行和记录，不能绕过运行时直接写业务状态。

### 4.4 中转站和模型路由

上游不仅是官方 API，也可以是 OpenAI-compatible relay，如 sub2api、new-api 一类中转站。1flowbase 需要把它们建模为 `gateway_provider` 或 `llm_provider` 的 route，而不是混在模型节点的临时 URL 里。

中转链路需要记录：

- 用户看到的模型 id；
- 实际 route；
- 上游 provider 或 relay id；
- 请求参数快照；
- retry/fallback/timeout；
- 上游 request id；
- 原始 usage 与归一化 usage；
- 价格版本和费用快照。

## 5. 分层架构

```text
API / Gateway Surface
  OpenAI-compatible API, Responses API, Agent Run API, Capability API, MCP endpoint, telemetry ingest

Application Control Plane
  workspace/app/session 权限, run lifecycle, policy, audit, durable write

Agent Session Runtime
  transcript, context projection, llm turn loop, compaction, max iteration, continuation metadata

Capability Runtime
  catalog resolve, authorization, invocation, timeout/cancel, result normalization, artifact write

Model Gateway / Provider Runtime
  provider stdio v2, upstream relay, streaming parser, usage normalization, gateway_forward spans

Runtime Event Bus + Span Tree
  live stream, durable batch writer, SSE/blocking fold, debug read model

Observability & Billing Ledger
  usage ledger, cost attribution, cache hit, failures, external opacity labels
```

职责分界：

- API 层只暴露固定入口和协议转换。
- control-plane 管 run 生命周期、权限、审计和持久化。
- orchestration-runtime 管编排、节点运行、llm turn 和 capability loop。
- plugin-framework 定义 provider/capability/skill/MCP 插件合同。
- plugin-runner 只作为隔离进程宿主和 streaming stdio adapter。
- provider 插件不得直接执行 host tool、MCP、skill 或 workflow。

## 6. 核心领域模型

### 6.1 RuntimeSpan

`RuntimeSpan` 表示一次可嵌套的运行片段，是调试树和账单归因的主干。

```text
RuntimeSpan
  id
  run_id
  node_run_id
  parent_span_id
  kind:
    flow | node | llm_turn | provider_request | gateway_forward
    tool_call | mcp_call | skill_load | skill_action | workflow_tool
    data_retrieval | approval | compaction | subagent | system_agent
  name
  status: running | succeeded | failed | cancelled | waiting
  capability_id
  started_at
  finished_at
  input_ref
  output_ref
  error
  metadata
```

### 6.2 RuntimeEvent

`RuntimeEvent` 是流式事实，不替代 span。

```text
RuntimeEvent
  id
  run_id
  node_run_id
  span_id
  parent_span_id
  sequence
  created_at
  event_type
  payload
  visibility: internal | workspace | user | public
  durability: ephemeral | durable | sampled
```

约束：

- 同一个 run 内 `sequence` 单调递增。
- token delta 不能逐字符落库，必须按 30-100ms 或 max bytes 合并。
- 事件 payload 保存可调试的结构化摘要，大对象保存 artifact 引用。

### 6.3 CapabilitySpec

能力目录的统一条目。

```text
CapabilitySpec
  id: kind:source:namespace:name@version
  kind:
    llm_provider | gateway_provider | host_tool | mcp_tool | skill
    skill_action | workflow_tool | data_source | approval
    system_agent | external_agent
  source
  namespace
  name
  version
  schema
  result_schema
  permissions
  workspace_scope
  app_scope
  timeout_policy
  cancellation_policy
  provider_metadata
  provenance
```

`id` 必须是 canonical capability id，禁止只用 display name 作为运行时引用，避免 MCP tool、内部 tool、workflow tool、skill action 同名冲突。

### 6.4 CapabilityInvocation

```text
CapabilityInvocation
  id
  run_id
  span_id
  capability_id
  requested_by_span_id
  requester_kind: model | workflow | user | system_agent | external_agent
  arguments_ref
  authorization_status
  authorization_reason
  result_ref
  normalized_result
  started_at
  finished_at
  error
```

### 6.5 UsageLedger

usage 不只挂在 provider result 上，还要成为独立账本。

```text
UsageLedger
  id
  run_id
  span_id
  node_run_id
  provider_instance_id
  gateway_route_id
  model_id
  upstream_model_id
  upstream_request_id
  input_tokens
  cached_input_tokens
  output_tokens
  reasoning_output_tokens
  total_tokens
  cache_read_tokens
  cache_write_tokens
  price_snapshot
  cost_snapshot
  raw_usage
  normalized_usage
```

这能回答“输入 token、缓存命中、生产 token 有没有”。provider stream 的 `usage_snapshot` 可以多次出现，最终以 `llm_turn_finished` 或 `provider_result` 的结算 usage 为准。

### 6.6 ContextProjection

同一会话不等于每次都把完整历史原样发给模型。需要把原始 transcript 和发给模型的 projection 分开记录。

```text
ContextProjection
  id
  session_id
  run_id
  llm_turn_span_id
  projection_kind: raw_gateway | managed_full | managed_compacted | resumed
  source_transcript_ref
  model_input_ref
  compacted_summary_ref
  previous_projection_id
  token_estimate
  provider_continuation_metadata
  created_at
```

`provider_continuation_metadata` 用来保存 Anthropic/Gemini 等 provider-specific thinking signatures、cache control、response id 等继续生成所需信息，不能只靠 messages 重建。

## 7. 事件分类

### 7.1 基础运行事件

- `run_started`
- `run_finished`
- `run_failed`
- `node_started`
- `node_finished`
- `node_failed`
- `span_started`
- `span_finished`
- `span_failed`
- `span_cancel_requested`
- `span_cancelled`
- `run_warning`

### 7.2 Provider stdio v2 事件

provider 只允许产出 provider event：

- `text_delta`
- `reasoning_delta`
- `tool_call_delta`
- `tool_call_commit`
- `usage_snapshot`
- `finish`
- `error`
- `result`

provider 不执行 tool，不直连 MCP，不加载 skill。`tool_call_commit` 只是“模型请求调用能力”的结构化意图。

### 7.3 LLM turn 事件

- `llm_turn_started`
- `llm_input_projected`
- `provider_request_started`
- `provider_stream_started`
- `provider_stream_finished`
- `llm_turn_finished`
- `llm_turn_failed`
- `usage_recorded`

### 7.4 能力目录和调用事件

- `capability_catalog_resolved`
- `capability_call_requested`
- `capability_call_authorized`
- `capability_call_rejected`
- `capability_call_started`
- `capability_call_finished`
- `capability_call_failed`
- `tool_call_requested`
- `tool_call_authorized`
- `tool_call_rejected`
- `tool_result_appended`

### 7.5 Skill 事件

- `skill_index_loaded`
- `skill_load_requested`
- `skill_loaded`
- `skill_load_failed`
- `loaded_skills_snapshot_created`
- `skill_action_requested`
- `skill_action_finished`
- `skill_action_failed`

### 7.6 MCP 事件

- `mcp_server_connected`
- `mcp_server_disconnected`
- `mcp_tool_catalog_resolved`
- `mcp_call_requested`
- `mcp_call_finished`
- `mcp_call_failed`
- `mcp_resource_read`
- `mcp_prompt_resolved`

MCP tools、resources、prompts 分开建模，不能都塞进 tool。

### 7.7 审批、数据、artifact、变量

- `approval_requested`
- `approval_resolved`
- `data_retrieval_requested`
- `data_retrieval_finished`
- `variable_updated`
- `artifact_created`
- `checkpoint_created`

### 7.8 压缩和子 agent

- `compaction_requested`
- `compaction_started`
- `compaction_finished`
- `compaction_failed`
- `context_projection_created`
- `subagent_requested`
- `subagent_started`
- `subagent_event_linked`
- `subagent_finished`
- `subagent_failed`
- `subagent_usage_recorded`

这些事件直接回答：本地 agent 上下文太长触发自动压缩是否有记录，是否调用了子 agent，子 agent 产生了多少 usage。

### 7.9 Gateway / relay 事件

- `gateway_request_received`
- `gateway_route_resolved`
- `gateway_forward_started`
- `gateway_forward_finished`
- `gateway_forward_failed`
- `gateway_usage_normalized`
- `external_agent_session_observed`
- `external_agent_telemetry_received`
- `external_agent_telemetry_rejected`

## 8. 托管 agent 运行流

```text
1. run_started
2. capability_catalog_resolved
3. node_started
4. llm_turn_started
5. llm_input_projected
6. provider_request_started
7. provider stdio v2 stream
8. tool_call_commit
9. CapabilityRuntime authorize
10. CapabilityRuntime execute
11. tool_result_appended
12. 下一轮 llm_turn_started
13. 达到 finish / max iteration / waiting approval / failed / cancelled
14. usage_recorded, run_finished
```

关键约束：

- LLM -> tool -> message -> LLM 是 Agent Session Runtime 的职责，不是 provider 的职责。
- max iteration、approval pending、cancellation 都由 host 控制。
- tool/MCP/skill/workflow/data retrieval 的返回必须归一化为多形态 `CapabilityResult`，再追加进下一轮模型输入。

## 9. Gateway / relay 运行流

### 9.1 Raw Model Gateway Mode

外部 agent 直接调用 `/v1/chat/completions` 或 `/v1/responses` 时，默认进入 raw gateway 模式。

```text
1. gateway_request_received
2. gateway_route_resolved
3. gateway_forward span started
4. 上游 provider/relay streaming
5. usage_snapshot / gateway_usage_normalized
6. gateway_forward_finished
```

规则：

- 默认不改写用户消息，不主动压缩上下文，不擅自插入 1flowbase skill。
- 原始 request/response 以可配置脱敏策略记录，便于审计和复盘。
- 如果请求中包含 tool definitions，可以记录“外部 agent 声明了哪些 tool”，但不能把后续本地 tool 执行当成宿主已观测事实。
- 如果外部 agent 自己调用 MCP 或本地工具，1flowbase 在没有 telemetry/callback 的情况下只能标记为 `external_opaque`。

### 9.2 1flowbase Agent-as-Model Mode

当 gateway route 指向一个 1flowbase agent/flow 时：

```text
外部 agent 请求模型
  -> 1flowbase 解析为 agent run
  -> Agent Session Runtime 执行固定编排
  -> 以 OpenAI-compatible stream 返回最终模型输出
```

这让本地 agent 能把 1flowbase 编排 agent 当作模型供应商接入，同时 1flowbase 保留完整内部 span、event、usage 和 capability 调用记录。

### 9.3 External Agent Telemetry Bridge

为了完整观察外部 agent 内部行为，提供可选 telemetry bridge：

- 外部 agent 上报 `session_id`、`parent_run_id`、`span_id`、`tool_call`、`mcp_call`、`skill_load`、`subagent`、`usage` 等事件。
- 1flowbase 校验签名、workspace、session 绑定和 schema。
- 接入后事件进入同一 runtime event bus，但标记 `source=external_agent` 和可信等级。
- 不接入时不阻塞中转能力，只在调试台明确显示“外部 agent 内部执行不可见”。

## 10. CapabilityRuntime 职责

CapabilityRuntime 是宿主执行层，负责：

- 从 `CapabilityCatalog` 解析可用能力。
- 根据 workspace、application、run、node、user、agent role 执行权限校验。
- 创建 `RuntimeSpan` 和 `CapabilityInvocation`。
- 注入 cancellation token tree 和 timeout。
- 调用 host tool、MCP client、skill loader、workflow tool、data source、approval handler、system agent。
- 归一化结果为 `CapabilityResult`。
- 写 artifact、usage、事件和错误。
- 将结果追加回 Agent Session Runtime 的下一轮 LLM input。

`CapabilityResult` 至少支持：

- `text`
- `json`
- `file`
- `blob`
- `link`
- `variable`
- `artifact_ref`
- `retriever_resources`
- `approval_state`
- `error`

## 11. Skill 模型

skill 不是普通 tool，先进入 skill index，再按需加载。

```text
SkillSpec
  id: skill:source:namespace:name@version
  source: builtin | bundled | user | extension
  name
  version
  path
  hash
  permissions
  workspace_scope
  app_scope
  load_policy: auto | visible | on_demand | disabled
  actions
```

处理规则：

- built-in auto skill 可以默认注入或默认可见。
- bundled/user/extension skill 进入 skill index，按 workspace/application 权限过滤。
- 模型请求 skill 时，宿主产生 `skill_load_requested`，加载成功后产生 `skill_loaded`。
- `loaded_skills_snapshot` 记录 name/version/path/hash/source，不把全文塞进持久事件。
- 如果 skill 有可执行 action，必须转换成 `skill_action` 或 `host_tool` span，由 CapabilityRuntime 执行。
- skill body 如需复盘，可按策略进入 artifact 存储并记录 hash，不进入高频事件 payload。

## 12. MCP 模型

MCP server 由宿主连接，MCP tools 被投影进 `CapabilityCatalog`。

```text
McpBindingSpec
  id
  server_name
  transport
  workspace_scope
  app_scope
  permissions
  tool_name_prefix
  timeout_policy
  catalog_snapshot_ref
```

规则：

- `mcp_server_connected` 后解析 tools/resources/prompts。
- MCP tool id 形如 `mcp_tool:mcp:<server>:<tool>@<schema_hash>`。
- MCP prompt 不是 skill，也不是 tool；需要进入 prompt/resource 类目录或作为 prompt template artifact 引用。
- provider 插件不能直连 MCP server；所有 MCP call 都由宿主 MCP client manager 发起。

## 13. 自动压缩与记忆窗口

同一个会话内发生自动压缩时，必须同时保留：

- 原始 transcript 引用；
- 压缩前 token；
- 压缩触发原因，如 context limit、manual、cost policy；
- 压缩模型和参数；
- summary artifact；
- 被 summary 替代的消息范围；
- 压缩后 projection；
- 压缩后估算 token；
- 是否失败以及 fallback 行为。

发送给模型的内容取决于模式：

- raw gateway 模式：默认用户发什么就转发什么，1flowbase 不主动压缩。
- managed agent 模式：1flowbase 可以根据 session policy 生成 `ContextProjection`，把压缩摘要和必要 recent messages 发给模型。
- agent-as-model 模式：外部看起来是一次模型调用，内部仍由 managed agent policy 决定 projection。

审计原则：

- transcript 是事实历史。
- projection 是“本轮实际发给模型的上下文”。
- compaction span 是“为何从事实历史变成该 projection”的解释。

## 14. 子 agent 模型

子 agent 是一类能力调用，不是普通函数。

```text
SubagentInvocation
  id
  parent_run_id
  parent_span_id
  child_run_id
  child_session_id
  agent_source: internal | external | cli | system
  agent_name
  depth
  allowed_capabilities
  status
  usage_summary
  result_ref
```

规则：

- 父 agent 产生 `subagent_requested` 和 `subagent_started`。
- 子 agent 有自己的 run/session/span tree。
- 父运行通过 `subagent_event_linked` 关联子运行摘要，不把所有子事件复制进父事件表。
- usage 在子 run 记录一份，再向父 span 汇总一份。
- 外部 CLI 子 agent 如果未接 telemetry，只能记录启动命令、输入摘要、退出状态、stdout/stderr/artifact 和 usage 可见部分。

## 15. 可观测与调试读模型

调试台至少需要从事件和 span fold 出以下视图：

- Span Tree：flow -> node -> llm_turn -> provider/tool/MCP/skill/approval/subagent。
- Timeline：按 sequence 展示流式文本、reasoning、工具请求、审批等待、错误和取消。
- Capability Calls：能力 id、来源、参数摘要、授权结果、耗时、返回类型、错误。
- Skills：skill index、loaded snapshot、按需加载原因、skill action。
- MCP：server 连接、catalog snapshot、tool call、resource/prompt 使用。
- Usage Ledger：输入 token、cached input、输出 token、reasoning token、cache read/write、费用。
- Context Projection：本轮实际发给模型的上下文、压缩摘要、压缩前后 token。
- Gateway Trace：外部请求、route、上游 relay、retry/fallback、normalized usage。
- External Opacity：哪些步骤属于外部 agent 自己执行、宿主没有完整观测。

调优诊断的第一步是“看清 AI 在做什么”。因此 UI 上不应只展示最终 answer，应优先能看到调用树、用量、失败和上下文投影。

## 16. 持久化和流

建议新增或扩展持久化对象：

```text
runtime_spans
runtime_events
runtime_usage_ledger
runtime_context_projections
runtime_artifacts
capability_catalog_snapshots
capability_invocations
external_agent_sessions
gateway_route_snapshots
```

写入策略：

- runtime bus 先发布内存/队列事件，再由 durable writer 批量写 PostgreSQL。
- 高频 delta 先合并，再写 durable。
- SSE、blocking response、debug read model 都订阅或 fold 同一条 stream。
- durable writer 失败时必须产生 `run_warning` 或 fail-fast，不能静默丢事件。
- artifact 与事件解耦，事件只保存 `artifact_ref`、hash、mime、size、redaction 状态。

## 17. 插件和开放边界

### 17.1 ModelProviderPlugin

面向模型供应商插件。

允许：

- 声明 provider/model catalog；
- 接收 provider request；
- 通过 stdio v2 NDJSON 输出 provider events；
- 输出 usage、finish、error、result。

禁止：

- 执行 host tool；
- 直连 MCP；
- 读取或加载 skill；
- 自行改写 run 状态；
- 注册 HTTP route。

### 17.2 GatewayProviderPlugin

面向官方 API 或中转站适配。

职责：

- OpenAI-compatible / Anthropic / Gemini / relay 协议转换；
- route metadata；
- usage 归一化；
- upstream request id；
- retry/fallback 错误分类。

### 17.3 CapabilityPlugin

面向内部普通工具、业务动作和数据检索能力。

职责：

- 贡献 `CapabilitySpec`；
- 实现调用；
- 返回 `CapabilityResult`；
- 声明权限和资源访问边界。

### 17.4 McpBindingPlugin

面向 MCP server 接入和管理。

职责：

- 管 server lifecycle；
- catalog snapshot；
- tools/resources/prompts 投影；
- MCP 调用、timeout、取消和错误归一化。

### 17.5 SkillPack

面向 skill 包。

职责：

- 贡献 skill index；
- 提供 skill body/hash/version；
- 声明可见性、作用域和 action。

### 17.6 SystemAgentPlugin

面向内部守护 agent / AI 员工。

职责：

- 声明 agent 能力、触发条件和可调用能力范围；
- 通过 CapabilityRuntime 执行内部技能和 workflow；
- 记录自己的 run/span/usage。

### 17.7 ExternalAgentBridge

面向 Codex、OpenClaw、AionRS、Hermes Agent 等外部 agent。

职责：

- OpenAI-compatible 模型入口；
- 可选 telemetry ingest；
- 可选 tool callback；
- session/run 绑定；
- 外部事件可信等级和脱敏策略。

## 18. 外部 API 形态

建议宿主固定提供：

- `/v1/chat/completions`
- `/v1/responses`
- `/api/agent-runs`
- `/api/agent-runs/{run_id}/events`
- `/api/agent-runs/{run_id}/spans`
- `/api/capabilities`
- `/api/capabilities/{id}/invoke`
- `/api/external-agent/telemetry`
- `/mcp`

插件贡献能力，不贡献路由。这样外部生态可以接入，但安全、审计、鉴权和版本兼容仍由宿主控制。

## 19. 实施顺序

1. 定义 `RuntimeEvent`、`RuntimeSpan`、`CapabilitySpec`、`CapabilityInvocation`、`SkillSpec`、`McpBindingSpec`、`UsageLedger`、`ContextProjection`。
2. 增加 runtime event bus 和批量 durable writer，SSE、blocking、debug read model 都从同一 stream fold。
3. 改 `plugin-runner` 为逐行 NDJSON streaming，处理协议版本、bad JSON、stderr 日志、timeout、kill 和 usage snapshot。
4. 增加 host-owned capability loop：`tool_call_commit -> authorize -> execute -> append result -> next llm_turn`。
5. 增加 skill index/load/snapshot，再增加 MCP client manager，把 MCP tools 投影进同一个 capability registry。
6. 增加 Model Gateway / Relay：OpenAI-compatible API、route、upstream relay、usage normalization、gateway trace。
7. 增加 external agent telemetry bridge、subagent link 和 debug UI read model。

## 20. 风险和约束

- token delta 不能逐字符持久化，否则事件表和 SSE 都会被打爆。
- capability id 必须 canonical，否则同名 tool/MCP/skill/workflow 会冲突。
- cancellation 必须是 run/span token tree，否则子 agent、MCP call、provider stream 无法可靠停止。
- raw gateway 模式不能宣称完整可观测。没有 telemetry/callback 时，只能记录 1flowbase 看到的请求、响应和上游 usage。
- 需要明确脱敏策略。prompt、tool args、artifact、stderr、external telemetry 都可能包含密钥或隐私数据。
- provider-specific continuation metadata 必须跟随 `llm_turn` 或 `ContextProjection` 保存。
- usage 要区分 raw usage 和 normalized usage，避免中转站、官方 API、内部 agent 口径混乱。
- pricing 需要记录 price snapshot，不能只依赖当前价格表回算历史成本。

## 21. 验收标准

完成后，一次 agent run 至少能回答：

- 这次 run 调用了哪个模型、哪个 provider、哪个 upstream relay？
- 每个 LLM turn 的输入 token、cached input、输出 token、reasoning token 是多少？
- 是否命中 prompt cache 或上游 cache？
- 模型请求了哪些 tool/MCP/skill/workflow/data source/approval？
- 哪些请求被授权、拒绝、失败、取消或等待审批？
- skill index 是什么，实际加载了哪些 skill，版本和 hash 是什么？
- MCP 连接了哪些 server，解析出哪些 tool，调用了哪些 tool？
- 是否触发自动压缩，压缩前后 token、summary、projection 是什么？
- 是否调用子 agent，子 agent 的 run、usage、失败和结果是什么？
- 哪些行为由外部 agent 自己执行，1flowbase 只能旁路审计？
- 最终 answer 是如何从 span tree 和 event stream fold 出来的？

## 22. 与既有设计的关系

- 保留既有 provider 插件化和 model provider instance 思路，但把 provider 插件边界收窄为模型协议适配。
- 保留 capability plugin / runtime extension 的方向，但把所有能力统一挂到 `CapabilityCatalog`。
- 保留 agent flow debug console 方向，但数据源从单一 persisted events 升级为 span tree + event stream + usage ledger + context projection。
- 后续实现时需要同步更新相关 API 文档、数据库迁移、provider contract 和调试台读模型。

## 23. 当前无阻塞决策

用户已明确：客户端怎么改不是当前重点，重点是先把记录和调试底座设计好。因此本设计不再等待外部 CLI agent 改造方案确认；外部 agent 完整可观测能力作为 optional telemetry/callback 能力进入架构。
