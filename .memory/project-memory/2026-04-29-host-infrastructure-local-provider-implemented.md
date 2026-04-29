---
memory_type: project
title: 缓存与临时层实现及产品映射已确认
created_at: 2026-04-29 22
updated_at: 2026-04-29 22
decision_policy: verify_before_decision
scope:
  - api
  - api/crates/storage-ephemeral
  - api/apps/api-server/src/host_infrastructure
  - web/app/src/features/settings
status: active
keywords:
  - host-infrastructure
  - storage-ephemeral
  - cache-store
  - session-store
  - task-queue
  - shared-agent-brain
  - product-mapping
---

# 缓存与临时层实现及产品映射已确认

## 谁在做什么？

AI 已把 `feature/storage-ephemeral-moka-provider` fast-forward 合并进 `main`，当前 `main` 与 `origin/main` 均指向 `73b25e0b`。本轮把临时基础设施层从零散本地实现推进为可治理的 HostInfrastructure provider contract，并补了 Settings 里的“基础设施”配置表面。

## 为什么这样做？

用户在 `2026-04-29 22` 追问临时层现状，并要求结合 `docs/draft/1flowbase-product-design-draft-20260428.md` 的产品方向沉淀记忆。产品草稿把 1flowbase 第一阶段收敛为“面向 coding agents 的共享大脑与审计控制台”，需要低延迟、可替换、可治理的临时运行底座来支撑 session、recall pack、成本统计、后台守护任务和模型供应容灾。

## 为什么要做？

当前已落地的接口包括 `CacheStore`、`SessionStore`、`RateLimitStore`、`DistributedLock`、`EventBus`、`TaskQueue`，以及 storage-ephemeral 内部仍保留的 `EphemeralKvStore`、`LeaseStore`、`WakeupSignalBus`。默认 `official.local-infra-host` 注册 `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` 这些 contract。

## 缓存与临时层实现速查

本地默认实现是 in-process/local provider：

- `MokaSessionStore`：console session 的 TTL 存储。
- `MokaCacheStore`：命名空间 JSON cache，支持 TTL、touch、set-if-absent 和容量上限。
- `MokaRateLimitStore`：本地窗口计数限流。
- `MemoryDistributedLock`：基于内存 lease 的 owner 锁。
- `MemoryEventBus`：topic 级 FIFO publish/poll。
- `MemoryTaskQueue`：内存任务队列，支持 idempotency key、claim visibility timeout、ack、fail。

当前 `cache-store` 只负责短期 JSON 缓存和计算结果缓存，不拥有业务真值；`session-store` 是登录/工作区 session 的临时承载；`rate-limit-store` 是本地窗口计数；`distributed-lock`、`event-bus`、`task-queue` 是后续工作流加速、模型供应治理和后台守护 agent 的协同基础。

## 产品映射

结合 `docs/draft/1flowbase-product-design-draft-20260428.md`，这层能力应优先映射到“coding agents 共享大脑与审计控制台”的运行加速，而不是对外宣称完整记忆系统已完成：

- agent session 恢复：用 `SessionStore` / `CacheStore` 缓存当前 workspace、短期 agent 会话索引、最近上下文选择结果，减少重查和重算。
- recall pack 加速：用 `CacheStore` 缓存 session + 任务 + 仓库状态计算出的 recall pack、memory ranking、摘要片段和 token 预算结果。
- 成本与审计面板：用 `CacheStore` / `TaskQueue` 暂存 token、cache、MCP、skills、provider attempt 等中间计量，再异步汇总到 durable 账本和审计。
- 模型供应容灾：用 `DistributedLock` 避免 provider catalog refresh、模型探测和 failover 恢复任务重复执行；用 `RateLimitStore` 保护 provider、workspace、user 级高频调用。
- 后台守护 agent：用 `TaskQueue` 排队执行 session 归档、transcript 压缩、决策抽取、进度总结和清理任务。
- 多 agent 状态通知：用 `EventBus` 支撑单进程内 session 更新、记忆写入、provider 状态变化、任务完成等通知；多进程/团队版需要外部 provider。
- 高频入口保护：用 `RateLimitStore` 保护登录、模型预览、插件安装、catalog 刷新、agent debug run、MCP proxy 调用等昂贵入口。

## 截止日期？

当前实现已合并并可作为后续开发基线。后续每次讨论临时层、共享大脑控制面、模型供应容灾或团队版多实例部署时，需回到当前代码和最新文档重新验证。

## 决策背后动机？

当前 local provider 适合开发、本地单机和早期 MVP；它的价值是固定宿主 contract 与产品加速点，不是宣称已经具备生产级分布式基础设施。团队版/企业版、多实例部署或跨进程事件/任务可靠性需要后续补 Redis、NATS、RabbitMQ 或等价外部 HostExtension provider。

缓存层不能拥有业务真值；持久化事实仍归 durable resource owner 与 `storage-durable/postgres`。`cache-store` 只做读取加速和短期计算结果缓存；domain event 若要求可靠投递，应先进入 durable outbox，再通过 event-bus 投递。

## 验收证据

- 合并前：`cargo test --manifest-path api/Cargo.toml` 通过。
- 合并前：前端 app Vitest `75 files / 332 tests` 通过。
- 合并前：前端 lint、TypeScript `--noEmit`、Vite build 通过。
- 合并前：`node scripts/node/test-scripts.js` 通过，`176` 个子测试。
- 合并后：host infrastructure 后端专项 cargo 测试通过。
- 合并后：前端 host infrastructure/settings/agent-flow 专项 Vitest `4 files / 30 tests` 通过。
- 合并后：`dev-up` 脚本专项 `23` 个子测试通过。
- 合并后：`style-boundary all-pages` 全部通过。

## 后续判断边界

讨论产品价值时，把这次改造表述为“共享大脑/审计控制面需要的临时运行底座”，不要说成完整记忆系统已经完成。讨论生产部署时，明确当前默认是 in-process local provider；外部 provider 是下一阶段扩展目标。
