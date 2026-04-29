---
memory_type: feedback
feedback_category: repository
topic: host-infrastructure-cache-contracts
summary: Redis 等缓存/分布式基础设施应作为 HostExtension 实现 Core contract，而不是 RuntimeExtension 或业务插件直连资源。
keywords:
  - host-extension
  - redis
  - cache-store
  - storage-ephemeral
  - distributed-lock
  - event-bus
  - task-queue
match_when:
  - 讨论缓存、Redis、分布式锁、事件总线、任务队列、工作流加速、查询加速或横向扩展时
created_at: 2026-04-29 07
updated_at: 2026-04-29 09
last_verified_at: 无
decision_policy: direct_reference
scope:
  - api
  - api/crates/storage-ephemeral
  - api/crates/control-plane
  - api/plugins
---

# Host 基础设施缓存 Contract

## 时间

`2026-04-29 07`

## 规则

缓存不应作为一个泛化插件层级处理，应拆成宿主基础设施 contract：`storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store`。

Redis 是这些 contract 的一种 HostExtension 实现。Core 拥有 session、lease、cache key namespace、失效规则、task claim、event delivery、rate limit window 等语义；HostExtension 只负责实现。RuntimeExtension 和 CapabilityPlugin 不能直接持有 Redis、NATS、RabbitMQ 等基础设施连接。

下一步开发按完整目标架构落地，不把 Core 内置 Redis 当成目标过渡路径。早期启动依赖的基础设施 provider 需要在 `ApiState` 构造前完成注册。`task-queue` 默认语义采用 at-least-once + idempotency key + visibility timeout；domain event 先进入 durable outbox，再通过 event-bus 投递。

持久化到数据库的 `catalog snapshot / read model` 属于 durable resource owner，由 control-plane 定义语义、`storage-durable/postgres` 实现持久化；`cache-store` 只能作为读取加速，不拥有 catalog 主状态。

## 原因

用户当前单机阶段不需要 Redis，但未来横向扩展、工作流加速和查询加速需要预留平替能力。把 Redis 写进业务代码或运行时插件会破坏宿主治理边界，也会让缓存误变成业务真值。

## 适用场景

- 设计 `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`。
- 讨论 Redis、NATS、RabbitMQ 等基础设施实现。
- 判断查询缓存、工作流队列、数据源 catalog snapshot / read model、插件市场 catalog cache 的 owner。

## 备注

缓存策略属于 resource/action owner；缓存实现属于 HostExtension；缓存数据不能成为核心业务真值。
