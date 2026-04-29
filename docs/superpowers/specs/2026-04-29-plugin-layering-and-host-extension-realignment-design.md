# 插件分层与 HostExtension 收敛设计

日期：2026-04-29
状态：待用户审阅

关联文档：
- [HostExtension 内核级插件边界设计](./2026-04-28-host-extension-boundary-design.md)
- [主存储与外部数据源平台设计](./2026-04-23-storage-durable-and-external-data-source-platform-design.md)
- [文件管理与对象存储分层设计](./2026-04-23-file-manager-storage-design.md)

## 1. 文档目标

本文用于收口本轮关于插件分层、源码目录、生命周期和能力边界的最终结论。

重点明确：

1. `Core / HostExtension / RuntimeExtension / CapabilityPlugin` 的最终落点。
2. 插件源码是否可以放在主仓，以及应该放在哪。
3. 三层插件的生命周期、启停语义和打包方式。
4. `HostExtension` 到底能扩展什么，不能扩展什么。
5. 现有能力如文件管理、主存储、临时缓存、数据源、工作流分别属于哪一层。
6. 现有后端结构和调整后的后端结构。
7. `Resource / Action / Hook` 如何成为 HostExtension 横向扩展核心业务的稳定入口。
8. 缓存、分布式锁、事件总线、任务队列等基础设施如何通过 HostExtension 平替。
9. 新增需求时如何快速判断应该写到哪一层。

## 2. 结论摘要

本轮最终结论如下：

1. 插件是否成立，判断标准是是否走独立 `package / install / enable-disable / load` 生命周期，而不是源码是否位于主仓。
2. 主仓可以预留统一插件源码工作区，CLI 创建插件可以直接生成到主仓。
3. `HostExtension` 是受治理的内核级系统插件，可以实现或替换 host contract，也可以拥有自己命名空间下的系统资源、migration、service 和受控 route。
4. `HostExtension` 不能绕过 Boot Core 的治理边界：不能改写核心安装状态、权限、审计、主存储连接、安全策略，不能裸开任意 HTTP route，不能直接篡改其他模块的表。
5. `RuntimeExtension` 是某个 runtime slot 的具体实现，例如 `model_provider`、`data_source`、`file_processor`。
6. `CapabilityPlugin` 是用户在 workflow / app / canvas 中显式选择的一项能力，例如 node、tool、trigger、publisher。
7. 平台最小内核和跨模块一致性属于 `Core`；文件管理、数据源平台、工作流平台这类系统模块可以先在核心实现，也可以逐步迁为官方 `HostExtension`。
8. `HostExtension` 随主进程内加载，启用、停用、升级通过 `desired_state` 管理，并在重启后生效。
9. 禁止为 `HostExtension` 设计 Rust `so/dll` 可重复热加载 / 热卸载；需要可重复卸载的运行时优先考虑声明式、Lua 或 WASM。
10. 需要补一层 `Resource Action Kernel`，让核心业务通过 `Resource / Action / Hook` 暴露稳定扩展点。
11. `HostExtension` 可以扩展现有核心业务，但必须通过 resource action、显式 hook、sidecar table、受控 route 和 domain event；不能直接改写核心表。
12. 缓存不作为单一能力层处理，应拆成 `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` 等宿主基础设施 contract。
13. Redis 是这些 contract 的一种 HostExtension 实现；Core 拥有语义、失效规则和缓存策略，Redis HostExtension 只负责实现。

## 3. 范围与非目标

### 3.1 范围

本设计覆盖：

1. 后端插件源码目录约定。
2. 三层插件与核心代码的边界。
3. 三层插件的生命周期与打包语义。
4. 现有核心能力的归属判断。
5. 后端现有结构与目标结构。
6. HostExtension 扩展现有核心业务的写法。
7. Redis、缓存、分布式锁、事件总线和任务队列的扩展方式。
8. 后续新增需求的落点判断规则。

### 3.2 非目标

本设计不在本轮解决以下问题：

1. 不实现完整的 `HostExtension` runtime。
2. 不实现 `CapabilityPlugin` 完整安装链路。
3. 不实现新的插件注册中心协议。
4. 不把当前所有 builtin host manifest 立即迁完。

## 4. 分层模型

调整后的模型固定为：

```text
Boot Core
└─ Core Platform
   ├─ HostExtension
   ├─ RuntimeExtension
   └─ CapabilityPlugin
```

更精确地说：

```text
api-server
  -> Boot Core / control-plane host

crates/*
  -> Core Platform

plugins/host-extensions/*
  -> HostExtension source workspace

plugins/runtime-extensions/*
  -> RuntimeExtension source workspace

plugins/capability-plugins/*
  -> CapabilityPlugin source workspace

plugin-runner
  -> RuntimeExtension / CapabilityPlugin execution host
```

## 5. 现有后端结构

当前后端更接近直接分层结构：

```text
api/apps/api-server
  -> route / middleware / response / OpenAPI / app assembly

api/crates/control-plane
  -> service command / state write entry / audit / repository trait

api/crates/domain
  -> stable domain model / scope semantics / core value object

api/crates/runtime-core
  -> runtime registry / runtime resource descriptor / runtime ACL / runtime engine

api/crates/plugin-framework
  -> plugin manifest / host extension manifest / host contract / runtime slot contract

api/crates/storage-durable/postgres
  -> migration / repository impl / mapper / SQL

api/crates/storage-ephemeral
  -> session / short-lived coordination / local ephemeral implementation

api/crates/storage-object
  -> object storage implementation boundary

api/crates/observability
  -> local event bus / trace / log foundation

api/apps/plugin-runner
  -> RuntimeExtension / CapabilityPlugin execution host

api/plugins
  -> plugin source workspace / package / installed / fixture
```

当前核心写路径通常是：

```text
route
-> service command
-> repository trait
-> storage implementation
-> table
```

当前已经具备的基础：

1. `ResourceDescriptor / ResourceRegistry` 已经存在，但主要用于 runtime resource 描述和信任等级约束。
2. `HostExtensionManifest / HostExtensionRegistry` 已经存在，但目前主要表达 contract、slot、storage 和 interface 注册。
3. `control-plane` 已经承担 service command 和状态写入口。
4. `api-server` 已经按 route 调 service 的模式组织控制面 HTTP API。

当前缺口：

1. 还没有类似 NocoBase 的全局 `Resource -> Action -> Middleware / Hook` 内核。
2. `Resource` 还没有成为所有系统业务的统一治理单元。
3. `Action` 还没有成为可注册、可审计、可 hook 的稳定动作入口。
4. `HostExtension` 还不能声明式扩展已有核心 resource/action。
5. 横向扩展目前只能靠新增 route、service 或内部改代码，不适合作为长期插件扩展面。
6. 缓存、分布式锁、事件总线、任务队列等基础设施 contract 尚未统一抽象，单机实现与未来 Redis 实现还缺少稳定平替边界。

## 6. 调整后的后端结构

目标后端结构应补齐 `Resource Action Kernel`，让核心业务和 HostExtension 都通过同一套 resource/action 入口被治理。

```text
api/apps/api-server
  -> pre-state infra provider bootstrap
  -> boot assembly
  -> host infrastructure registry
  -> host route registry
  -> generated or mounted resource/action routes
  -> middleware / response / OpenAPI

api/crates/control-plane
  -> resource kernel
  -> resource catalog
  -> action registry
  -> action pipeline
  -> cache policy registry
  -> infrastructure contract registry
  -> domain event outbox semantics
  -> service command
  -> domain event / audit
  -> repository trait

api/crates/plugin-framework
  -> HostExtension manifest
  -> trusted native host entrypoint manifest
  -> resource contribution manifest
  -> action contribution manifest
  -> infrastructure implementation manifest
  -> hook / policy / worker / route declaration

api/crates/storage-durable
  -> main durable store boundary
  -> extension migration runner boundary

api/crates/storage-durable/postgres
  -> Core migrations
  -> extension-owned namespace migrations
  -> repository impl / mapper

api/plugins/host-extensions/<extension_id>
  -> manifest.yaml
  -> host-extension.yaml
  -> migrations/
  -> src/ or package payload

api/plugins/host-extensions/redis-infra-host
  -> optional Redis-backed infrastructure implementation source

api/plugins/runtime-extensions/<extension_id>
  -> runtime slot implementation package source

api/plugins/capability-plugins/<plugin_id>
  -> workspace-selectable capability package source
```

目标核心写路径变为：

```text
route or internal caller
-> Resource Action Kernel
-> action policy
-> action validator
-> explicit hook pipeline
-> action handler / service command
-> repository trait
-> transaction commit
-> domain event / after_commit hook
```

### 6.1 Resource 定义

`Resource` 不是数据库表。

```text
Resource = 一个可被权限、审计、扩展、API 暴露统一管理的业务资源。
Action = 这个资源上允许执行的稳定动作入口。
Table = resource 的一种存储实现细节，不直接暴露给插件。
```

示例：

```text
Resource: plugins
Actions: install / enable / disable / upgrade / uninstall
Core tables: plugin_installations / plugin_tasks
Owner: Core

Resource: files
Actions: upload / bind / delete / scan / share
Tables: file_records / file_tables / extension sidecar tables
Owner: Core now, file-management HostExtension later

Resource: workflows
Actions: create / publish / start_run / cancel_run
Tables: workflows / workflow_runs / debug_events / extension sidecar tables
Owner: Core now, workflow HostExtension later
```

### 6.2 Action Pipeline

这里解决的是类似 AOP/AOC 的横向扩展诉求。

横向扩展不做隐式 monkey patch，也不让插件任意包 service。

统一使用显式 action pipeline：

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

阶段约束：

1. `before_validate` 可以补参数、拒绝请求，不能写核心表。
2. `before_authorize` 可以补充策略判断，不能绕过宿主权限。
3. `before_execute` 可以阻断动作或准备 extension-owned 上下文，不能直接改核心资源真值。
4. `after_execute` 可以读取动作结果，写 extension-owned sidecar 需要纳入宿主事务策略。
5. `after_commit` 可以发事件、启动 worker、同步外部系统。
6. `on_failed` 只能记录失败、清理扩展上下文或发补偿任务。

### 6.3 HostExtension 扩展现有核心业务

`HostExtension` 可以扩展已有 `Core Resource`，但必须通过声明式 contribution 进入 resource action kernel。

允许：

1. 新增 extension-owned resource。
2. 为已有 resource 新增受控 action。
3. 为已有 action 注册显式 hook。
4. 为已有 action 注册 policy / validator。
5. 注册 extension-owned sidecar table 和 migration。
6. 注册受控 route、worker、callback 和 projection。
7. 在 deployment policy 允许时，显式 override 某个 resource owner 或 action handler。

禁止：

1. 直接改写 Core resource 的真值表。
2. 隐式包裹或替换 service command。
3. 绕过 resource action kernel 调 repository impl。
4. 在 hook 中裸写其他模块表。
5. 把 workspace 用户安装的普通插件提升成 system action contributor。

判断方式：

```text
需要改变核心资源真值：调用 Core action。
需要增加横向策略：注册 action hook / policy。
需要保存扩展状态：写 extension-owned sidecar table。
需要对外暴露专属接口：注册受控 route，并最终调用 resource action。
需要替换系统模块实现：声明 override，并由 deployment policy 显式允许。
```

### 6.4 HostExtension 场景写法

#### 文件安全扩展

```text
file-security-host
  extends resource: files
  hooks:
    after files.upload -> enqueue scan worker
    before files.download -> block when scan_failed
  owns resources:
    file_scan_reports
    file_security_policies
  owns routes:
    GET /api/system/file-security/files/{file_id}/scan-report
```

写法：

1. `files.upload` 仍由文件资源 owner 执行。
2. 插件在 `after_commit` 创建扫描任务。
3. 扫描结果写入 `file_scan_reports`。
4. 下载前通过 `before_execute` 或 `before_authorize` 判断是否阻断。

#### 工作流审批扩展

```text
workflow-approval-host
  extends resource: workflows
  hooks:
    before workflows.start_run -> require approval when policy matched
  owns resources:
    workflow_approval_policies
    workflow_approval_records
  owns routes:
    POST /api/system/workflow-approval/approvals/{approval_id}/approve
```

写法：

1. `workflows.start_run` 是唯一启动入口。
2. 插件只在 action pipeline 中决定是否要求审批。
3. 审批记录写插件自有表。
4. 审批通过后再次调用 `workflows.start_run` 或调用 Core 暴露的 resume action。

#### 插件市场许可证扩展

```text
marketplace-license-host
  extends resource: plugins
  hooks:
    before plugins.install -> check license and trust source
  owns resources:
    marketplace_catalog
    marketplace_license_cache
  owns workers:
    sync_marketplace_catalog
```

写法：

1. `plugin_installations`、`plugin_tasks` 仍由 Core 拥有。
2. 插件市场 catalog 和 license cache 由 HostExtension 拥有。
3. 安装前只做策略校验，不直接写安装状态。
4. 安装动作仍调用 Core `plugins.install`。

#### 数据源治理扩展

```text
data-source-governance-host
  extends resource: data_sources
  hooks:
    before data_sources.create -> enforce allowed connector policy
    after data_sources.import_snapshot -> emit lineage event
  owns resources:
    data_source_policies
    data_lineage_events
  owns callbacks:
    GET /api/callbacks/data-sources/oauth/{provider}
```

写法：

1. 外部源协议仍由 `RuntimeExtension` 实现。
2. secret、preview session、import job 由数据源平台 owner 管理。
3. HostExtension 负责治理策略、callback 和 lineage 投影。
4. RuntimeExtension 不能直接注册 HTTP callback。

#### 企业身份扩展

```text
enterprise-identity-host
  provides or overrides contract: identity
  owns resources:
    identity_provider_links
    sso_login_sessions
  owns routes:
    GET /api/auth/sso/{provider}/start
    GET /api/auth/sso/{provider}/callback
```

写法：

1. 如果只是新增 SSO provider，作为 identity resource 的 extension action。
2. 如果替换完整 identity contract，必须声明 override 并由 deployment policy 允许。
3. session 写入仍走 Core session / identity action，不直接写会话表。

### 6.5 缓存与分布式基础设施扩展

缓存不作为一个泛化插件层级处理，应拆成多个宿主基础设施 contract。Redis 是这些 contract 的一种实现，不是业务 resource owner。

本轮目标按完整架构落地，不保留 `API_EPHEMERAL_BACKEND=redis` 这类 Core 内置 Redis 过渡路径作为目标形态。早期启动依赖的 session、ephemeral kv、lock、queue 和 event provider 必须先通过 `pre-state infra provider bootstrap` 注册，再构造 `ApiState` 和 control-plane service。

单机默认实现也按官方可信 `local-infra-host` 处理；它可以随发行包内置，但仍走同一套 host infrastructure registry，不再把 Redis vocabulary 写进 Core。

建议固定以下 contract：

```text
storage-ephemeral
  -> session、临时 kv、lease、wakeup signal

cache-store
  -> 查询缓存、编译缓存、短期结果缓存

distributed-lock
  -> 分布式锁、任务抢占、幂等保护

event-bus
  -> 跨实例事件广播、缓存失效通知、轻量异步事件

task-queue
  -> 后台任务队列、工作流加速队列、导入同步任务；默认 at-least-once + idempotency key + visibility timeout

rate-limit-store
  -> 限流计数、配额窗口、短期用量统计
```

单机默认实现：

```text
storage-ephemeral = in-memory / local
cache-store = in-memory
distributed-lock = local mutex / postgres lease where needed
event-bus = local channel
task-queue = local worker / postgres lease
rate-limit-store = in-memory
```

分布式实现：

```text
storage-ephemeral = redis
cache-store = redis
distributed-lock = redis
event-bus = redis pubsub / redis streams / nats
task-queue = redis streams / rabbitmq / dedicated queue
rate-limit-store = redis
```

所有权边界：

1. `Core` 定义 session、lease、cache key namespace、invalidation、task claim、event delivery、rate limit window 的语义。
2. `HostExtension` 实现这些基础设施 contract，例如 `local-infra-host`、`redis-infra-host`、`nats-event-bus-host`。
3. `Resource Action Kernel` 决定哪些 action 能缓存、缓存多久、由哪些 domain event 失效。
4. `RuntimeExtension` 不能直连 Redis，只能通过宿主提供的 runtime context 使用受控 cache。
5. `CapabilityPlugin` 不能拥有 Redis 连接，只能声明 workflow node output 是否允许被缓存。
6. 缓存数据不能成为核心业务真值，失效或丢失后必须能从 durable resource 重建。
7. 持久化到数据库的 catalog snapshot / read model 归 durable resource owner，不归 `cache-store`。

事件与队列语义：

1. `task-queue` 默认语义为 at-least-once delivery。
2. 队列任务必须携带 idempotency key、claim owner、visibility timeout、retry policy 和 dead-letter policy。
3. `distributed-lock` 必须支持 lease ttl、renew、release 和 fencing token，不能只表达互斥。
4. domain event 必须先进入 durable outbox，再由 `event-bus` 投递。
5. 纯 runtime live event 可以走 local channel、broadcast 或非持久 event-bus，不承担业务一致性。
6. cache invalidation event 可以异步投递，但丢失后必须能通过 version / updated_at / durable outbox 重建一致性。

Redis HostExtension 示例：

```text
redis-infra-host
  provides contracts:
    storage-ephemeral
    cache-store
    distributed-lock
    event-bus
    task-queue
    rate-limit-store
  activation: boot
  bootstrap_phase: pre_state
  lifecycle: restart_required
  config:
    url_ref: secret://system/redis-infra-host/url
    key_prefix: 1flowbase:{deployment_id}
```

典型使用场景：

```text
files.list
  cache: ttl 30s
  invalidate_on: files.uploaded / files.deleted / file_table.updated

workflows.compile
  cache: until workflows.updated
  backing: cache-store

workflows.run_queue
  queue: task-queue
  lock: distributed-lock

plugin_marketplace.catalog
  cache: ttl 10m
  invalidate_on: marketplace.synced

data_sources.discover_catalog
  durable snapshot key: workspace + data_source + schema fingerprint
  optional cache key: workspace + data_source + schema fingerprint + snapshot version
  adapter: RuntimeExtension
  policy owner: data-source platform
  durable owner: data-source platform repository
  optional acceleration: cache-store HostExtension
```

判断方式：

```text
需要切换缓存、锁、事件总线、队列实现：HostExtension。
需要决定某个业务 action 是否缓存和如何失效：resource/action owner。
需要保存业务真值：durable resource owner，不能放缓存。
需要 RuntimeExtension 使用缓存：通过 runtime context，不直连 Redis。
需要保存 catalog snapshot / read model：control-plane 定义语义，storage-durable/postgres 实现持久化。
```

## 7. 各层定义

### 7.1 Boot Core

`Boot Core` 是最小宿主启动面。

它负责：

1. 启动配置读取。
2. 主存储连接与健康检查。
3. 插件扫描、装配、load plan 和 inventory。
4. `HostExtension` 的 boot-time 加载。
5. `control-plane` 组装。
6. API 与 runtime 服务启动。

它不负责：

1. 拥有完整业务资源定义。
2. 持有所有系统能力实现。
3. 代替 `RuntimeExtension` 或 `CapabilityPlugin` 执行具体能力。

### 7.2 Core Platform

`Core Platform` 是平台最小内核和跨模块一致性的 owner。

它负责：

1. Boot Core schema，以及当前尚未迁出的核心模块 schema。
2. Boot Core migration 链，以及当前核心模块 migrations。
3. Boot Core repository / mapper，以及当前核心模块 repository / mapper。
4. 核心权限、审计、状态机。
5. 插件安装、任务、信任、inventory、registry metadata。
6. 基础设施 contract 语义，例如 session、lease、cache invalidation、task claim、event delivery、rate limit window。
7. resource action 的缓存策略和失效规则。
8. 跨模块必须一致的事务边界。
9. 当前尚未插件化的系统模块实现。

一句话：

```text
只要是 Boot Core 治理、安全、安装、权限、审计、基础设施语义和跨模块一致性，默认都属于 Core。
```

### 7.3 HostExtension

`HostExtension` 是受治理的内核级系统插件。

它负责：

1. host contract 的定义、实现、替换或增强。
2. boot-time 系统 module。
3. runtime slot family 的系统级声明。
4. health / reconcile / bootstrap hook。
5. observability、auth、gateway、secret manager 一类宿主桥接器。
6. 自己命名空间下的系统资源、migration、repository、service。
7. 通过 host route registry 注册的受控 route / callback / worker。
8. `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` 等宿主基础设施 contract 的实现。

它不负责：

1. Boot Core 自身的启动、安装、权限、审计和安全策略。
2. `plugin_installations`、`plugin_tasks` 等核心插件生命周期表。
3. 直接修改其他模块拥有的表或状态。
4. 绕过 `control-plane`、权限、审计和 route registry。
5. 裸开任意 HTTP route。
6. workspace 用户可安装的普通能力。
7. 改变 Core 定义的缓存语义、失效规则、任务 claim 语义或事件投递语义。
8. 把缓存数据作为核心业务真值。

一句话：

```text
HostExtension 可以拥有内核级系统模块，但必须通过宿主治理边界扩展。
```

### 7.4 HostExtension 资源所有权

`HostExtension` 可以拥有系统资源，但资源必须归属到插件命名空间。

允许：

1. `extension_id` 命名空间下的系统表。
2. 插件自有 migration。
3. 插件自有 service 和 repository。
4. 通过宿主 route registry 注册的系统 API。
5. 通过宿主 worker registry 注册的后台任务。
6. 插件自有缓存 key namespace、队列消费者和事件订阅。

禁止：

1. 直接改写 Boot Core 的核心表。
2. 直接抢占其他 `HostExtension` 的资源命名空间。
3. 绕过宿主权限、审计、CSRF、OpenAPI 和健康检查。
4. 在运行中热替换 Rust native 代码。
5. 让 RuntimeExtension 或 CapabilityPlugin 直接持有 Redis、NATS、RabbitMQ 等基础设施连接。

判断方式：

```text
如果它是一个可随部署启用或替换的系统模块，并且资源可以清晰归属到 extension namespace，可以做 HostExtension。
如果它是 Boot Core 自身维持系统可治理所必需的元数据，必须留在 Core。
```

### 7.5 RuntimeExtension

`RuntimeExtension` 是已注册 runtime slot 的具体实现。

典型 slot：

1. `model_provider`
2. `embedding_provider`
3. `reranker_provider`
4. `data_source`
5. `data_import_snapshot`
6. `file_processor`
7. `record_validator`
8. `field_computed_value`

它负责：

1. 外部协议翻译。
2. 运行时调用逻辑。
3. slot contract 的输入输出实现。

它不负责：

1. 注册系统接口。
2. 直接写平台主数据库。
3. 拥有平台 secret / preview session / import job / catalog snapshot / read model 主状态。
4. 直接连接 Redis、NATS、RabbitMQ 等宿主基础设施。

### 7.6 CapabilityPlugin

`CapabilityPlugin` 是用户显式选择的一项应用能力。

它负责：

1. workflow node
2. tool
3. trigger
4. publisher
5. 未来其他 app-level contributed capability

它不负责：

1. 系统级 bridge
2. 平台主资源
3. runtime slot family 声明
4. 宿主基础设施连接或缓存实现

## 8. 插件源码目录

插件源码工作区统一收敛为：

```text
api/plugins/
  host-extensions/
    <plugin_id>/

  runtime-extensions/
    <plugin_id>/

  capability-plugins/
    <plugin_id>/

  templates/
    host-extension/
    runtime-extension/
    capability-plugin/

  sets/
    minimal.yaml
    default.yaml

  packages/
  installed/
  fixtures/
```

关键规则：

1. 不按“官方插件 / 非官方插件”拆源码目录。
2. CLI 创建插件默认生成到对应工作区。
3. `packages/` 只放 `.1flowbasepkg` 产物。
4. `installed/` 只放安装结果。
5. `api/crates/*` 和 `api/apps/api-server/src/*` 不放插件实现源码。

## 9. 生命周期

### 9.1 HostExtension

`HostExtension` 生命周期固定为：

```text
source workspace
-> package
-> install
-> desired_state = pending_restart
-> api-server reboot
-> boot-time validate + load
-> active / load_failed
```

启停语义：

1. `enable`：写启用请求，返回 `restart_required`
2. `disable`：写停用请求，返回 `restart_required`
3. `upgrade`：安装新包，返回 `restart_required`
4. 当前进程不热卸载
5. 重启后才真正切换

运行约束：

1. 随主进程内加载。
2. 不走 `plugin-runner`。
3. 本阶段先做 native in-process HostExtension，只面向可信官方插件和部署级插件。
4. 不做 Rust `so/dll` 热卸载，启停和升级通过 desired state + 重启生效。
5. 第三方可重复加载 / 卸载运行时后续再评估声明式、Lua 或 WASM，本阶段不维护多套 HostExtension runtime。

### 9.2 RuntimeExtension

`RuntimeExtension` 生命周期固定为：

```text
source workspace
-> package
-> install
-> desired_state = disabled
-> assignment / binding
-> ensure_loaded
-> invoke
-> reload / disable
```

启停语义：

1. 安装后默认不自动成为系统能力
2. 由 `workspace` 或 `model` 绑定驱动可用性
3. 运行时可按需 `load / reload`
4. 不要求重启 `api-server`

### 9.3 CapabilityPlugin

目标生命周期固定为：

```text
source workspace
-> package
-> install
-> registry sync
-> workspace enable
-> editor visible
-> compile / execute
-> disable
```

启停语义：

1. 影响新建或新执行能力可见性
2. 不要求重启宿主
3. 被禁用后，引用它的 flow 应直接进入缺失或不可用状态

说明：

当前代码里 `CapabilityPlugin` 安装链路尚未完全打通，但目标生命周期按上述模型设计。

## 10. 打包与发行

打包必须区分 `编译` 与 `发行组装`。

### 10.1 编译

`cargo build` 只编译：

1. `api-server`
2. `plugin-runner`
3. `crates/*`

它不把插件源码静态编译进主二进制。

### 10.2 插件打包

插件源码单独执行 `plugin package`：

1. `host-extensions/*`
2. `runtime-extensions/*`
3. `capability-plugins/*`

输出到：

1. `api/plugins/packages/`

### 10.3 发行组装

发行包通过 `api/plugins/sets/*.yaml` 选择需要附带的插件包。

规则：

1. 可以带默认插件包
2. 不应默认把所有插件包都打进发行包
3. 即使随发行包附带，插件仍然是独立 package，不是静态链接进主程序

## 11. 现有能力归属

### 11.1 文件管理

文件管理平台当前实现属于 `Core`；目标架构中可以作为官方 `HostExtension` 系统模块迁出。

包括：

1. `file_storages`
2. `file_tables`
3. 上传编排
4. 文件记录
5. 绑定关系

如果作为 `HostExtension` 迁出，它可以拥有文件管理命名空间下的系统表、service、route 和 worker；Boot Core 仍只保留插件治理、权限、审计和主存储连接。

### 11.2 主存储

平台主存储治理属于 `Core`。

包括：

1. `storage-durable`
2. `storage-postgres`
3. migration
4. repository

`HostExtension` 可以注册 storage implementation，也可以拥有自己命名空间下的系统表；但不能拥有 Boot Core 的全局 migration 链、主存储连接、核心插件生命周期表和跨模块一致性边界。

### 11.3 临时缓存与分布式基础设施

临时缓存和分布式基础设施的语义属于 `Core`，具体实现可以由 `HostExtension` 平替。

Core 负责定义：

1. session
2. ephemeral kv
3. lease
4. wakeup signal
5. cache key namespace
6. cache invalidation
7. distributed lock semantics
8. event delivery semantics
9. task queue claim semantics
10. rate limit window semantics

默认单机实现可以是 in-memory / local / PostgreSQL lease，但按官方可信 `local-infra-host` 注册到 host infrastructure registry。分布式实现由 `redis-infra-host`、`nats-event-bus-host`、`rabbitmq-task-queue-host` 这类可信官方或部署级 HostExtension 提供。

它是宿主基础设施，不是业务插件能力；缓存数据不能成为核心业务真值。domain event 必须先进入 durable outbox，业务一致性不能依赖非持久 event-bus。

### 11.4 数据源

数据源拆成三层：

1. 数据源平台当前实现：`Core`
2. 数据源平台目标形态：可迁为官方 `HostExtension` 系统模块
3. 具体外部源适配器：`RuntimeExtension`

平台侧或 HostExtension 系统模块侧包括：

1. instance
2. secret
3. preview session
4. catalog snapshot / read model
5. import job

`catalog snapshot / read model` 如果持久化到数据库，应由 control-plane 定义语义，并由 `storage-durable/postgres` 的 repository / mapper 实现。`cache-store` 只能作为读取加速层，不能拥有 catalog 主状态。

插件侧只实现：

1. 连接校验
2. catalog 发现
3. preview read
4. import snapshot

### 11.5 工作流

工作流平台当前实现属于 `Core`；目标架构中，工作流平台本体可以作为官方 `HostExtension` 系统模块，但单个用户可选节点仍属于 `CapabilityPlugin`。

包括：

1. graph / definition
2. compiler
3. execution engine
4. run persistence
5. debug runtime

工作流 engine、run persistence、debug runtime 如果迁出，应作为工作流 HostExtension 的 extension-owned resource；workflow 中用户可选择的节点、工具、触发器属于 `CapabilityPlugin`。

### 11.6 插件市场与安装元数据

插件安装状态、任务、信任策略、loader inventory 属于 `Core`。

插件市场 catalog、registry source、推荐位、分类、缓存和同步任务可以作为官方 `HostExtension` 系统模块；但它必须通过 Core 提供的安装、信任、审计和任务边界工作。

## 12. HostExtension 可扩展内容示例

### 12.1 适合 HostExtension 的例子

1. 把 `storage-object` 接到公司内部对象存储桥接器。
2. 把认证接到企业 SSO / LDAP。
3. 把 observability 接到公司内部 metrics / tracing 平台。
4. 在 boot-time 增加宿主健康校验或 reconcile worker。
5. 声明宿主开放 `data_source`、`file_processor`、`model_provider` 这些 runtime slot family。
6. 实现插件市场系统模块，拥有 marketplace catalog/cache/source 表和 route，但复用 Core 安装与信任边界。
7. 实现文件管理系统模块，拥有 file management namespace 下的表、service 和 route。
8. 为已有 Core resource 注册 action hook，例如 `before plugins.install`、`after files.upload`。
9. 为已有 Core resource 增加受控专属 action，例如 `files.scan_report`、`workflows.approve_run`。
10. 实现 Redis-backed `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue` 或 `rate-limit-store`。

### 12.2 不适合 HostExtension 的例子

1. 直接修改 `plugin_installations`、`plugin_tasks` 等 Core 生命周期表。
2. 绕过 Core 安装、信任、审计、权限和任务系统。
3. 直接改写其他 HostExtension 拥有的表。
4. 裸开不经过 host route registry 的 HTTP route。
5. 隐式 monkey patch、包裹或替换 Core service command。
6. 绕过 resource action kernel 直接调用 repository impl。
7. 给 workspace 用户安装可注册系统接口的插件。
8. 让 RuntimeExtension 或 CapabilityPlugin 直接持有 Redis 连接。
9. 把缓存作为业务真值或绕过 durable resource。

## 13. 新需求落点判断表

| 需求类型 | 落点 | 判断标准 | 例子 |
| --- | --- | --- | --- |
| Core 内核资源 | `Core` | 维持系统可启动、可治理、可审计、可安装、可授权的全局元数据和跨模块一致性 | 插件安装状态、任务、信任策略、权限、审计、主存储连接 |
| Host 系统模块 | `HostExtension` | `root/system` 级，boot-time 生效，可拥有 extension namespace 下的表、migration、service、route、worker | 插件市场、文件管理模块、SSO bridge、observability bridge |
| Core resource action | `Core` | 维持 resource catalog、action registry、hook pipeline、权限、审计、事务和 domain event | `plugins.install`、`files.upload`、`workflows.start_run` |
| Host 横向扩展 | `HostExtension` | 对已有 resource/action 注册 hook、policy、validator、sidecar、projection 或受控 action | 文件扫描、工作流审批、插件许可证校验 |
| 宿主基础设施实现 | `HostExtension` | 实现 Core 定义的 `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` contract | `redis-infra-host`、`nats-event-bus-host`、`rabbitmq-task-queue-host` |
| 外部协议适配器 | `RuntimeExtension` | 是已注册 runtime slot 的具体实现，供 workspace / model 绑定 | OpenAI provider、MySQL 数据源、文件处理器 |
| 用户显式选择能力 | `CapabilityPlugin` | 是 workflow / app / canvas 中可选择的一项能力 | workflow node、tool、trigger、publisher |

快速判断规则：

1. 需要修改 Boot Core 治理、权限、审计、安装状态：`Core`
2. 需要新增可独立启停的 root/system 系统模块：`HostExtension`
3. 需要扩展已有核心业务动作：`HostExtension` 通过 resource action hook/policy/sidecar 扩展
4. 需要切换缓存、分布式锁、事件总线、任务队列实现：`HostExtension`
5. 需要实现某个 runtime slot：`RuntimeExtension`
6. 需要新增 workflow / app 中的可选能力块：`CapabilityPlugin`

## 14. 对现有 spec 的收敛

本设计收敛并修正 [2026-04-28-host-extension-boundary-design.md](./2026-04-28-host-extension-boundary-design.md) 中以下不够精确的定义：

1. `HostExtension` 可以作为系统模块 owner，但必须拥有清晰 extension namespace。
2. `HostExtension` 可以拥有自有 migration 和系统表，但不能改写 Boot Core 与其他模块资源。
3. `HostExtension` 可以注册受控系统 API / route，但必须经过 host route registry、权限、审计和 OpenAPI 治理。
4. `HostExtension` 不只是 bridge，也可以是可启停的内核级系统模块实现。
5. 主仓插件源码目录不按官方和第三方拆分，而按插件层级拆分。
6. `HostExtension` 扩展现有核心业务必须走 `Resource / Action / Hook`，不能直接改写 Core resource 真值表。
7. Redis、NATS、RabbitMQ 等基础设施只作为 HostExtension 实现 Core contract，不能成为业务 owner 或插件直连资源。

## 15. 迁移建议

建议按以下顺序推进：

1. 更新 `api/AGENTS.md`，把四层落点、Resource Action Kernel、HostExtension、pre-state infra bootstrap 和基础设施 contract 约束写死。
2. 在 `api-server` 启动链路补 `pre-state infra provider bootstrap` 和 host infrastructure registry，先让 session、cache、lock、queue、event provider 能在 `ApiState` 构造前注册。
3. 在 `plugin-framework` 扩展 HostExtension manifest，加入 native trusted entrypoint、bootstrap phase、owned resources、extends resources、contributed actions、hooks、routes、workers、migrations、infrastructure providers。
4. 在 `control-plane` 补 resource catalog、action registry、action pipeline、hook registry、domain event outbox 和 cache policy registry。
5. 定义 `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` contract，并通过官方可信 `local-infra-host` 提供 local 默认实现。
6. 定义 `task-queue` at-least-once、idempotency key、visibility timeout、retry、dead-letter；定义 `distributed-lock` lease/fencing token；定义 domain event durable outbox。
7. 预留并实现可信官方或部署级 `redis-infra-host`、`nats-event-bus-host`、`rabbitmq-task-queue-host` 作为这些 contract 的分布式实现。
8. 在 `api-server` 引入 host route registry 与 resource/action route mount 约束，保持 route 只做协议层。
9. 在 `api/plugins/` 下建立三类插件源码工作区和模板目录。
10. 把现有 `api-server` 中的 builtin host manifest 迁到 `api/plugins/host-extensions/*` 源码工作区。
11. 保留 `api-server` 只做 loader、policy、inventory、infra bootstrap、route mount 和 boot assembly。
12. 后续再逐步补第三方可重复加载 / 卸载 runtime 和 `CapabilityPlugin` install chain。

## 16. 自检

本文已检查：

1. 已区分 Boot Core 全局治理资源和 HostExtension 命名空间资源。
2. 已允许 HostExtension 拥有受治理的系统模块实现、migration、service 和 route。
3. 已明确 Resource 不等于数据库表，Action 是稳定动作入口。
4. 已把 HostExtension 横向扩展限定到显式 hook、policy、sidecar、受控 action 和 domain event。
5. 已区分缓存策略 owner 和缓存实现 owner，Redis 只作为 HostExtension 实现。
6. 已明确早期基础设施 provider 必须在 `ApiState` 构造前通过 pre-state bootstrap 注册。
7. 已明确 `task-queue` at-least-once、idempotency key、visibility timeout 与 durable outbox 边界。
8. 已明确持久化 catalog snapshot / read model 归 durable resource owner，不归 `cache-store`。
9. 已明确 RuntimeExtension 与 CapabilityPlugin 不能直接持有 Redis 等基础设施连接。
10. 没有把 `RuntimeExtension` 和 `CapabilityPlugin` 混成同一类插件。
11. 没有要求把插件源码移出主仓。
12. 没有把 Rust native `so/dll` 热卸载作为 `HostExtension` 目标方案；native HostExtension 第一阶段只面向可信官方插件和部署级插件。
