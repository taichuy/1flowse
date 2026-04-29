# 插件分层与 HostExtension 收敛执行规格补充

日期：2026-04-29
状态：执行规格补充，待拆执行计划

关联主设计：
- [插件分层与 HostExtension 收敛设计](./2026-04-29-plugin-layering-and-host-extension-realignment-design.md)

## 1. 补充目标

主设计已经确定 `Core / HostExtension / RuntimeExtension / CapabilityPlugin` 的边界。本补充只把落地时容易反复的三块写成硬规格：

1. `HostExtension v1 native in-process` 如何加载。
2. `pre-state infra provider bootstrap` 如何替代 Core 内置 Redis 分支。
3. `Resource Action Kernel v1` 如何形成最小可验收闭环。

本补充按开发早期口径处理：不保留兼容旧 env、旧 manifest 或旧内置 Redis 目标形态。

## 2. 不再保留的旧目标

以下形态不再作为目标架构：

1. `API_EPHEMERAL_BACKEND=redis` 直接让 Core 选择 Redis session store。
2. HostExtension 只检查 `runtime.entry` 文件存在，然后把安装状态标记为 active。
3. `api/apps/api-server/src/host_extensions/builtin.rs` 长期保存完整 builtin host manifest。
4. HostExtension 通过静态链接进入 `api-server` 主二进制。
5. HostExtension 运行中 `dlclose`、热卸载或热替换 Rust native 代码。
6. RuntimeExtension 或 CapabilityPlugin 直接持有 Redis、NATS、RabbitMQ 等基础设施连接。

## 3. HostExtension v1 Native 加载

第一阶段 `HostExtension` 只支持可信 native in-process 形态。它是进程生命周期内加载的部署级系统模块，不是可重复热卸载插件。

### 3.1 两层 Manifest

`manifest.yaml` 继续负责插件包身份：

```yaml
schema_version: 1flowbase.plugin.manifest/v1
manifest_version: 1
plugin_id: redis-infra-host@0.1.0
version: 0.1.0
vendor: 1flowbase
display_name: Redis Infrastructure Host
description: Redis backed host infrastructure provider.
source_kind: official_registry
trust_level: verified_official
consumption_kind: host_extension
execution_mode: in_process
slot_codes: [host_bootstrap]
binding_targets: []
selection_mode: auto_activate
minimum_host_version: 0.1.0
contract_version: 1flowbase.host_extension/v1
permissions:
  network: outbound_only
  secrets: host_managed
  storage: host_managed
  mcp: none
  subprocess: deny
runtime:
  protocol: native_host
  entry: host-extension.yaml
```

`host-extension.yaml` 负责 host contribution 声明：

```yaml
schema_version: 1flowbase.host-extension/v1
extension_id: redis-infra-host
version: 0.1.0
bootstrap_phase: pre_state
native:
  abi_version: 1flowbase.host.native/v1
  library: lib/redis_infra_host
  entry_symbol: oneflowbase_host_extension_entry_v1
owned_resources: []
extends_resources: []
infrastructure_providers:
  - contract: storage-ephemeral
    provider_code: redis
    config_ref: secret://system/redis-infra-host/config
routes: []
workers: []
migrations: []
```

### 3.2 加载顺序

HostExtension 加载顺序固定为：

```text
read manifest.yaml
-> verify package trust and source policy
-> read host-extension.yaml
-> validate deployment policy
-> build extension load plan
-> run extension-owned migrations
-> load native library once
-> call entrypoint with restricted registrar
-> freeze contributions
-> mark active or load_failed
```

### 3.3 Native 入口约束

native entrypoint 固定为：

```text
oneflowbase_host_extension_entry_v1(registrar) -> HostExtensionLoadStatus
```

规则：

1. `registrar` 是 opaque host handle，不暴露 Rust 内部类型 ABI。
2. ABI 版本不匹配直接拒绝加载。
3. native library 只在进程启动期加载一次，进程退出前不 `dlclose`。
4. entrypoint 只能注册 `host-extension.yaml` 已声明的 contribution。
5. entrypoint 不得启动长期线程；后台能力必须声明为 worker，由 host worker registry 启停。
6. entrypoint 不得直接读取 secret 明文；secret 只通过 `secret://system/<extension_id>/<key>` 由宿主解析。
7. panic 或返回错误时，该 HostExtension 标记为 `load_failed`，不挂载 route、worker、hook 或 provider。
8. 单个 extension 的 contribution 要么全部注册成功，要么全部丢弃。

### 3.4 受限 Registrar

`HostExtensionRegistrar` v1 只允许注册声明式 contribution：

```text
register_infrastructure_provider(contract, provider_code, factory)
register_owned_resource(resource_definition)
register_action(action_definition)
register_action_hook(hook_definition)
register_route(route_definition)
register_worker(worker_definition)
```

它不提供：

1. `MainDurableStore` 裸引用。
2. Axum `Router` 裸引用。
3. 任意 repository impl。
4. secret 明文。
5. 可绕过权限、审计、CSRF 或 OpenAPI 的 HTTP 注册口。

## 4. pre-state Infra Provider Bootstrap

`pre-state infra provider bootstrap` 的含义是：主存储连接可以先建立，但 `ApiState`、session store、control-plane service、runtime engine 和 HTTP router 构造前，必须完成早期基础设施 provider 选择。

### 4.1 启动顺序

启动顺序固定为：

```text
read ApiConfig
-> connect main durable PostgreSQL
-> load deployment plugin sets
-> load installed HostExtension metadata
-> build pre-state HostExtension load plan
-> validate pre-state infrastructure providers
-> build HostInfrastructureRegistry
-> construct ApiState and control-plane services from registry
-> load boot-phase HostExtension contributions
-> mount resource/action routes and host routes
```

### 4.2 输入边界

env 只保留部署入口配置：

```text
API_ENV
API_DATABASE_URL
API_PLUGIN_SET
API_PLUGIN_INSTALL_ROOT
API_HOST_EXTENSION_DROPIN_ROOT
API_SECRET_RESOLVER
```

Redis、NATS、RabbitMQ 等 provider 配置不进入 Core env 分支。它们通过 system secret 引用进入对应 HostExtension：

```text
secret://system/redis-infra-host/config
secret://system/nats-event-bus-host/config
secret://system/rabbitmq-task-queue-host/config
```

### 4.3 Registry 最低能力

`HostInfrastructureRegistry` v1 必须提供：

```text
register_provider(contract, provider_code, extension_id, config_ref)
default_provider(contract) -> provider_code
session_store() -> dyn SessionStore
ephemeral_kv() -> dyn EphemeralKvStore
cache_store() -> dyn CacheStore
distributed_lock() -> dyn DistributedLock
event_bus() -> dyn EventBus
task_queue() -> dyn TaskQueue
rate_limit_store() -> dyn RateLimitStore
```

固定约束：

1. 每个 infrastructure contract 可注册多个 provider。
2. 同一 deployment profile 下，每个 contract 只能有一个 default provider。
3. `storage-ephemeral` 在 `ApiState` 构造前必须有 default provider；缺失则启动失败。
4. `local-infra-host` 是默认可信 provider，也必须通过 registry 注册。
5. 调用方只能依赖 contract facade，不能判断 provider 具体实现。
6. RuntimeExtension 和 CapabilityPlugin 只能通过 runtime context 使用受控 cache / queue facade，不能获取 provider client。

### 4.4 Contract 语义

`task-queue` 默认语义：

```text
delivery: at-least-once
required fields: task_id, idempotency_key, claim_owner, visibility_timeout, retry_policy, dead_letter_policy
```

`distributed-lock` 默认语义：

```text
required operations: acquire, renew, release
required fields: lock_key, lease_ttl, owner_id, fencing_token
```

`event-bus` 默认语义：

```text
domain_event: durable outbox first, then publish
runtime_live_event: can be non-durable
cache_invalidation: can be async, but must recover from durable version or outbox
```

## 5. Resource Action Kernel v1

v1 先解决统一入口、事务、hook、审计和 outbox，不要求一次性迁完所有 route。

### 5.1 核心类型

```text
ResourceDefinition
  code
  owner_kind: core | host_extension
  owner_id
  scope_kind: system | workspace
  actions

ActionDefinition
  resource_code
  action_code
  input_schema
  output_schema
  permission_policy
  cache_policy
  handler
  hook_points

ActionContext
  actor
  tenant_id
  workspace_id?
  request_id
  idempotency_key?
  transaction
  infrastructure
  audit_sink
  domain_event_outbox
```

### 5.2 Pipeline 语义

```text
before_validate
-> before_authorize
-> before_execute
-> execute
-> after_execute
-> commit
-> after_commit
-> on_failed
```

阶段规则：

1. `before_validate` 可以补齐输入默认值或拒绝请求；不能访问 repository，不能写状态。
2. `before_authorize` 可以追加权限要求或拒绝；不能降低 Core 权限要求。
3. `before_execute` 可以准备 extension context 或阻断动作；不能写 Core 真值表。
4. `execute` 是唯一能改变 resource 真值的 handler；Core resource 的 handler 仍调用 Core service command。
5. `after_execute` 仍在宿主事务内，可以写 extension-owned sidecar table、projection 或 outbox；不能写其他 owner 的真值表。
6. `commit` 由 kernel 统一提交，Core 写入、sidecar 写入、audit 和 durable outbox 必须在同一事务策略中收束。
7. `after_commit` 只能发 event、enqueue worker、同步外部系统；失败不能回滚已提交真值，但必须记录 warning 或补偿任务。
8. `on_failed` 只记录失败、清理 extension context 或写补偿任务；不能吞掉 Core action 的错误。

### 5.3 Hook 排序和失败规则

1. hook 顺序按 `stage -> priority -> extension_id -> hook_code` 排序。
2. 默认 priority 为 `1000`。
3. 同一 stage 中任一 hook 返回 `deny` 或 `error`，后续 stage 不执行。
4. `after_commit` hook 失败不改变 action result，但会写入 action warning 和补偿队列。
5. 同一 resource/action 的 hook 必须在 boot 阶段完成冻结，运行中不增删。
6. HostExtension 只能注册自己 manifest 中声明的 hook。

### 5.4 v1 最小验收闭环

`plugins.install`：

```text
owner: Core
handler: existing PluginManagementService install command
before_authorize: root / trust source / upload policy
after_execute: audit + plugin lifecycle domain event
after_commit: optional marketplace-license hook
```

`files.upload`：

```text
owner: Core
handler: existing FileUploadService upload command
before_authorize: workspace file permission
after_execute: file record audit + files.uploaded outbox event
after_commit: optional file-security scan worker hook
```

迁移规则：

1. route 只做协议解析、上下文提取、调用 `resource_action_kernel.dispatch()`、响应映射。
2. 现有 service command 不删除，先作为 Core action handler 被 kernel 包住。
3. 新增核心写动作必须先注册 `ResourceDefinition / ActionDefinition`，再暴露 route。
4. 未迁移 route 不允许直接被 HostExtension hook；只有进入 kernel 的 action 才是扩展点。
5. cache policy 只能挂在 action definition 上，失效源必须是 durable domain event 或 resource version。

## 6. HostExtension Migration Namespace

HostExtension 可以拥有 migration，但只能写自己的 namespace。

规则：

1. Core migration 链仍属于 `storage-durable/postgres/migrations`。
2. HostExtension migration 随插件包放在 `migrations/postgres/`。
3. 宿主用 `host_extension_migrations` 记录 `extension_id`、`plugin_version`、`migration_id`、`checksum`、`applied_at` 和 `package_fingerprint`。
4. extension-owned 表统一使用 `ext_<normalized_extension_id>__<table>` 前缀。
5. migration runner 在加载 extension contribution 前执行。
6. migration 失败则 extension 标记 `load_failed`，不注册 route、worker、hook 或 provider。
7. migration 不得修改 `plugin_installations`、`plugin_tasks`、权限、审计、session、workspace、core file/workflow 真值表。
8. 如果 extension 需要改变 Core 真值，只能通过 action handler 或 hook 调用 Core action。

## 7. 执行拆分建议

后续实现计划按 1+n 拆分：

1. 计划索引：列出目标架构、共享术语和所有执行计划依赖关系。
2. Plan A：文档与本地规则收敛，更新 `api/AGENTS.md`、`api/plugins/README.md`、旧 env 示例和插件目录规则。
3. Plan B：HostExtension manifest v1 与 native load plan，只做到校验、registry、失败状态和测试。
4. Plan C：pre-state infra provider bootstrap，移除 Core 内置 Redis 分支，接入 `local-infra-host`。
5. Plan D：Resource Action Kernel v1，打通 `plugins.install` 和 `files.upload`。
6. Plan E：HostExtension route / worker / migration namespace。
7. Plan F：迁移 builtin host manifest 到 `api/plugins/host-extensions/*`，保留 api-server 只做 loader、policy、inventory、infra bootstrap、route mount 和 boot assembly。

## 8. 验收门槛

每个执行计划完成时至少验证：

1. `cargo fmt`。
2. 对应 crate 的 targeted unit tests。
3. 涉及 route 时跑 api-server route tests。
4. 涉及 migration 时使用独立 schema 跑数据库测试，避免污染共享 schema migration checksum。
5. 涉及全局后端边界时跑 `node scripts/node/verify-backend.js`。

进入验收或交付阶段时使用 `qa-evaluation`。

## 9. 自检

本补充已检查：

1. 没有保留兼容旧 Redis env 的目标路径。
2. 没有要求 Rust native HostExtension 热卸载。
3. 没有把 RuntimeExtension 或 CapabilityPlugin 提升为宿主基础设施 owner。
4. 没有让 HostExtension 直接改 Core 真值表。
5. 已明确 Resource Action Kernel 的最小闭环和迁移边界。
6. 已明确 HostExtension migration namespace 和失败语义。
