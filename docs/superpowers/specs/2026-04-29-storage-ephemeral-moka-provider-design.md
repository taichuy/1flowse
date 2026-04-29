# Storage Ephemeral 与 Moka Local Provider 设计

日期：2026-04-29
状态：待用户审阅

关联文档：
- [插件分层与 HostExtension 收敛设计](./2026-04-29-plugin-layering-and-host-extension-realignment-design.md)
- [HostExtension 内核级插件边界设计](./2026-04-28-host-extension-boundary-design.md)
- [主存储与外部数据源平台设计](./2026-04-23-storage-durable-and-external-data-source-platform-design.md)

## 1. 文档目标

本文用于固定 `storage-ephemeral`、本机缓存实现、后续 Redis HostExtension 的分层关系。

目标是：

1. 本地开发默认保持轻量，只硬依赖 PostgreSQL。
2. 先把缓存、短租约、唤醒信号、限流等上层接口做稳定。
3. 本机默认实现可以使用成熟 Rust 库 `moka`，但业务层不直接感知 `moka`。
4. Redis 后续作为 HostExtension provider 接入，不通过 Core env 分支直连。
5. 缓存和易失层不能承载平台真值，缓存失效最多导致变慢，不导致业务错误。

## 2. 结论摘要

1. `moka` 可以作为 local memory cache provider 的实现细节。
2. `moka` 不进入业务 API、领域模型、service command 或 route DTO。
3. 业务代码只依赖 host infrastructure contract，例如 `CacheStore`、`DistributedLock`、`EventBus`、`TaskQueue`、`RateLimitStore`。
4. 默认 local provider 不要求 Redis、RustFS、NATS、RabbitMQ 等外部中间件。
5. Redis 第一版应实现同一批 contract，而不是恢复 `API_REDIS_URL` / `API_EPHEMERAL_BACKEND=redis`。
6. Redis provider 配置由 `root/system` 后台管理，secret 可通过 `env://REDIS_PASSWORD`、vault 或其他 secret resolver 引用。
7. v1 provider 变更采用 restart-scoped：后台写 desired state，重启后生效。

## 3. 范围与非目标

### 3.1 范围

本文覆盖：

1. `storage-ephemeral` 与 host infrastructure contract 的关系。
2. local memory provider 的目标实现方式。
3. Moka 适合承载的接口。
4. Redis HostExtension 后续替换 local provider 的方式。
5. 哪些能力可以用缓存加速，哪些不能用缓存承载真值。

### 3.2 非目标

本文不在本轮解决：

1. 不实现 Redis HostExtension。
2. 不要求本地启动 Redis。
3. 不设计 provider 实例运行时热切换。
4. 不把可靠任务队列改成 memory queue。
5. 不把 cache miss 当成业务错误。

## 4. 分层模型

目标分层固定为：

```text
业务代码 / service
  只依赖 CacheStore / DistributedLock / EventBus / TaskQueue / RateLimitStore

HostInfrastructureRegistry
  启动期注册默认 provider

local-infra-host
  本机默认 provider，使用 memory / moka / channel

redis-infra-host
  未来 Redis provider，实现同一批 contract
```

业务代码不能直接依赖：

```text
moka
redis
env var name
具体连接字符串
```

## 5. 当前代码事实

当前 `storage-ephemeral` 已有以下可操作接口：

1. `EphemeralKvStore`
   - `set_json`
   - `get_json`
   - `delete`
   - `touch`
   - `set_if_absent_json`

2. `LeaseStore`
   - `acquire`
   - `renew`
   - `release`

3. `WakeupSignalBus`
   - `publish`
   - `poll`

4. `SessionStore`
   - `put`
   - `get`
   - `delete`
   - `touch`

当前 `api-server` 实际运行态已接入的是 `SessionStore`。`CacheStore`、`DistributedLock`、`EventBus`、`TaskQueue`、`RateLimitStore` 在 `HostInfrastructureRegistry` 中已有 provider 槽位，但 trait 仍主要是 provider identity，占位多于真实操作接口。

## 6. 目标接口

### 6.1 CacheStore

`CacheStore` 是业务通用短期缓存接口，适合用 `moka` local 实现。

目标方法：

```rust
#[async_trait]
pub trait CacheStore: Send + Sync {
    async fn get_json(&self, key: &str) -> anyhow::Result<Option<serde_json::Value>>;
    async fn set_json(
        &self,
        key: &str,
        value: serde_json::Value,
        ttl: Option<time::Duration>,
    ) -> anyhow::Result<()>;
    async fn delete(&self, key: &str) -> anyhow::Result<()>;
    async fn touch(&self, key: &str, ttl: time::Duration) -> anyhow::Result<bool>;
}
```

可选后续方法：

```rust
async fn set_if_absent_json(...) -> anyhow::Result<bool>;
async fn get_or_compute_json(...) -> anyhow::Result<serde_json::Value>;
```

`get_or_compute` 只有在调用方明确需要防击穿时再加；默认不把复杂业务回源逻辑塞进基础 trait。

### 6.2 DistributedLock

`DistributedLock` 表示短租约锁，不表示持久所有权。

目标方法：

```rust
#[async_trait]
pub trait DistributedLock: Send + Sync {
    async fn acquire(&self, key: &str, owner: &str, ttl: time::Duration) -> anyhow::Result<bool>;
    async fn renew(&self, key: &str, owner: &str, ttl: time::Duration) -> anyhow::Result<bool>;
    async fn release(&self, key: &str, owner: &str) -> anyhow::Result<bool>;
}
```

Moka 可以辅助 TTL，但锁语义必须显式校验 owner；不能只靠 cache key 是否存在判断释放权限。

### 6.3 EventBus

`EventBus` 表示短期事件通知，不保证 durable delivery。

目标方法：

```rust
#[async_trait]
pub trait EventBus: Send + Sync {
    async fn publish(&self, topic: &str, payload: serde_json::Value) -> anyhow::Result<()>;
    async fn poll(&self, topic: &str) -> anyhow::Result<Option<serde_json::Value>>;
}
```

local provider 可使用 channel；Redis provider 后续可用 pub/sub 或 stream，但是否可靠投递由具体 contract 另行声明。

### 6.4 TaskQueue

`TaskQueue` 只有在明确“可丢 / 可重建”时才允许 local memory 实现。

目标方法：

```rust
#[async_trait]
pub trait TaskQueue: Send + Sync {
    async fn enqueue(&self, queue: &str, payload: serde_json::Value) -> anyhow::Result<String>;
    async fn claim(&self, queue: &str, worker: &str, ttl: time::Duration) -> anyhow::Result<Option<ClaimedTask>>;
    async fn ack(&self, queue: &str, task_id: &str, worker: &str) -> anyhow::Result<bool>;
    async fn fail(&self, queue: &str, task_id: &str, worker: &str, reason: &str) -> anyhow::Result<bool>;
}
```

关键业务任务默认继续走 PostgreSQL outbox / job table。memory queue 只能做开发态、测试态或可丢任务。

### 6.5 RateLimitStore

`RateLimitStore` 表示短窗口计数。

目标方法：

```rust
#[async_trait]
pub trait RateLimitStore: Send + Sync {
    async fn consume(
        &self,
        key: &str,
        limit: u64,
        window: time::Duration,
    ) -> anyhow::Result<RateLimitDecision>;
    async fn reset(&self, key: &str) -> anyhow::Result<()>;
}
```

local provider 可用 Moka 保存窗口计数；Redis provider 后续使用原子自增和过期时间实现。

## 7. Moka Local Provider

### 7.1 使用位置

Moka 只允许出现在 local provider 实现层，例如：

```text
api/crates/storage-ephemeral/src/local/moka_cache_store.rs
api/crates/storage-ephemeral/src/local/moka_session_store.rs
api/crates/storage-ephemeral/src/local/moka_rate_limit_store.rs
```

不允许出现在：

```text
routes
control-plane service
domain model
repository trait
public DTO
HostExtension manifest schema
```

### 7.2 推荐能力

Moka 适合承载：

1. TTL cache。
2. TTI cache。
3. 最大容量限制。
4. 高并发本机读写。
5. 本机 session store。
6. 本机 rate limit window。
7. 短期 JSON KV。

### 7.3 不适合承载

Moka 不适合承载：

1. 跨进程一致缓存。
2. 多实例共享 session。
3. 可靠任务队列。
4. 需要持久审计的状态。
5. 需要强一致锁语义的分布式所有权。

## 8. Redis HostExtension 接入方式

Redis 后续作为 `redis-infra-host`，实现 host infrastructure provider。

后台配置示例：

```json
{
  "extension_id": "redis-infra-host",
  "provider_code": "redis",
  "contracts": [
    "storage-ephemeral",
    "cache-store",
    "distributed-lock",
    "event-bus",
    "rate-limit-store"
  ],
  "config": {
    "host": "redis.example.com",
    "port": 6379,
    "username": "default",
    "password_ref": "env://REDIS_PASSWORD",
    "db": 0,
    "tls": false,
    "namespace": "1flowbase"
  }
}
```

`password_ref = env://REDIS_PASSWORD` 表示后台配置只保存 secret 引用，真实密码由 secret resolver 从部署环境读取。

禁止恢复：

```env
API_EPHEMERAL_BACKEND=redis
API_REDIS_URL=redis://...
```

Core 不根据 env 分支直连 Redis。

## 9. 生效语义

v1 固定为 restart-scoped，但安装、配置和启用可以合并为一次待应用变更，最终只需要重启一次。

推荐流程：

1. 安装 Redis HostExtension 包。
2. 系统读取已安装包里的 manifest、配置 schema 和 capability 声明。
3. 后台展示 Redis provider 配置页；配置页不要求 Redis provider 已经运行。
4. 用户保存 provider 配置，例如 host、port、db、tls、`password_ref`。
5. 用户启用 HostExtension，并选择哪些 infrastructure contract 默认使用 Redis。
6. 系统写入 desired state，并提示重启后生效。
7. 重启 `api-server` 一次。
8. Boot Core 在 `ApiState`、session store、control-plane service、runtime engine 和 HTTP router 构造前完成 pre-state infra provider bootstrap。
9. Host infrastructure registry 注入 Redis provider。

不做 provider 实例运行时热切换，避免 session store、lock、queue 等基础设施在请求处理中被换掉。manifest、配置 schema、provider 配置和 desired state 可以在运行时保存和编辑；真正接管 host infrastructure contract 只在下一次启动时发生。

禁止把流程做成：

```text
启用插件 -> 重启 -> 插件运行后才出现配置页 -> 配置 Redis -> 再重启
```

配置页必须基于已安装 manifest / schema 生成，而不是基于已激活 provider 生成。

## 10. 加速场景

### 10.1 适合优先接入 CacheStore

1. provider catalog / model list 短 TTL 缓存。
2. plugin registry / manifest 解析结果缓存。
3. runtime model metadata 健康状态短缓存。
4. OpenAPI / docs 生成结果缓存。
5. data-source catalog/schema discovery 的短期预览缓存。
6. file preview / presigned URL 的短期状态。

### 10.2 适合优先接入 DistributedLock

1. plugin install / upgrade / reconcile 防并发。
2. official plugin registry sync 防重复。
3. model catalog sync 防重复。
4. data-source import job claim。
5. runtime debug run 单实例 claim。

### 10.3 适合优先接入 EventBus / WakeupSignal

1. SSE / long polling 状态变化唤醒。
2. workflow waiting node 唤醒。
3. worker 有新 job 时唤醒。
4. runtime debug run 状态变化通知。

### 10.4 暂不使用 memory TaskQueue 的场景

1. 计费结算。
2. 审计写入。
3. plugin install 最终状态。
4. 文件导入最终落盘。
5. 工作流 durable execution。

这些任务需要 PostgreSQL outbox / job table 或后续可靠队列 provider。

## 11. 实施顺序建议

建议按以下顺序推进：

1. 把 `HostInfrastructureRegistry` 中占位 trait 扩展为真实操作接口。
2. 用现有 `storage-ephemeral` 能力补齐 local provider。
3. 引入 `moka`，实现 `MokaCacheStore`。
4. 评估是否将 `MemorySessionStore` 改为复用 `MokaCacheStore`。
5. 增加 `MokaRateLimitStore`。
6. 保持 `LeaseStore`、`WakeupSignalBus` 使用专用 memory 实现。
7. 在 1 到 2 个读多写少场景接入 `CacheStore`，验证接口形态。
8. 后续再实现 `redis-infra-host`，替换同一批 contract。

## 12. 验收标准

1. 本地启动仍只需要 PostgreSQL。
2. 业务代码不直接 import `moka`。
3. `CacheStore` cache miss 能回源或重新计算。
4. 删除 local cache 后业务正确性不变，只是变慢。
5. Redis provider 配置不通过 `API_REDIS_URL` 进入 Core。
6. provider enable / disable / upgrade 是 restart-scoped。
7. 关键任务不依赖 memory queue 保证可靠性。

## 13. 参考资料

- Moka async cache docs: https://docs.rs/moka/latest/moka/future/struct.Cache.html
