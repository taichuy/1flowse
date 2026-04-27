---
memory_type: feedback
feedback_category: repository
topic: Agent runtime 设计优先保证记录审计和调试底座
summary: 设计 agent runtime、model gateway、capability runtime 或外部 agent 接入时，优先保证运行记录、审计、调试和可观测性；外部客户端是否改造不是推进架构的前置条件，完整可观测可通过 optional telemetry/callback 增强。
keywords:
  - agent-runtime
  - capability-runtime
  - model-gateway
  - external-agent
  - observability
  - audit
  - telemetry
  - subagent
  - compaction
match_when:
  - 设计 Agent Runtime、Capability Runtime、RuntimeEvent 或 RuntimeSpan
  - 设计 OpenAI-compatible gateway、中转站、模型供应商接入或 relay 路由
  - 设计外部本地 agent 接入、子 agent、自动压缩、skill/MCP/tool 调用记录
  - 权衡是否要求客户端改造才能记录内部 tool/skill/subagent 行为
created_at: 2026-04-27 12
updated_at: 2026-04-27 12
last_verified_at: 2026-04-27 12
decision_policy: direct_reference
scope:
  - api/crates/orchestration-runtime
  - api/crates/control-plane
  - api/crates/plugin-framework
  - api/apps/plugin-runner
  - api/apps/api-server
  - docs/superpowers/specs
  - .memory/feedback-memory/repository
---

# Agent runtime 设计优先保证记录审计和调试底座

## 时间

`2026-04-27 12`

## 规则

- Agent runtime、Capability runtime、model gateway、中转站和外部 agent 接入设计时，优先保证运行记录、审计、调试和可观测性。
- 不要把“外部客户端必须先改造”作为架构推进的前置条件；基础模式先记录 1flowbase 能看到的请求、响应、usage、route、错误和链路。
- 对于外部 CLI agent 自己调用 MCP、skill、tool、subagent 的场景，如果没有 telemetry/callback，只能标记为外部不可见或旁路审计；完整记录通过 optional telemetry/callback 增强。
- 设计时必须覆盖模型调用、skill 使用、输入 token、cache hit、输出 token、自动压缩、子 agent 和内部系统 agent 的记录。

## 原因

用户关注的是后续整理、调试和诊断能力，而不是先约束客户端怎么改。1flowbase 作为中转平台和 agent 平台，需要让用户看清 AI 在做什么；同时要承认外部 agent 未上报内部事件时，宿主无法凭空获得完整工具调用细节。

## 适用场景

- RuntimeEvent / RuntimeSpan / CapabilityCatalog / CapabilityRuntime 设计。
- Provider stdio streaming、OpenAI-compatible gateway 和中转站 route 设计。
- 外部本地 agent、内部系统守护 agent、subagent、auto compaction、skill/MCP/tool observability 设计。
- 调试台、usage ledger、audit log 和 billing attribution 设计。

## 备注

- 完整可观测不是强制客户端改造的前置条件，而是外部 agent bridge 的增强能力。
- Raw gateway 模式默认应无损转发；Managed agent 模式才由 1flowbase 管理会话投影、压缩和能力调用循环。
