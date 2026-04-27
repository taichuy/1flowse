# Agent Runtime 可观测中转架构评估整理附录

日期：2026-04-27

状态：讨论整理，作为后续落地 plan 的输入；本文不拆实现任务

关联设计稿：

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md`

## 1. 整理目的

本文整理对 `Agent Runtime、Capability Runtime 与可观测中转架构设计稿` 的评估讨论，重点回答：

- 当前设计是否方向正确；
- 专家回传的 P0 / P1 问题是否成立；
- 现有源码能支撑到什么程度；
- 后续进入 plan 阶段前，必须先补齐哪些工程约束；
- 这些补强的收益、风险和边界是什么。

本文不是实施计划，不决定数据库迁移、接口拆分、任务排期和代码改动顺序。实现拆分应在本评估整理被吸收到主设计稿或 plan 草案后再进行。

## 2. 总体判断

专家合并意见成立，P0 / P1 排序基本准确。

当前设计稿的方向是对的：它已经把 agent runtime 从单纯 provider 输出记录，扩展到 `RuntimeSpan`、`RuntimeEvent`、`CapabilityRuntime`、`ContextProjection`、`Usage / Cost / Credit Ledger`、gateway relay、external agent telemetry 等关键概念。

但当前设计还不能直接进入实现拆分。主要原因不是概念缺失，而是几个关键机制还没有被压实成可验证、可对账、可隔离的工程约束：

- `ContextProjection` 需要可证明模型真实输入；
- gateway 计费需要幂等 session 和结算边界；
- 外部 agent 观测需要区分事实日志和自述日志；
- capability / provider / system agent / bridge 需要 runtime 级隔离，而不只是策略声明；
- audit ledger 需要可重放、可对账、防篡改的事实层。

OpenAI Agents JS 的新增参考进一步确认：1flowbase 不应只补日志字段，而应把事件流、运行项、上下文投影、审批恢复和前端调试分片设计成同一条事实主干。

因此，当前文档适合作为架构调整基础，但进入 plan 前应先补一个“工程约束增补版”。

## 3. 评估边界

### 3.1 本轮只整理架构讨论

本轮不做：

- 不改 API、数据库、provider contract 或前端调试台；
- 不拆 milestone；
- 不写迁移 SQL；
- 不决定插件运行时的具体 sandbox 技术；
- 不要求外部 CLI agent 立即接入 telemetry bridge。

### 3.2 本轮关注的判断标准

优先级按以下顺序：

1. 安全性和正确性；
2. 可证明、可对账、可回放；
3. 权限隔离和可信等级；
4. 最小必要架构变动；
5. 后续实现可拆分。

## 4. 当前源码状态

### 4.1 已有基础

当前 provider contract 已经有比较完整的 provider 事件雏形：

- `ProviderUsage` 已覆盖 input、output、reasoning、cache read、cache write、total tokens；
- `ProviderStreamEvent` 已覆盖 text delta、reasoning delta、tool call delta / commit、MCP call delta / commit、usage delta / snapshot、finish、error。

关键证据：

- `api/crates/plugin-framework/src/provider_contract.rs:153`
- `api/crates/plugin-framework/src/provider_contract.rs:377`

这说明后续设计不需要从零开始定义 provider event，而是要把 provider event 纳入 host-owned runtime event bus 和 span tree。

### 4.2 仍缺 runtime 主干

当前 `plugin-runner` 仍是启动 provider executable、写 stdin、等待进程完整输出：

- `api/apps/plugin-runner/src/stdio_runtime.rs:39`

这不是逐行 NDJSON streaming，也不能支撑真正实时的 provider event bus。

当前 `execution_engine` 的 LLM 节点仍是一轮 provider 调用后集中处理结果：

- `api/crates/orchestration-runtime/src/execution_engine.rs:307`

这说明当前还没有 host-owned `LLM -> capability -> LLM` agent loop，tool / MCP / skill / workflow 尚未统一进入调用树。

### 4.3 事件持久化仍偏后置记录

当前 `append_provider_stream_events` 是把 provider stream events 映射为 run events 后落库：

- `api/crates/control-plane/src/orchestration_runtime/persistence.rs:314`

SSE 侧每 100ms 查询 run detail 并按 sequence 推送：

- `api/apps/api-server/src/routes/applications/application_runtime.rs:523`

当前 `RunEventRecord` 只包含 `flow_run_id`、`node_run_id`、`sequence`、`event_type`、`payload`、`created_at`：

- `api/crates/domain/src/orchestration.rs:177`

它还没有 `span_id`、`source`、`trust_level`、`projection_id`、`ledger_ref`、`artifact_ref`、`hash` 等可审计运行时字段。

## 5. P0 讨论整理

### 5.1 ContextProjection 生成策略缺失

专家意见成立。

设计稿已经提出 `ContextProjection`，并明确 transcript 和 projection 要分开记录：

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md:278`

设计稿也已经要求自动压缩保留原始 transcript、压缩前 token、summary artifact、被替代消息范围、压缩后 projection 和 fallback 行为：

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md:663`

不足在于：这些字段还没有形成生成策略和状态机。

需要补齐：

- 触发条件：context limit、manual、cost policy、provider continuation 要求；
- 输入边界：source transcript、recent messages、pinned memory、system prompt、tool result、provider-specific metadata；
- 生成过程：summary 生成、替换范围、token 估算、失败回退；
- 输出证明：`projection_id`、`summary_version`、`model_input_ref`、`model_input_hash`、`compaction_event_id`；
- 关联关系：本轮 `llm_turn_span_id`、压缩事件、summary artifact、实际发给模型的 input artifact 必须能互相追溯。

目标不是记录“发生过压缩”，而是调试时能证明模型本轮到底看到了什么。

### 5.2 中转计费缺少幂等模型

专家意见成立。

设计稿已经有 `UsageLedger`、`CostLedger`、`CreditLedger`，并在 `CreditLedger` 中放了 `idempotency_key`：

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md:300`
- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md:324`

但中转站商业模式不能只靠 ledger 字段兜住，需要一等公民的 `BillingSession`。

`new-api` 的 billing session 思路值得参考：

- `../new-api/service/billing_session.go:23`：单次请求的预扣费、结算、退款生命周期；
- `../new-api/service/billing_session.go:41`：`Settle` 幂等；
- `../new-api/service/billing_session.go:81`：`Refund` 幂等。

`sub2api` 的 idempotency 也值得参考：

- `../sub2api/backend/internal/service/idempotency.go:19`：`processing / succeeded / failed_retryable`；
- `../sub2api/backend/internal/service/idempotency.go:331`：成功请求可 replay，处理中请求冲突，失败可按 backoff reclaim。

需要补齐：

- `billing_session_id`；
- `idempotency_key`；
- `client_request_id`；
- `upstream_request_id`；
- `retry_attempt_id`；
- `route_id` / `provider_account_id`；
- 预扣、补扣、退款、反冲、结算完成的状态机；
- SSE 重连、任务重试、durable writer 重放、fallback provider 之间的归因边界。

目标是避免重复扣费，并能解释一次请求为什么扣了这笔钱。

### 5.3 外部 agent 可观测性不能等同于可控性

专家意见成立。

设计稿已经明确 raw gateway 模式下不主动改写用户消息、不主动压缩、不擅自插入 1flowbase skill，并指出外部 agent 自己调用本地工具时只能标记为 `external_opaque`：

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md:557`

设计稿也提出 optional telemetry bridge：

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md:576`

不足在于：可信等级还没有成为协议级字段。

需要区分：

- `host_observed`：1flowbase 自己发起、执行、记录的事实；
- `gateway_observed`：1flowbase 在中转层看到的 request / response / usage；
- `bridge_signed`：外部 agent 通过签名 bridge 上报，且 schema、workspace、session 校验通过；
- `agent_reported`：外部 agent 自述，未被宿主验证；
- `inferred`：宿主根据上下文推断；
- `opaque`：明确不可见。

调试台、审计日志和账单不能把这些等级混在一起展示为同一种事实。

### 5.4 插件运行时隔离不足

专家意见成立。

设计稿已经定义了不同插件边界：

- `ModelProviderPlugin`
- `GatewayProviderPlugin`
- `CapabilityPlugin`
- `McpBindingPlugin`
- `SkillPack`
- `SystemAgentPlugin`
- `ExternalAgentBridge`

并明确 provider 插件禁止执行 host tool、直连 MCP、读取或加载 skill、自行改写 run 状态、注册 HTTP route：

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md:764`

不足在于：这些仍偏策略声明，还没有变成 runtime / sandbox / permission 边界。

需要补一个隔离矩阵：

| 对象 | 进程模型 | secret 可见性 | 网络权限 | 文件权限 | DB 写权限 | host callback | route 注册 | 审批 | rate limit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ModelProviderPlugin | process-per-call / worker | provider scoped | provider endpoint | 无或临时目录 | 无 | 仅 provider event | 禁止 | 按 provider policy | 必须 |
| GatewayProviderPlugin | 宿主受控 adapter | route scoped | upstream relay | 无 | 无直接写 | gateway event | 禁止 | 按 route policy | 必须 |
| CapabilityPlugin | capability runtime | capability scoped | 按能力声明 | 按能力声明 | 通过宿主 API | capability result | 禁止 | 可选或强制 | 必须 |
| McpBindingPlugin | MCP manager | server scoped | MCP server | 无或配置目录 | 无直接写 | MCP result | 禁止 | 按 server/tool | 必须 |
| SkillPack | declarative package | 默认不可见 | 默认无 | skill 目录只读 | 无 | load snapshot | 禁止 | 不适用 | 加载限额 |
| SystemAgentPlugin | system agent runtime | system scoped | 按系统能力 | 按系统能力 | 通过 CapabilityRuntime | run/span/event | 禁止 | 高风险动作强制 | 必须 |
| ExternalAgentBridge | ingress only | bridge token | 仅 ingest | 无 | 无直接写 | telemetry ingest | 禁止 | 不适用 | 必须 |

目标是让权限边界靠运行时保证，而不是靠插件自觉。

## 6. P1 讨论整理

### 6.1 workflow-as-tool 生命周期

需要补齐开始、暂停、恢复、失败、补偿、人工审批。

Dify 的 workflow-as-tool 明确不支持 HumanInput：调用时 `pause_state_config=None`，并且会拒绝 human input node。

- `../dify/api/core/tools/workflow_as_tool/tool.py:105`
- `../dify/api/core/tools/utils/workflow_configuration_sync.py:49`

1flowbase 需要明确选择：

- 如果不支持 workflow-as-tool 内部暂停，应在 catalog 阶段拒绝这类 workflow；
- 如果支持，则必须设计 parent run / child run、approval span、resume token、补偿动作和超时策略。

不能默认把普通 workflow runtime 的暂停语义直接套进 tool 调用。

### 6.2 system_agent 触发条件不清

设计稿已经把内部守护 agent / AI 员工纳入 `system_agent` 能力。

还需要补：

- 触发来源：cron、事件、人工、workflow、模型请求、系统告警；
- 执行身份：system actor、workspace actor、delegated user；
- 可调用能力范围；
- 高风险动作审批；
- 对业务状态写入的边界；
- 审计事件和责任归属。

system_agent 不能和外部 agent bridge、provider plugin 混在同一权限层。

### 6.3 gateway relay 降级策略

设计稿已提到 retry、fallback、timeout、上游账号池选择和费用归因。

但需要状态机化：

- route resolved；
- provider account selected；
- upstream request started；
- upstream limited / failed / timed out；
- same-account retry；
- account switch；
- fallback provider；
- cache billed；
- final settle / refund。

`sub2api` 的 failover state 可作为参考，它记录 switch count、failed account、same-account retry、force cache billing 等状态：

- `../sub2api/backend/internal/handler/failover_loop.go:42`

### 6.4 日志防篡改不足

当前设计稿有 ledger 方向，但还没有明确防篡改模型。

中转站模式下，用户必须能信任：

- token usage；
- cache 命中；
- provider route；
- upstream request；
- cost snapshot；
- credit transaction；
- tool / MCP / skill 调用记录。

建议增加 append-only audit ledger：

- `prev_hash` / `row_hash`；
- redaction 状态；
- artifact hash；
- price snapshot hash；
- usage / cost / credit 三账引用；
- replay / reconcile job；
- 管理员修正只能追加 adjustment，不能改写历史。

这不是要做复杂链上系统，而是让商业对账和事故复盘有事实层。

### 6.5 rate limit、fail-safe、审批暂停

需要明确分层限流：

- workspace；
- user；
- app；
- agent；
- provider account；
- gateway route；
- capability；
- external telemetry bridge。

需要明确 fail-safe 策略：

- billing 不确定时应 fail closed；
- telemetry bridge 不可用时 raw gateway 不应失败，但应标记不可见；
- durable writer 失败时不能静默丢事件；
- capability 高风险动作缺审批时应暂停，而不是继续执行；
- provider usage 缺失时可以估算，但必须标记 `estimated`。

## 7. 方向建议

### 7.1 先补事实主干，再补体验层

优先补：

- `RuntimeSpan`；
- `RuntimeEvent`；
- `ContextProjection`；
- `UsageLedger`；
- `CostLedger`；
- `CreditLedger`；
- `BillingSession`；
- `CapabilityInvocation`；
- `ExternalTelemetryEvent`。

调试台、图形化 span tree、费用视图可以从这些事实层派生。

### 7.2 provider 插件继续收窄

provider 插件只做模型协议适配：

- 发请求；
- 解析上游流；
- 归一化 provider event；
- 输出 usage、finish、error、metadata。

host tool、MCP、skill、workflow、system action 必须由 CapabilityRuntime 执行。

### 7.3 gateway relay 提升为核心架构层

中转站不是 provider URL 配置问题，而是商业闭环问题。

gateway relay 应覆盖：

- route；
- provider account pool；
- upstream request；
- retry / fallback；
- cache；
- usage normalization；
- billing session；
- idempotency；
- cost / credit ledger；
- audit reconcile。

### 7.4 外部 agent 默认旁路审计，完整观测靠 bridge

Codex、OpenClaw、AionRS、Hermes Agent 等本地 agent 在 raw gateway 模式下，平台只能记录它们经过 gateway 的事实。

只有接入 telemetry bridge 后，平台才能记录其内部 tool、MCP、skill、subagent 事件，并且仍需要标记可信等级。

### 7.5 system_agent 独立建模

内部守护 agent 不是外部 agent，也不是 provider plugin。

它应有独立运行时身份、触发器、权限、审批和审计模型，并通过 CapabilityRuntime 调用系统内部能力。

## 8. 收益

补齐以上约束后，可以获得：

- 调试可证明：能回答每一轮模型到底看到了什么；
- 账单可对账：usage、cost、credit、upstream request 能互相追溯；
- 重试不重复扣费：SSE 重连、任务重试、provider fallback 不会重复结算；
- 外部 agent 诚实可见：不会把不可观测行为包装成完整审计；
- 插件边界清晰：provider、capability、MCP、skill、system agent、bridge 不会混权；
- 商业中转可运营：上游账号池、成本、缓存、失败、退款都有状态记录；
- 后续调试台可扩展：UI 可以从统一事实流派生，而不是拼多个临时来源。

## 9. 风险

主要风险包括：

- 范围膨胀：agent runtime、gateway、billing、capability runtime 同时做会过大；
- 事件量膨胀：token delta、tool delta、telemetry 高频写入会压垮事件表；
- 账本一致性复杂：usage、cost、credit、refund、fallback 需要强约束；
- 隐私与脱敏复杂：prompt、tool args、stderr、artifact、external telemetry 都可能含敏感信息；
- sandbox 落地成本高：权限隔离如果设计过重，会拖慢插件生态；
- 兼容性风险：provider stdio v2、event schema、debug read model 都可能影响既有调试链路。

控制方式：

- P0 只做能证明、能对账、能隔离的最小闭环；
- 高频 delta 合并后持久化；
- 大内容进 artifact，事件只存引用和 hash；
- 先支持 raw gateway 旁路审计，再逐步引入 telemetry bridge；
- 插件隔离先从权限矩阵和运行时通道开始，不一次性追求完整 sandbox。

## 10. OpenAI Agents JS 参考吸收

OpenAI Agents JS 适合被当作运行时状态机和前端流式消息适配参考，不适合作为 1flowbase 核心 runtime 依赖。原因是 1flowbase 后端主干是 Rust、账本和权限隔离需要平台级事实层，不能把 SDK 内部 tracing 或 RunState 序列化直接当成审计和计费依据。

应吸收的部分：

- RunItem 形态：message、reasoning、tool call、tool output、handoff、approval 应折叠成稳定 `RuntimeItem`，让 event、span、debug UI 和 ledger 有共同锚点。
- ContextProjection 两阶段：先做 session merge，再做 final projection。最终模型输入必须有 `projection_id`、`summary_version`、`model_input_ref`、`model_input_hash` 和 source item 关联。
- Human-in-the-loop：审批中断、部分审批、恢复执行和 nested agent-as-tool 审批需要进入 run state，而不是只作为 UI 状态。
- compaction：自动压缩应有独立事件、span、usage 和摘要版本；压缩文本不能只混入下一轮请求正文。
- agent-as-tool / handoff：前者是子 agent 工具调用，结果回到父 agent；后者是控制权转移，两者都要和外部 CLI 自建子 agent 区分。
- 前端 stream part：可以借鉴 text、reasoning、tool input、tool output、approval、data part 的消息分片，但 1flowbase 主调试台仍应消费自有 `DebugStreamPart`。

不应吸收的部分：

- 不把 `@openai/agents` 接进 Rust 核心 runtime。
- 不把 OpenAI Responses compaction 作为通用压缩底座。
- 不用 SDK tracing 替代防篡改 audit ledger。
- 不把 AI SDK UI stream 作为内部主协议；最多后续提供可选 adapter。

本轮已经把这些结论吸收到主设计稿的 `OpenAI Agents JS`、`RuntimeItem`、`ContextProjection`、子 agent 语义和前端流式视图边界中。

## 11. 转 plan 前必须补齐的输入

进入实现 plan 前，主设计稿至少需要补充以下内容：

1. `ContextProjection / Memory Window / Auto Compaction` 状态机；
2. `RuntimeItem / DebugStreamPart` 折叠模型；
3. `BillingSession / Idempotency` 状态机；
4. `External Agent Telemetry Bridge` 可信等级协议；
5. `Capability Runtime` 权限隔离矩阵；
6. `Audit Ledger` 防篡改与对账模型；
7. `workflow-as-tool` 暂停、恢复、审批、补偿边界；
8. `system_agent` 触发器、身份、权限和动作边界；
9. gateway retry、fallback、cache billing、cost attribution 状态机；
10. rate limit 和 fail-safe 策略；
11. 当前实现迁移边界：从 persisted run events 过渡到 event bus + span + ledger 的兼容策略。

## 12. 建议的 plan 切分方向

这里不写实施计划，只记录后续 plan 可采用的切分方向。

后续不宜按“事件类型”拆任务，而应按主干拆：

1. Runtime fact spine：span、event、item、projection、artifact、ledger 的最小事实层；
2. Provider streaming spine：stdio v2 NDJSON、实时 provider event、usage snapshot；
3. Capability loop：tool / MCP / skill / workflow / approval 的 host-owned 调用循环；
4. Gateway billing spine：route、account pool、billing session、idempotency、cost / credit ledger；
5. External bridge and isolation：telemetry ingest、trust level、plugin permission boundary、system agent runtime；
6. Debug stream adapter：内部 `DebugStreamPart` 优先，AI SDK UI stream 只作为外部适配层。

这样每一阶段都能形成可验证的纵向闭环，避免先堆概念表、后期无法串起来。

## 13. 归档判断

本评估整理支持以下判断：

- 原设计方向可以保留；
- 专家 P0 / P1 意见应吸收；
- 当前不宜直接进入实现拆分；
- 下一步应先把主设计稿补成“工程约束版”，再进入 plan；
- plan 阶段应围绕事实主干、计费幂等、权限隔离和外部 agent 可信等级分阶段落地。
