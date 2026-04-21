---
memory_type: feedback
feedback_category: repository
topic: LLM 节点必须绑定稳定供应商语义而不是基础设施实例 ID
summary: 设计 LLM 节点、供应商删除重装和运行时解析时，不能让业务节点直接绑定 `provider_instance_id` 这类易失基础设施标识；节点应绑定稳定的供应商语义，若需要多配置能力，应单独设计稳定绑定层。
keywords:
  - llm-node
  - provider
  - provider-instance
  - instance-id
  - coupling
  - decoupling
  - layering
  - stable-identity
match_when:
  - 设计或调整 LLM 节点配置结构
  - 设计模型供应商运行时解析、校验或删除重装逻辑
  - 判断节点应绑定供应商语义还是基础设施实例对象
  - 讨论多实例、多配置与业务节点解耦方案
created_at: 2026-04-21 22
updated_at: 2026-04-21 22
last_verified_at: 2026-04-21 22
decision_policy: direct_reference
scope:
  - web/app/src/features/agent-flow
  - web/app/src/features/settings
  - api/crates/control-plane/src/orchestration_runtime.rs
  - api/crates/control-plane/src/model_provider.rs
  - docs/superpowers/specs
  - .memory/feedback-memory/repository
---

# LLM 节点必须绑定稳定供应商语义而不是基础设施实例 ID

## 时间

`2026-04-21 22`

## 规则

- `LLM` 节点不应直接绑定 `provider_instance_id` 这类基础设施实例标识。
- `LLM` 节点应绑定稳定的供应商语义，例如 `provider_code + model_id`，或独立设计的稳定绑定键。
- 如果同一供应商需要多套配置或多条接入链路，应该新增稳定绑定层或逻辑配置层，不要把底层实例 UUID 直接暴露进节点文档。
- 删除、卸载、重装供应商后，节点是否可恢复，应由稳定供应商语义重新解析，而不是依赖已删除实例的历史 ID。

## 原因

- 让业务节点直接绑定 `provider_instance_id`，会把供应商能力选择和底层凭据实例、安装实例、临时 UUID 耦合在一起。
- 这种设计会让“删除重装供应商”直接演化成节点级断裂，暴露出明显的分层错误：节点真正依赖的是供应商能力，而不是某个短生命周期的基础设施实例对象。
- 当系统需要做删除、重装、切换版本、切换当前配置等动作时，稳定业务语义与易失运行时对象之间必须解耦，否则架构会持续把底层运维对象泄漏到产品层交互。

## 适用场景

- 设计 `LLM` 节点 schema、默认值、文档校验与持久化结构
- 设计供应商选择器、模型选择器和相关交互
- 设计供应商删除、卸载、重装、切版本后的恢复语义
- 设计运行时如何从节点配置解析到当前可用的供应商接入配置
- 讨论同供应商多配置能力是否保留，以及如何做稳定映射

## 备注

- 这是明确的仓库级架构反馈，不是局部 UI 偏好。
- 后续讨论交互、架构、运行时、删除恢复时，应直接把这条规则当作前置约束使用。
- 如果未来确认 `LLM` 节点只绑定供应商语义，那么“实例”应降级为运行时承载配置；如果未来仍需保留多配置能力，也必须新增稳定绑定层，而不是继续沿用 `provider_instance_id` 直接绑定业务节点。
