# HostExtension 内核级插件边界设计

日期：2026-04-28
状态：待用户审阅

关联文档：
- [1flowbase 插件架构与节点贡献设计稿](./1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md)
- [主存储与外部数据源平台设计](./2026-04-23-storage-durable-and-external-data-source-platform-design.md)
- [文件管理与对象存储分层设计](./2026-04-23-file-manager-storage-design.md)

## 1. 文档目标

本文用于收口 `HostExtension` 的新边界：它不再只是普通插件体系里较高权限的一类扩展，而是面向官方发行版和自托管部署开发者的 host 内核级插件。

本设计重点明确：

1. `Boot Core / HostExtension / RuntimeExtension / CapabilityPlugin` 的层级关系
2. `HostExtension` 可以定义、替换、增强哪些 host contract
3. `RuntimeExtension` 和 `CapabilityPlugin` 为什么不能获得 host 级能力
4. `storage-durable`、`storage-ephemeral`、文件管理、数据源、模型供应商如何归入 host 扩展模型
5. 参考 `NocoBase` “一切皆插件”理念时，哪些思想适合迁移，哪些实现不能照搬

## 2. 背景

当前插件体系已经有三类消费语义：

1. `host_extension`
2. `runtime_extension`
3. `capability_plugin`

早期设计把 `HostExtension` 定义为宿主级高权限扩展，并强调它通过 registry 扩展系统能力，不重写 core contract。经过本轮讨论，该边界需要上调。

用户明确提出新的目标：

1. `HostExtension` 应接近 `Linux` 内核模块或 `NocoBase` 应用插件的定位
2. 官方 host 本身可以由一组内置 `HostExtension` 组成
3. 自托管部署开发者可以基于源码开放自己的 host，扩展插槽或扩展接口
4. 这个能力要给开发者预留空间，但不能让普通 runtime 插件破坏系统 core
5. `storage-durable` 和 `storage-ephemeral` 名称不应改成 cache，它们从一开始就是持久层和易失层
6. 不再新增 `Driver` 作为单独层级，避免混淆职责

因此需要把 `Core` 重新拆成：

1. 最小启动内核：`Boot Core`
2. 系统能力模块：`HostExtension`

## 3. NocoBase 参考结论

本地 `../nocobase` 的核心思想可以概括为：

1. `Application` 持有系统 registry 和基础服务
2. 插件拿到 `app` 后可以注册资源、数据库集合、权限、路由、前端组件、设置项和数据源类型
3. 插件有完整生命周期：`afterAdd / beforeLoad / load / install / upgrade / beforeEnable / afterEnable / beforeDisable / afterDisable`
4. 插件加载采用阶段化流程：先全部 `beforeLoad`，再逐个 `loadCollections + load`
5. 许多系统能力本身也是插件，例如 auth、acl、file-manager、workflow、data-source-main

这些思想适合迁移到 `1flowbase`：

1. 应用宿主暴露一组明确 registry
2. 系统能力可以由插件化 host module 组成
3. 插件生命周期必须阶段化
4. 数据源、文件管理、认证、审计、工作流等能力可以作为官方内置 host 插件
5. 插件应声明依赖和加载顺序

但不能照搬的部分是：

1. 不把所有插件都放进同一个信任等级
2. 不让普通 `RuntimeExtension` 或 `CapabilityPlugin` 直接获得 `HostContext`
3. 不让 workspace 用户安装可注册系统接口的插件
4. 不把第三方代码默认放进主进程热加载/热卸载路径

`1flowbase` 可以吸收 `NocoBase` “一切皆插件”的 host 组织方式，但必须保留多层信任模型。

## 4. 总体模型

最终层级固定为：

```text
Boot Core
└─ HostExtension
   ├─ define or override host contracts
   ├─ register runtime slots
   ├─ register system APIs / callbacks
   ├─ register storage-durable implementation
   ├─ register storage-ephemeral implementation
   ├─ register storage-object implementation
   ├─ register auth / audit / billing / license integration
   └─ register system workers

RuntimeExtension
└─ implement registered runtime slots
   ├─ model_provider
   ├─ data_source
   ├─ file_processor
   └─ other runtime slots

CapabilityPlugin
└─ contribute user-facing selectable capabilities
   ├─ canvas_node
   ├─ tool
   ├─ trigger
   └─ publisher
```

关键关系不是实例父子关系：

```text
HostExtension owns RuntimeExtension owns CapabilityPlugin
```

而是契约关系：

```text
HostExtension defines host capability or runtime slot
RuntimeExtension implements registered runtime slot
CapabilityPlugin consumes registered capability or contributes user workflow ability
```

## 5. Boot Core 定义

`Boot Core` 是最小启动内核，不再承诺承载完整业务 core。

它只负责：

1. host 启动
2. extension loader
3. deployment policy
4. root/system bootstrap
5. plugin lifecycle metadata
6. extension dependency resolution
7. extension load order
8. health / reconcile framework
9. minimal audit bootstrap
10. safe mode / unhealthy 状态

它不直接承诺：

1. 所有业务 contract 不可改
2. 官方系统能力必须写死在 core
3. model provider、data source、file management、storage implementation 必须由 core 内建

换句话说：

```text
Boot Core keeps the host bootable and governable.
HostExtension builds the actual host capability surface.
```

## 6. HostExtension 定义

`HostExtension` 是部署者信任的 host 内核级模块。

正式定义：

```text
HostExtension = system/root 级可信宿主扩展包。
它可以定义、替换、增强 host contract，
可以注册系统接口、runtime slot、存储实现、后台服务和迁移，
并在启动期参与组成最终 host。
```

它的信任边界是：

1. 不是多租户安全边界内的普通插件
2. 不是 workspace 用户可安装能力
3. 拥有系统级权限
4. 安全责任属于部署者或官方发行版
5. 只适合官方内置、源码发行版定制、自托管 root 管理

## 7. HostExtension 可扩展面

`HostExtension` 可以注册或覆盖以下能力面。

### 7.1 Host Contract

用于定义或替换系统级 contract，例如：

1. `identity`
2. `workspace`
3. `plugin_management`
4. `runtime_orchestration`
5. `storage-durable`
6. `storage-ephemeral`
7. `storage-object`
8. `file_management`
9. `audit`
10. `observability`

覆盖行为必须显式声明，不允许隐式抢占。

### 7.2 Runtime Slot

用于注册 runtime extension 可实现的插槽，例如：

1. `model_provider`
2. `embedding_provider`
3. `reranker_provider`
4. `data_source`
5. `file_processor`
6. `record_validator`
7. `field_computed_value`

### 7.3 Controlled Interface

用于注册受控系统接口，例如：

1. control-plane route
2. public callback
3. webhook endpoint
4. OpenAPI section
5. internal service endpoint

接口注册必须经过 host route registry，不能由插件直接裸开任意 HTTP route。

### 7.4 Storage Implementation

用于注册基础设施实现：

1. `storage-durable` implementation
2. `storage-ephemeral` implementation
3. `storage-object` implementation

这里不新增 `Driver` 层级。命名固定使用：

1. `storage-durable implementation`
2. `storage-ephemeral implementation`
3. `storage-object implementation`

### 7.5 System Worker

用于注册系统后台任务：

1. reconcile worker
2. scheduler
3. import/sync worker
4. cleanup worker
5. billing or quota worker
6. observability projection worker

### 7.6 Migration

用于注册启动期或安装期迁移：

1. host contract migration
2. system table migration
3. plugin metadata migration
4. extension-owned system schema migration

迁移必须归属明确 namespace，并纳入启动 health / reconcile。

## 8. RuntimeExtension 定义

`RuntimeExtension` 是实现某个已注册 runtime slot 的插件。

正式定义：

```text
RuntimeExtension = 实现 host 已注册 runtime slot 的运行时扩展。
它不注册系统接口，不获得 HostContext，不改写 host contract。
```

典型例子：

1. `openai_compatible` implements `model_provider`
2. `postgres_source` implements `data_source`
3. `s3_file_processor` implements `file_processor`
4. `custom_embedding_provider` implements `embedding_provider`

固定边界：

1. 只能实现已存在 slot contract
2. 不能注册 HTTP route
3. 不能注册 resource
4. 不能注册 auth provider
5. 不能直接访问平台主存储
6. 不能管理 `tenant / workspace / session / permission` 真值
7. 默认进程外执行

## 9. CapabilityPlugin 定义

`CapabilityPlugin` 是面向 workspace 用户的可选业务能力贡献。

正式定义：

```text
CapabilityPlugin = 在工作流、画布、工具、触发器、发布器等场景中由用户显式选择的能力贡献。
```

典型例子：

1. canvas node
2. tool/action
3. trigger
4. publisher
5. workflow utility

固定边界：

1. 不能注册系统接口
2. 不能注册 host contract
3. 不能注册 runtime slot
4. 可以依赖 runtime slot 或某个 runtime extension
5. 可以贡献 schema、配置、执行逻辑
6. 用户在 workspace 内显式选择后生效

## 10. 官方 HostExtension 组成

官方发行版可以看作：

```text
1flowbase = Boot Core + Official HostExtensions
```

建议第一阶段官方内置 HostExtension：

### 10.1 identity-host

提供：

1. user contract
2. session contract
3. auth provider extension point
4. root/system bootstrap

### 10.2 workspace-host

提供：

1. tenant contract
2. workspace contract
3. member / role / permission contract

### 10.3 plugin-host

提供：

1. plugin lifecycle
2. package install
3. signature / source policy
4. assignment
5. extension inventory
6. reconcile

### 10.4 model-runtime-host

提供 runtime slots：

1. `model_provider`
2. `embedding_provider`
3. `reranker_provider`

### 10.5 data-access-host

提供 runtime slots：

1. `data_source`
2. `data_import_snapshot`

提供 system contract：

1. external data source instance
2. preview session
3. catalog / schema cache
4. import job

### 10.6 file-management-host

提供：

1. file table contract
2. file record contract
3. storage-object binding
4. upload / download orchestration
5. `file_processor` runtime slot

### 10.7 storage-host

提供：

1. `storage-durable` contract
2. `storage-ephemeral` contract
3. `storage-object` contract

官方默认支持矩阵：

1. `storage-durable`: PostgreSQL
2. `storage-ephemeral`: memory/local initial implementation
3. `storage-object`: local and rustFS

主仓官方仍只承诺维护 PostgreSQL durable backend。其他 durable implementation 可由自托管 HostExtension 提供，但不进入官方支持矩阵。

### 10.8 runtime-orchestration-host

提供：

1. flow compile contract
2. execution contract
3. runtime event contract
4. debug run contract
5. capability invocation contract

### 10.9 observability-host

提供：

1. logs
2. trace
3. runtime observability projection
4. health dashboard data contract

## 11. storage-durable 与 storage-ephemeral

名称固定保留：

1. `storage-durable`
2. `storage-ephemeral`

不改成 cache。

### 11.1 storage-durable

`storage-durable` 是平台长期状态层 contract。

它承载：

1. 用户、租户、workspace
2. 权限、角色、审计
3. 应用、流程、运行记录
4. 插件安装、扩展状态、assignment
5. 文件记录和数据源元数据

官方默认实现：

1. PostgreSQL

自托管 HostExtension 可以提供其他 implementation，但部署者自行承担兼容性、迁移和维护责任。

### 11.2 storage-ephemeral

`storage-ephemeral` 是易失层 contract。

它可承载：

1. 短期 session 辅助状态
2. lease
3. distributed coordination
4. rate limit window
5. runtime 临时状态
6. projection cache
7. provider catalog cache
8. data source schema discovery cache

它不能承载唯一真值：

1. 权限真值
2. 插件安装真值
3. 文件记录真值
4. billing / usage ledger 真值
5. workflow 状态机真值

## 12. 文件管理归属

文件管理应归入 `file-management-host`，不是普通 workspace 插件。

它负责：

1. 文件表定义
2. 文件记录模板
3. 文件上传编排
4. 文件下载权限
5. 文件表与 `storage-object` implementation 的绑定
6. 文件审计
7. file processor slot

`storage-object` implementation 由 host 级注册，例如：

1. local
2. rustFS
3. S3
4. MinIO
5. private OSS

配置权固定在 `root/system`。workspace 只能创建、引用、上传和消费自己有权限的文件表，不能安装或切换系统对象存储实现。

## 13. 数据源归属

数据源归入 `data-access-host`。

`data-access-host` 提供：

1. `data_source` runtime slot
2. 数据源实例控制面
3. secret 管理
4. catalog/schema cache
5. preview session
6. import/sync job

外部源接入实现由 `RuntimeExtension` 提供：

1. PostgreSQL source
2. MySQL source
3. SaaS source
4. HTTP API source

数据源 runtime extension 不能注册 HTTP 接口，不能直接写平台数据库，不能自管 OAuth callback。需要 callback 时，由 `data-access-host` 或其他 HostExtension 注册受控 callback，再把结果交给 runtime extension 使用。

## 14. HostExtension Manifest v1 草案

建议新增 host extension manifest 概念，最小字段如下：

```yaml
manifest_version: 1
extension_id: official.storage-host
version: 0.1.0
display_name: Storage Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot

provides_contracts:
  - storage-durable
  - storage-ephemeral
  - storage-object

overrides_contracts: []

registers_slots:
  - code: data_source
    contract_version: 1flowbase.data_source/v1

registers_interfaces:
  - code: storage.health
    kind: internal_service

registers_storage:
  - kind: storage-durable
    implementation: postgres
  - kind: storage-object
    implementation: local

dependencies:
  - extension_id: official.identity-host
    version_range: ">=0.1.0"

load_order:
  after:
    - official.identity-host
  before:
    - official.runtime-orchestration-host
```

字段语义：

1. `provides_contracts`: 本 extension 提供的新 host contract
2. `overrides_contracts`: 本 extension 显式覆盖的 host contract
3. `registers_slots`: 本 extension 注册的 runtime slot
4. `registers_interfaces`: 本 extension 注册的系统接口
5. `registers_storage`: 本 extension 注册的存储实现
6. `dependencies`: 依赖的 host extension
7. `load_order`: 确定性加载顺序

## 15. 生命周期

HostExtension 生命周期建议为：

```text
discover
resolve_dependencies
validate_policy
load_manifest
before_boot
register_contracts
run_migrations
load
healthcheck
active
```

禁用或替换 HostExtension 不是普通运行时动作：

1. 必须由 deployment manifest 或 root/system 明确操作
2. 必须重启生效
3. 失败进入 unhealthy 或 safe mode
4. 不支持普通热卸载

## 16. Deployment Policy

HostExtension 的准入由 deployment policy 管理。

策略至少包括：

1. allowed source
2. required signature
3. allowed override contract
4. allowed storage implementation
5. allowed interface kind
6. boot failure policy

示例：

```yaml
host_extensions:
  sources:
    - builtin
    - filesystem_dropin
  require_signature_for:
    - uploaded
  allow_uploaded_host_extension: false
  allow_contract_override:
    - storage-ephemeral
    - storage-object
  deny_contract_override:
    - identity
    - workspace
  boot_failure_policy: unhealthy
```

注意：这里的 policy 不是为了限制 HostExtension 永远不能改 core，而是为了让部署者显式声明哪些系统级覆盖在当前部署中被允许。

## 17. 安全边界

HostExtension 是 trusted code，因此安全边界不同于普通插件。

固定规则：

1. install scope = system/root
2. activation phase = boot
3. workspace 用户不能安装、启用、禁用 HostExtension
4. HostExtension 可以影响 host contract，但必须在 manifest 中显式声明
5. 覆盖冲突必须由 load order 和 override policy 确定性解决
6. 所有 HostExtension 必须进入 extension inventory
7. 所有系统接口注册必须进入 route/interface registry
8. 启动失败必须进入 health / safe mode / unhealthy 状态

普通插件边界保持不变：

1. `RuntimeExtension` 只实现 slot
2. `CapabilityPlugin` 只贡献用户可选能力
3. 二者都不能注册系统接口
4. 二者都不能获得 HostContext

## 18. 对当前代码的影响

当前代码已有一些正确方向：

1. `plugin-framework` 已经有 `consumption_kind` 和 `execution_mode`
2. `plugin-runner` 已经分出 provider、data source、capability host
3. 插件状态已经拆成 `desired_state + artifact_status + runtime_status -> availability_status`
4. `storage-durable`、`storage-ephemeral`、`storage-object` 已经具备独立边界雏形

需要后续调整的方向：

1. 把 `provider` 从插件主类型降级为 `model_provider` runtime slot
2. 把插件安装链路从 provider-centric 改为 slot-aware / host-extension-aware
3. 新增 HostExtension manifest 与 inventory
4. 新增 HostContext / registry 组合边界
5. 区分 HostExtension 的 boot-time lifecycle 与 RuntimeExtension 的 runtime lifecycle
6. 文件管理、数据源、模型供应商、存储实现都通过官方 HostExtension 注册能力面

## 19. 非目标

本设计不做以下内容：

1. 不要求马上把现有所有系统模块物理拆成 HostExtension 包
2. 不实现第三方 HostExtension 市场
3. 不允许 workspace 用户安装 HostExtension
4. 不设计热卸载
5. 不把 Rust 动态库热加载作为主线
6. 不承诺官方维护多个 durable backend
7. 不新增 `Driver` 作为单独插件层级

## 20. 阶段建议

### Phase 1：命名与文档收口

1. 固定 `Boot Core / HostExtension / RuntimeExtension / CapabilityPlugin`
2. 固定 `storage-durable / storage-ephemeral / storage-object`
3. 更新插件架构文档和 AGENTS 关键规则
4. 明确 `model_provider`、`data_source` 是 runtime slot，不是插件主类型

### Phase 2：HostExtension registry

1. 引入 HostExtension manifest
2. 引入 extension inventory
3. 引入 HostContext
4. 引入 contract / slot / interface / storage registry
5. 启动期加载官方内置 HostExtension

### Phase 3：控制面改造

1. 插件安装从 provider-centric 改成 slot-aware
2. 分离 HostExtension boot lifecycle 与 RuntimeExtension enable lifecycle
3. 文件管理、数据源、模型供应商逐步迁入官方 HostExtension 能力面

### Phase 4：自托管扩展开放

1. 支持 filesystem drop-in HostExtension
2. 支持 deployment policy 控制 override
3. 支持自定义 storage implementation
4. 支持自定义 host route / callback
5. 提供自托管开发模板

## 21. 核心结论

最终口径固定为：

```text
Boot Core 负责可启动、可加载、可治理。
HostExtension 负责定义、替换、增强 host 能力面。
RuntimeExtension 负责实现 host 已注册 runtime slot。
CapabilityPlugin 负责贡献 workspace 用户可选业务能力。
```

官方发行版不再被理解为一个巨大 core，而是：

```text
1flowbase official host = Boot Core + official HostExtensions
```

自托管开发者可以通过 HostExtension 深度定制 host，但普通 runtime 插件仍然保持受限边界。这是吸收 `NocoBase` “一切皆插件”理念后，适合 `1flowbase` 的分层模型。
