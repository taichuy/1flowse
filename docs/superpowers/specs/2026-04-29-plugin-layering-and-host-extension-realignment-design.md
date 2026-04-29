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
6. 新增需求时如何快速判断应该写到哪一层。

## 2. 结论摘要

本轮最终结论如下：

1. 插件是否成立，判断标准是是否走独立 `package / install / enable-disable / load` 生命周期，而不是源码是否位于主仓。
2. 主仓可以预留统一插件源码工作区，CLI 创建插件可以直接生成到主仓。
3. `HostExtension` 是宿主级系统能力扩展，只负责 host contract、boot-time bridge、slot family、health/reconcile 和系统级 adapter。
4. `HostExtension` 不是业务资源 owner，不负责平台主数据库表、核心 repository、核心 service、核心 route。
5. `RuntimeExtension` 是某个 runtime slot 的具体实现，例如 `model_provider`、`data_source`、`file_processor`。
6. `CapabilityPlugin` 是用户在 workflow / app / canvas 中显式选择的一项能力，例如 node、tool、trigger、publisher。
7. 文件管理、主存储、临时缓存、数据源平台、工作流平台仍然属于 `Core`；只有它们的外部协议适配器或用户可贡献能力才插件化。
8. `HostExtension` 随主进程内加载，启用、停用、升级通过 `desired_state` 管理，并在重启后生效。
9. 禁止为 `HostExtension` 设计 Rust `so/dll` 可重复热加载 / 热卸载；需要可重复卸载的运行时优先考虑声明式、Lua 或 WASM。

## 3. 范围与非目标

### 3.1 范围

本设计覆盖：

1. 后端插件源码目录约定。
2. 三层插件与核心代码的边界。
3. 三层插件的生命周期与打包语义。
4. 现有核心能力的归属判断。
5. 后续新增需求的落点判断规则。

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

## 5. 各层定义

### 5.1 Boot Core

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

### 5.2 Core Platform

`Core Platform` 是平台自己的资源与状态 owner。

它负责：

1. 平台主数据库 schema。
2. migration。
3. repository / mapper。
4. 业务 service、权限、审计、状态机。
5. 工作流编译与执行平台。
6. 文件管理平台。
7. 数据源平台。
8. 插件安装、任务、信任、inventory、registry metadata。

一句话：

```text
只要是平台自己的资源、事务和状态一致性，默认都属于 Core。
```

### 5.3 HostExtension

`HostExtension` 是宿主级系统能力扩展。

它负责：

1. host contract 的实现、替换或桥接。
2. boot-time 系统 adapter。
3. runtime slot family 的系统级声明。
4. health / reconcile / bootstrap hook。
5. observability、auth、gateway、secret manager 一类宿主桥接器。

它不负责：

1. 平台主业务表。
2. 核心 migration。
3. 核心 repository / service / route。
4. 文件管理主逻辑。
5. 数据源平台主逻辑。
6. 工作流平台主逻辑。

一句话：

```text
HostExtension 接宿主，不拥有业务资源。
```

### 5.4 RuntimeExtension

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
3. 拥有平台 secret / preview session / import job / catalog cache 主状态。

### 5.5 CapabilityPlugin

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

## 6. 插件源码目录

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

## 7. 生命周期

### 7.1 HostExtension

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

1. 随主进程内加载
2. 不走 `plugin-runner`
3. 不做 Rust `so/dll` 热卸载
4. 需要可重复卸载时优先声明式、Lua、WASM

### 7.2 RuntimeExtension

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

### 7.3 CapabilityPlugin

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

## 8. 打包与发行

打包必须区分 `编译` 与 `发行组装`。

### 8.1 编译

`cargo build` 只编译：

1. `api-server`
2. `plugin-runner`
3. `crates/*`

它不把插件源码静态编译进主二进制。

### 8.2 插件打包

插件源码单独执行 `plugin package`：

1. `host-extensions/*`
2. `runtime-extensions/*`
3. `capability-plugins/*`

输出到：

1. `api/plugins/packages/`

### 8.3 发行组装

发行包通过 `api/plugins/sets/*.yaml` 选择需要附带的插件包。

规则：

1. 可以带默认插件包
2. 不应默认把所有插件包都打进发行包
3. 即使随发行包附带，插件仍然是独立 package，不是静态链接进主程序

## 9. 现有能力归属

### 9.1 文件管理

文件管理平台本身属于 `Core`。

包括：

1. `file_storages`
2. `file_tables`
3. 上传编排
4. 文件记录
5. 绑定关系

只有对象存储实现桥接这一层可由 `HostExtension` 承接。

### 9.2 主存储

平台主存储属于 `Core`。

包括：

1. `storage-durable`
2. `storage-postgres`
3. migration
4. repository

`HostExtension` 不应成为平台主数据库 schema owner。

### 9.3 临时缓存层

临时缓存层属于 `Core`。

包括：

1. session
2. ephemeral kv
3. lease
4. wakeup signal

它是宿主基础设施，不是插件能力。

### 9.4 数据源

数据源拆成两半：

1. 数据源平台：`Core`
2. 具体外部源适配器：`RuntimeExtension`

平台侧包括：

1. instance
2. secret
3. preview session
4. catalog cache
5. import job

插件侧只实现：

1. 连接校验
2. catalog 发现
3. preview read
4. import snapshot

### 9.5 工作流

工作流平台属于 `Core`。

包括：

1. graph / definition
2. compiler
3. execution engine
4. run persistence
5. debug runtime

只有 workflow 中用户可选择的能力才属于 `CapabilityPlugin`。

### 9.6 插件市场与安装元数据

插件市场、官方 registry metadata、安装状态、任务、信任策略都属于 `Core`。

它们是宿主自己的 `system/root` 资源，不属于 `HostExtension`。

## 10. HostExtension 可扩展内容示例

### 10.1 适合 HostExtension 的例子

1. 把 `storage-object` 接到公司内部对象存储桥接器。
2. 把认证接到企业 SSO / LDAP。
3. 把 observability 接到公司内部 metrics / tracing 平台。
4. 在 boot-time 增加宿主健康校验或 reconcile worker。
5. 声明宿主开放 `data_source`、`file_processor`、`model_provider` 这些 runtime slot family。

### 10.2 不适合 HostExtension 的例子

1. 新增 `plugin_marketplace_entries` 系统表。
2. 新增 `file_folders`、`file_shares` 业务表。
3. 新增数据源实例、secret、preview session 的平台主逻辑。
4. 新增 workflow run 表、node run 表、debug event 表。
5. 新增平台系统 route、repository、service。

## 11. 新需求落点判断表

| 需求类型 | 落点 | 判断标准 | 例子 |
| --- | --- | --- | --- |
| 平台核心资源 | `Core` | 需要主数据库表、migration、repository、service、route、审计、权限、事务一致性 | 插件市场、文件表、数据源实例、工作流运行记录 |
| 宿主级系统能力 | `HostExtension` | `root/system` 级，boot-time 生效，接宿主 contract / bridge / policy，不拥有核心业务资源 | 对象存储桥接、SSO bridge、observability bridge |
| 外部协议适配器 | `RuntimeExtension` | 是已注册 runtime slot 的具体实现，供 workspace / model 绑定 | OpenAI provider、MySQL 数据源、文件处理器 |
| 用户显式选择能力 | `CapabilityPlugin` | 是 workflow / app / canvas 中可选择的一项能力 | workflow node、tool、trigger、publisher |

快速判断规则：

1. 需要新增平台主库表：`Core`
2. 需要宿主启动时挂接系统 bridge：`HostExtension`
3. 需要实现某个 slot：`RuntimeExtension`
4. 需要新增 workflow / app 中的可选能力块：`CapabilityPlugin`

## 12. 对现有 spec 的收敛

本设计收敛并修正 [2026-04-28-host-extension-boundary-design.md](./2026-04-28-host-extension-boundary-design.md) 中以下过宽定义：

1. `HostExtension` 不再作为系统主资源 owner。
2. `HostExtension` 不再承诺拥有核心 migration 和系统表。
3. `HostExtension` 不再被设计成可注册整套系统 API / route 的主方式。
4. `HostExtension` 改为宿主系统 bridge 与 boot-time adapter。
5. 主仓插件源码目录不按官方和第三方拆分，而按插件层级拆分。

## 13. 迁移建议

建议按以下顺序推进：

1. 更新 `api/AGENTS.md`，把四层落点判断和 HostExtension 约束写死。
2. 在 `api/plugins/` 下建立三类插件源码工作区和模板目录。
3. 把现有 `api-server` 中的 builtin host manifest 迁到 `api/plugins/host-extensions/*` 源码工作区。
4. 保留 `api-server` 只做 loader、policy、inventory 和 boot assembly。
5. 后续再逐步补 `HostExtension` runtime 和 `CapabilityPlugin` install chain。

## 14. 自检

本文已检查：

1. 没有把 `HostExtension` 和 `Core` 的资源 owner 关系写混。
2. 没有把 `RuntimeExtension` 和 `CapabilityPlugin` 混成同一类插件。
3. 没有要求把插件源码移出主仓。
4. 没有把 Rust native `so/dll` 热卸载作为 `HostExtension` 目标方案。
