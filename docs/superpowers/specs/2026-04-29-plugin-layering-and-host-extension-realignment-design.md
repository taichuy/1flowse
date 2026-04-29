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
3. `HostExtension` 是受治理的内核级系统插件，可以实现或替换 host contract，也可以拥有自己命名空间下的系统资源、migration、service 和受控 route。
4. `HostExtension` 不能绕过 Boot Core 的治理边界：不能改写核心安装状态、权限、审计、主存储连接、安全策略，不能裸开任意 HTTP route，不能直接篡改其他模块的表。
5. `RuntimeExtension` 是某个 runtime slot 的具体实现，例如 `model_provider`、`data_source`、`file_processor`。
6. `CapabilityPlugin` 是用户在 workflow / app / canvas 中显式选择的一项能力，例如 node、tool、trigger、publisher。
7. 平台最小内核和跨模块一致性属于 `Core`；文件管理、数据源平台、工作流平台这类系统模块可以先在核心实现，也可以逐步迁为官方 `HostExtension`。
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

`Core Platform` 是平台最小内核和跨模块一致性的 owner。

它负责：

1. Boot Core schema，以及当前尚未迁出的核心模块 schema。
2. Boot Core migration 链，以及当前核心模块 migrations。
3. Boot Core repository / mapper，以及当前核心模块 repository / mapper。
4. 核心权限、审计、状态机。
5. 插件安装、任务、信任、inventory、registry metadata。
6. 跨模块必须一致的事务边界。
7. 当前尚未插件化的系统模块实现。

一句话：

```text
只要是 Boot Core 治理、安全、安装、权限、审计和跨模块一致性，默认都属于 Core。
```

### 5.3 HostExtension

`HostExtension` 是受治理的内核级系统插件。

它负责：

1. host contract 的定义、实现、替换或增强。
2. boot-time 系统 module。
3. runtime slot family 的系统级声明。
4. health / reconcile / bootstrap hook。
5. observability、auth、gateway、secret manager 一类宿主桥接器。
6. 自己命名空间下的系统资源、migration、repository、service。
7. 通过 host route registry 注册的受控 route / callback / worker。

它不负责：

1. Boot Core 自身的启动、安装、权限、审计和安全策略。
2. `plugin_installations`、`plugin_tasks` 等核心插件生命周期表。
3. 直接修改其他模块拥有的表或状态。
4. 绕过 `control-plane`、权限、审计和 route registry。
5. 裸开任意 HTTP route。
6. workspace 用户可安装的普通能力。

一句话：

```text
HostExtension 可以拥有内核级系统模块，但必须通过宿主治理边界扩展。
```

### 5.4 HostExtension 资源所有权

`HostExtension` 可以拥有系统资源，但资源必须归属到插件命名空间。

允许：

1. `extension_id` 命名空间下的系统表。
2. 插件自有 migration。
3. 插件自有 service 和 repository。
4. 通过宿主 route registry 注册的系统 API。
5. 通过宿主 worker registry 注册的后台任务。

禁止：

1. 直接改写 Boot Core 的核心表。
2. 直接抢占其他 `HostExtension` 的资源命名空间。
3. 绕过宿主权限、审计、CSRF、OpenAPI 和健康检查。
4. 在运行中热替换 Rust native 代码。

判断方式：

```text
如果它是一个可随部署启用或替换的系统模块，并且资源可以清晰归属到 extension namespace，可以做 HostExtension。
如果它是 Boot Core 自身维持系统可治理所必需的元数据，必须留在 Core。
```

### 5.5 RuntimeExtension

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

### 5.6 CapabilityPlugin

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

文件管理平台当前实现属于 `Core`；目标架构中可以作为官方 `HostExtension` 系统模块迁出。

包括：

1. `file_storages`
2. `file_tables`
3. 上传编排
4. 文件记录
5. 绑定关系

如果作为 `HostExtension` 迁出，它可以拥有文件管理命名空间下的系统表、service、route 和 worker；Boot Core 仍只保留插件治理、权限、审计和主存储连接。

### 9.2 主存储

平台主存储治理属于 `Core`。

包括：

1. `storage-durable`
2. `storage-postgres`
3. migration
4. repository

`HostExtension` 可以注册 storage implementation，也可以拥有自己命名空间下的系统表；但不能拥有 Boot Core 的全局 migration 链、主存储连接、核心插件生命周期表和跨模块一致性边界。

### 9.3 临时缓存层

临时缓存层属于 `Core`。

包括：

1. session
2. ephemeral kv
3. lease
4. wakeup signal

它是宿主基础设施，不是插件能力。

### 9.4 数据源

数据源拆成三层：

1. 数据源平台当前实现：`Core`
2. 数据源平台目标形态：可迁为官方 `HostExtension` 系统模块
3. 具体外部源适配器：`RuntimeExtension`

平台侧或 HostExtension 系统模块侧包括：

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

工作流平台当前实现属于 `Core`；目标架构中，工作流平台本体可以作为官方 `HostExtension` 系统模块，但单个用户可选节点仍属于 `CapabilityPlugin`。

包括：

1. graph / definition
2. compiler
3. execution engine
4. run persistence
5. debug runtime

工作流 engine、run persistence、debug runtime 如果迁出，应作为工作流 HostExtension 的 extension-owned resource；workflow 中用户可选择的节点、工具、触发器属于 `CapabilityPlugin`。

### 9.6 插件市场与安装元数据

插件安装状态、任务、信任策略、loader inventory 属于 `Core`。

插件市场 catalog、registry source、推荐位、分类、缓存和同步任务可以作为官方 `HostExtension` 系统模块；但它必须通过 Core 提供的安装、信任、审计和任务边界工作。

## 10. HostExtension 可扩展内容示例

### 10.1 适合 HostExtension 的例子

1. 把 `storage-object` 接到公司内部对象存储桥接器。
2. 把认证接到企业 SSO / LDAP。
3. 把 observability 接到公司内部 metrics / tracing 平台。
4. 在 boot-time 增加宿主健康校验或 reconcile worker。
5. 声明宿主开放 `data_source`、`file_processor`、`model_provider` 这些 runtime slot family。
6. 实现插件市场系统模块，拥有 marketplace catalog/cache/source 表和 route，但复用 Core 安装与信任边界。
7. 实现文件管理系统模块，拥有 file management namespace 下的表、service 和 route。

### 10.2 不适合 HostExtension 的例子

1. 直接修改 `plugin_installations`、`plugin_tasks` 等 Core 生命周期表。
2. 绕过 Core 安装、信任、审计、权限和任务系统。
3. 直接改写其他 HostExtension 拥有的表。
4. 裸开不经过 host route registry 的 HTTP route。
5. 给 workspace 用户安装可注册系统接口的插件。

## 11. 新需求落点判断表

| 需求类型 | 落点 | 判断标准 | 例子 |
| --- | --- | --- | --- |
| Core 内核资源 | `Core` | 维持系统可启动、可治理、可审计、可安装、可授权的全局元数据和跨模块一致性 | 插件安装状态、任务、信任策略、权限、审计、主存储连接 |
| Host 系统模块 | `HostExtension` | `root/system` 级，boot-time 生效，可拥有 extension namespace 下的表、migration、service、route、worker | 插件市场、文件管理模块、SSO bridge、observability bridge |
| 外部协议适配器 | `RuntimeExtension` | 是已注册 runtime slot 的具体实现，供 workspace / model 绑定 | OpenAI provider、MySQL 数据源、文件处理器 |
| 用户显式选择能力 | `CapabilityPlugin` | 是 workflow / app / canvas 中可选择的一项能力 | workflow node、tool、trigger、publisher |

快速判断规则：

1. 需要修改 Boot Core 治理、权限、审计、安装状态：`Core`
2. 需要新增可独立启停的 root/system 系统模块：`HostExtension`
3. 需要实现某个 runtime slot：`RuntimeExtension`
4. 需要新增 workflow / app 中的可选能力块：`CapabilityPlugin`

## 12. 对现有 spec 的收敛

本设计收敛并修正 [2026-04-28-host-extension-boundary-design.md](./2026-04-28-host-extension-boundary-design.md) 中以下不够精确的定义：

1. `HostExtension` 可以作为系统模块 owner，但必须拥有清晰 extension namespace。
2. `HostExtension` 可以拥有自有 migration 和系统表，但不能改写 Boot Core 与其他模块资源。
3. `HostExtension` 可以注册受控系统 API / route，但必须经过 host route registry、权限、审计和 OpenAPI 治理。
4. `HostExtension` 不只是 bridge，也可以是可启停的内核级系统模块实现。
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

1. 已区分 Boot Core 全局治理资源和 HostExtension 命名空间资源。
2. 已允许 HostExtension 拥有受治理的系统模块实现、migration、service 和 route。
3. 没有把 `RuntimeExtension` 和 `CapabilityPlugin` 混成同一类插件。
4. 没有要求把插件源码移出主仓。
5. 没有把 Rust native `so/dll` 热卸载作为 `HostExtension` 目标方案。
