---
memory_type: project
topic: LLM 节点容灾队列与对外模型供应底座设计决策
summary: Agent runtime / model gateway 设计中，raw gateway 只作为对外协议入口；LLM 节点是对外供应单元，自动容灾由 LLM 节点引用用户手动排序的容灾队列完成，失败逐个尝试并如实记录与扣费。
keywords:
  - llm-node
  - failover-queue
  - model-gateway
  - agent-runtime
  - usage-ledger
  - protocol-fact-model
  - audit
created_at: 2026-04-27 16
updated_at: 2026-04-27 16
last_verified_at: 2026-04-27 16
decision_policy: verify_before_decision
scope:
  - docs/superpowers/specs
  - docs/superpowers/specs/1flowbase/modules/05-runtime-orchestration/README.md
  - docs/superpowers/specs/1flowbase/modules/06b-publish-gateway/README.md
  - api/crates/control-plane
  - api/crates/orchestration-runtime
  - web/app/src/features/agent-flow
---

# LLM 节点容灾队列与对外模型供应底座设计决策

## 时间

`2026-04-27 16`

## 谁在做什么

用户与 AI 正在收敛 agent runtime、model gateway、LLM 节点容灾、审计账本和对外协议发布的系统场景底座 spec。

## 为什么这样做

1flowbase 作为本地 agent 或外部客户端的模型供应中间层时，raw gateway 只承担对外协议入口职责；真正的一线供应单元是 LLM 节点。容灾、参数、账本和审计都应以 LLM 节点为核心事实入口。

## 已确认决策

- raw gateway 对外仍只暴露一个逻辑模型/API，内部容灾不放到 gateway 全局路由里。
- LLM 节点增加“固定模型 / 容灾队列”模式；开启自动容灾时不再绑定单个 `source_instance_id`。
- 容灾队列由用户在设置中创建并手动排序，不做同模型 ID 自动分组。
- 队列项可以混排不同供应商和协议；1flowbase 作为中间层负责统一能力和协议映射。
- 中转站插件不直接暴露给 LLM 节点；它负责拉取中转站模型列表并归一化写入模型供应商目录，LLM 节点和容灾队列只引用模型供应商中的 `provider_instance_id + upstream_model_id + protocol`。
- 请求某个队列项失败后直接尝试下一个，不做失败类型白名单；全部失败则如实返回全部失败。
- 失败 attempt 如实记录；账单和日志必须展示切换链路、失败原因、usage/cache/cost 来源。
- 如果上游 attempt 拿不到 usage/cost，不做估算扣费，直接标记为 `unavailable_error`，最终响应报错，日志记录最终响应错误。
- 队列模板更新只影响后续运行；已经开始的运行不要求跟随新模板。
- LLM 节点参数为一线参数来源；与队列项可能冲突的配置应拆出来归属到 LLM 节点，而不是让队列项覆盖节点。
- LLM 节点必须形成标准输出对象 `LlmNodeOutputs` 并写回 `VariablePool`，下游节点只消费该输出对象，不直接读取 provider 原始响应。
- 流式响应允许首 token 前缓冲以支持容灾；首 token 后失败应如实记录，不拼接切换后的输出。
- 对外发布协议应先沉淀内部统一事实模型，再映射到 OpenAI-compatible、Anthropic-compatible、Gemini 等外部协议。
- 外部 agent 内部 skill/MCP/subagent 自述日志不进入主审计链；平台只记录自己实际观测到的模型请求、响应、tool call/message、usage、cache、耗时和来源。

## 为什么要做

该设计让用户能清楚解释一次模型调用经历了哪些尝试、每次尝试花了多少 token/时间/费用、为什么切换，以及最终成功或失败的来源，同时避免把本地 agent 内部未经过平台的行为误标为平台事实。

## 截止日期

无固定截止日期；当前处于 spec 收敛阶段，后续进入 plan 前需要把这些决策写入正式设计文档。

## 决策背后动机

用户希望系统底座优先支撑对话历史审计、执行链路复盘、LLM 节点有序执行、token/cache/time/source 对账，以及可靠的模型供应容灾。产品上要保持“一个对外模型入口”的心智，工程上要把容灾尝试、账本和审计固化为可验证事实。
