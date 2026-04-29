# 数据源、数据模型与运行时 CRUD 设计

日期：2026-04-29
状态：待用户审阅

关联文档：
- [主存储与外部数据源平台设计](./2026-04-23-storage-durable-and-external-data-source-platform-design.md)
- [插件分层与 HostExtension 收敛设计](./2026-04-29-plugin-layering-and-host-extension-realignment-design.md)

## 1. 文档目标

本文收口数据源管理、动态建表、数据模型自动生成 CRUD、外部数据源直连操作、权限分级和编排节点接入的产品与架构方案。

重点明确：

1. `main_source`、外部数据源、数据模型和运行时 CRUD 的关系。
2. 数据模型由 `system` 统一创建，再授权给 `workspace` 使用的规则。
3. 外部数据源通过插件接入，但统一进入平台模型层、权限层和审计层。
4. 自动 CRUD API、API Key、编排节点和前端入口的边界。
5. V1 范围、非目标、验收标准和后续计划入口。

## 2. 背景

当前项目已经具备基础能力：

1. 后端已有 `model_definitions / model_fields` 作为数据建模元数据。
2. PostgreSQL 存储层已有动态建表、加字段、删字段、关系表和变更日志逻辑。
3. 运行时已有通用 CRUD 路由：`/api/runtime/models/{model_code}/records`。
4. 后端已有 `data_source_instances / data_source_secrets / data_source_catalog_caches` 和数据源插件运行契约。
5. 权限、审计、session、workspace scope 已经形成基本边界。

NocoBase 可参考的核心思路是 `collection` 元数据驱动表结构，并自动成为可操作的 `resource`。本项目不照搬 NocoBase 的路由和插件实现形态，而是沿用当前 Rust 架构，采用：

```text
Data Source -> Data Model -> Runtime CRUD -> Permission / Audit / Workflow
```

## 3. 术语

### 3.1 Data Source / 数据源

数据源是平台可操作数据的来源。

V1 有两类：

1. `main_source`：系统内置主数据源，使用平台主存储能力，V1 物理实现为 PostgreSQL，但产品和协议层不暴露 `postgres` 名称。
2. 外部数据源：通过 RuntimeExtension 插件接入，例如 PostgreSQL 数据库或 REST API。

### 3.2 Data Model / 数据模型

数据模型是平台对一类业务数据的统一定义。中文产品名使用“数据模型”，英文产品名使用 `Data Model`。

技术内部继续使用现有命名：

1. `model_definition`
2. `model_field`
3. `runtime_model`

避免把数据模型和人工智能模型混称为“模型”。需要简写时，文档中优先写“数据模型”或 `Data Model`。

### 3.3 Runtime CRUD / 运行时 CRUD

运行时 CRUD 指由数据模型自动开放的通用记录接口，不为每张表生成独立 Rust handler。

标准路径固定为：

```text
GET    /api/runtime/models/{model_code}/records
POST   /api/runtime/models/{model_code}/records
GET    /api/runtime/models/{model_code}/records/{record_id}
PATCH  /api/runtime/models/{model_code}/records/{record_id}
DELETE /api/runtime/models/{model_code}/records/{record_id}
```

### 3.4 Scope / 权限范围

`scope` 是权限层级，不等于物理数据源或物理表。

V1 scope 分两层：

1. `system`：系统级，数据模型只能在 system 创建。system 的“全部可见”表示完整系统数据。
2. `workspace`：空间级，workspace 使用 system 下发的数据模型。workspace 的“全部可见”仅表示当前 workspace 内数据。

每层都支持：

1. 自己可见
2. 本层全部可见

## 4. 产品定位

V1 面向管理员和开发者，但保留业务用户后续使用空间。

核心用户：

1. system 管理员：配置数据源、创建数据模型、下发给 workspace、管理全局权限。
2. workspace 管理员：使用被下发的数据模型，配置 workspace 内可见范围和 API 使用方式。
3. 开发者：通过 API Key 调用自动 CRUD API。
4. 编排用户：在工作流中选择数据模型并执行 list/get/create/update/delete。

## 5. 目标

V1 目标：

1. 内置 `main_source`，支持创建数据模型、动态建表和自动 CRUD。
2. 支持 PostgreSQL 与 REST API 形态的外部数据源插件预留和接入契约。
3. 外部数据源不做导入和同步，直接通过插件对外部源进行 CRUD。
4. 外部数据源仍必须进入平台数据模型、权限层、审计层和运行时 API。
5. 数据模型只能由 system 创建，再授权给 workspace 使用。
6. 数据模型支持草稿与发布，发布后才开放运行时 CRUD。
7. 支持 API Key 认证，供外部开发者调用自动 CRUD。
8. 编排中提供一个通用数据模型节点，动作可选 list/get/create/update/delete。

## 6. 非目标

V1 不做：

1. 外部数据源导入本地表。
2. 外部数据源与 `main_source` 之间的数据同步。
3. 跨数据源事务。
4. 修改已创建物理字段的字段类型或物理列名。
5. workspace 自建物理表。
6. workspace fork 数据模型后独立改字段。
7. NocoBase 风格 `/api/resources/{model_code}:list` 路由 alias。
8. OAuth、App token 或复杂第三方授权。
9. 字段级、记录条件级 ACL 的完整实现。
10. `tree`、`sequence`、`rich_text`、`markdown` 等增强字段。

## 7. 关键决策

### 7.1 内置数据源命名

内置主数据源固定命名为 `main_source`。

理由：

1. 产品层不暴露 PostgreSQL 实现细节。
2. 后续主存储实现或部署形态变化时，不影响用户认知。
3. 与外部数据源形成一致抽象：所有数据都来自某个 data source。

### 7.2 ID 与 code 唯一性

所有持久化对象的 `id` 必须使用全局唯一 ID，默认采用 UUID v7。任何业务层不得复用、覆盖或手工构造重复 ID。

`code` 使用命名空间唯一：

1. `data_source_instance.id` 全局唯一。
2. `data_source_instance.display_name` 不作为唯一键。
3. `source_code` 表示插件或数据源类型，例如 `postgres`、`rest_api`。
4. `data_model.code` 在同一个 data source 内唯一。
5. 同一个 data source 内不允许两个已发布数据模型使用相同 `code`。
6. `main_source` 中的数据模型 code 由 system 统一治理，避免多个 workspace 创建同名物理表。

### 7.3 system 建模，workspace 使用

数据模型只能在 system 创建和修改结构。

workspace 获得的是使用权：

1. workspace 不能新增、删除或修改字段结构。
2. workspace 不能改变物理表名、物理字段名或外部资源映射。
3. workspace 可以配置自己空间内的权限策略和 API Key 访问。
4. workspace 可以查看被授权的数据模型、记录列表和 API 信息。

这样可以避免多个 workspace 创建相同表名导致物理冲突，也能让 system 管理员统一治理数据模型生命周期。

### 7.4 外部数据源不导入

外部数据源 V1 不导入、不同步、不镜像成本地表。

平台本地只保存：

1. 数据源实例配置和 secret。
2. 外部资源 catalog cache。
3. 数据模型元数据。
4. 字段映射。
5. 权限策略。
6. 审计事件。

真实数据仍留在外部数据源中。CRUD 执行时由 runtime engine 分发给对应数据源插件。

### 7.5 发布才能开放 CRUD

数据模型采用草稿与发布机制：

1. 草稿状态可编辑结构，不开放运行时 CRUD。
2. 发布时必须校验结构、权限、物理表或外部资源可用性。
3. 发布成功后注册或刷新 runtime model。
4. 发布失败时保留草稿，不开放不完整 API。

外部数据源数据模型发布时必须完成连接测试和 schema 校验，校验不通过不得发布。

## 8. 领域模型

### 8.1 DataSourceInstance

现有 `data_source_instances` 继续作为数据源实例表。

需要补充或明确的语义：

1. `source_code`：数据源类型或插件贡献代码。
2. `display_name`：用户可读名称。
3. `status`：`draft / ready / invalid / disabled`。
4. `config_json`：非敏感配置。
5. `secret_json`：敏感配置，继续走 secret 表。
6. `workspace_id`：实例归属。system 级数据源使用 system scope。

`main_source` 不需要用户创建实例，它是系统内置数据源。实现上可以用保留实例、保留 code 或内置 provider descriptor 表达，但对外必须稳定呈现为 `main_source`。

### 8.2 DataModel

现有 `model_definitions` 继续承载数据模型定义，但需要补齐数据源归属。

建议目标字段：

1. `id`
2. `data_source_instance_id`，`main_source` 可为空或指向内置实例
3. `source_kind`：`main_source / external`
4. `code`
5. `title`
6. `description`
7. `physical_table_name`
8. `external_resource_key`
9. `scope_kind`
10. `scope_id`
11. `status`：`draft / published / disabled / broken`
12. `published_version`
13. `acl_namespace`
14. `audit_namespace`
15. `availability_status`

`code` 在同一个 data source 内唯一；`id` 全局唯一。

### 8.3 DataModelField

现有 `model_fields` 继续承载字段定义。

建议目标字段：

1. `id`
2. `data_model_id`
3. `code`
4. `title`
5. `description`
6. `field_kind`
7. `physical_column_name`
8. `external_field_key`
9. `is_required`
10. `is_unique`
11. `default_value`
12. `display_interface`
13. `display_options`
14. `relation_target_model_id`
15. `relation_options`
16. `sort_order`
17. `availability_status`

V1 只支持新增字段和删除字段；字段 title、description、display 配置可改。

### 8.4 WorkspaceDataModelGrant

需要新增或等价表达“system 数据模型下发给 workspace”的授权关系。

建议字段：

1. `id`
2. `workspace_id`
3. `data_model_id`
4. `enabled`
5. `permission_profile`
6. `created_by`
7. `created_at`
8. `updated_at`

它不是复制数据模型，也不是 fork。它只是 workspace 使用 system 数据模型的授权和配置入口。

## 9. 数据源运行模式

### 9.1 main_source

`main_source` 的数据模型由平台拥有物理 schema。

发布流程：

```text
validate draft
-> create or update physical table
-> register runtime model
-> mark published
-> write audit log
```

CRUD 流程：

```text
runtime route
-> session or API Key auth
-> runtime ACL
-> runtime engine
-> main_source repository
-> physical table
-> audit log
```

### 9.2 External Data Source

外部数据源由插件实现真实协议。

发布流程：

```text
validate data source instance
-> discover catalog/resource
-> validate field mapping
-> register runtime model
-> mark published
-> write audit log
```

CRUD 流程：

```text
runtime route
-> session or API Key auth
-> runtime ACL
-> runtime engine
-> data-source runtime port
-> plugin adapter
-> external PostgreSQL / REST API
-> audit log
```

插件只负责协议翻译，不拥有权限、审计、API Key、workspace scope 和平台元数据。

## 10. 自动 CRUD API

标准 API 固定使用当前 runtime 风格。

### 10.1 List

```text
GET /api/runtime/models/{model_code}/records
```

支持 pagination、filter、sort、expand relations、workspace scope 和 permission scope。

### 10.2 Get

```text
GET /api/runtime/models/{model_code}/records/{record_id}
```

### 10.3 Create

```text
POST /api/runtime/models/{model_code}/records
```

### 10.4 Update

```text
PATCH /api/runtime/models/{model_code}/records/{record_id}
```

### 10.5 Delete

```text
DELETE /api/runtime/models/{model_code}/records/{record_id}
```

V1 删除记录采用物理删除，不做软删除。

## 11. 认证与外部 API

自动 CRUD 同时服务内部前端、编排 runtime 和外部开发者。

内部前端继续使用登录 session。外部开发者使用 API Key。

API Key 需要绑定：

1. 创建者
2. workspace
3. 可访问数据模型集合
4. 动作权限：list/get/create/update/delete
5. 权限范围：自己可见或本层全部可见
6. 过期时间
7. 启用状态

API Key 不绕过权限层。它只是认证方式，最终仍转换为 actor context 和 runtime ACL input。

## 12. 权限模型

V1 权限粒度是数据模型级，不做字段级 ACL。

动作权限：

1. view/list
2. get
3. create
4. update
5. delete
6. manage

范围权限：

```text
system:
  own      -> 仅自己创建或归属自己的记录
  all      -> 完整系统数据

workspace:
  own      -> 当前 workspace 内自己创建或归属自己的记录
  all      -> 当前 workspace 内全部记录
```

`main_source` 动态表需要保留固定审计字段：

1. `id`
2. `created_at`
3. `updated_at`
4. `created_by`
5. `updated_by`
6. `scope_id`

外部数据源如果没有等价 owner 字段，插件必须声明 owner/scope 能力：

1. 支持 owner/scope 过滤
2. 不支持 owner/scope 过滤
3. 通过字段映射支持 owner/scope 过滤

不支持 owner/scope 过滤的外部数据源，不允许授予 `own` 范围，只能由管理员显式授予更高范围或禁止发布。

## 13. 结构变更策略

V1 支持：

1. 创建数据模型。
2. 修改数据模型 title、description。
3. 新增字段。
4. 删除字段。
5. 修改字段 title、description、display 配置。
6. 修改数据模型授权给 workspace 的状态。

V1 不支持：

1. 修改物理表名。
2. 修改物理字段名。
3. 修改字段物理类型。
4. 自动迁移已有字段数据。

删除字段是危险操作，必须二次确认、写入审计、记录变更日志，并对外部数据源执行插件能力检查。

## 14. 字段与关系字段

V1 常用字段集固定为：

1. `string`
2. `text`
3. `number`
4. `integer`
5. `boolean`
6. `datetime`
7. `date`
8. `time`
9. `enum`
10. `json`
11. `file`
12. `formula`
13. `many_to_one`
14. `one_to_many`
15. `many_to_many`

`tree`、`sequence`、`rich_text`、`markdown` 先不进入 V1 字段集。

关系字段目标支持：

1. `many_to_one`
2. `one_to_many`
3. `many_to_many`

`main_source`：

1. `many_to_one` 使用 FK 字段和约束。
2. `one_to_many` 作为反向元数据，不创建物理列。
3. `many_to_many` 使用平台管理 join table。

外部数据源：

1. 插件 catalog 必须声明关系能力。
2. 插件不支持关系写入时，平台只开放可实现的动作。
3. 发布时必须校验关系目标存在。

## 15. 编排节点

V1 提供一个通用“数据模型”编排节点。

节点配置：

1. data source
2. data model
3. action：list/get/create/update/delete
4. filters
5. sort
6. pagination
7. payload mapping
8. relation expand

节点执行：

```text
workflow runtime
-> runtime CRUD contract
-> runtime ACL with workflow actor
-> main_source or external data source
```

编排节点不直接调用插件，不直接拼 SQL，也不绕过 runtime engine。

## 16. 前端信息架构

V1 前端入口放在 Settings。

```text
Settings
├─ 数据源
│  ├─ main_source
│  ├─ 外部数据源实例
│  └─ 点击数据源进入数据模型列表
└─ 数据模型
   └─ 后续可作为聚合入口，V1 可先从数据源详情进入
```

数据源详情：

1. 基础信息
2. 连接状态
3. 数据模型列表
4. API Key 入口
5. 审计记录入口

数据模型详情：

1. 字段
2. 关系
3. 权限
4. API
5. 记录预览
6. 发布状态

管理台页面遵守当前前端规则：优先使用表格、表单、详情描述和抽屉，不做卡片墙。

## 17. 后端边界

### 17.1 domain

放稳定领域对象：

1. `DataSourceInstanceRecord`
2. `DataModelRecord`
3. `DataModelFieldRecord`
4. `WorkspaceDataModelGrantRecord`
5. scope 与权限枚举

### 17.2 control-plane

放业务写入口：

1. `DataSourceService`
2. `DataModelService`
3. `DataModelPublishService`
4. `RuntimeDataModelGrantService`
5. `ApiKeyService`

关键写动作必须从 service command 或 Resource Action Kernel 进入。

### 17.3 runtime-core

放运行时 CRUD：

1. model registry
2. runtime ACL
3. query/filter/sort parser
4. runtime engine dispatch
5. main_source executor
6. external data source executor port

### 17.4 storage-durable/postgres

放 PostgreSQL 实现：

1. 元数据 migration
2. repository impl
3. 动态表 DDL
4. runtime record query
5. API Key 持久化

### 17.5 plugin-framework

放数据源插件契约：

1. validate config
2. test connection
3. discover catalog
4. describe resource schema
5. CRUD capability descriptor
6. list/get/create/update/delete operation
7. owner/scope support descriptor

## 18. 插件契约

外部数据源插件 V1 至少需要声明：

1. `source_code`
2. `display_name`
3. `contract_version`
4. `config_schema`
5. `secret_schema`
6. `resource_kinds`
7. `crud_capabilities`
8. `scope_capabilities`

运行时动作：

1. `validate_config`
2. `test_connection`
3. `discover_catalog`
4. `describe_resource`
5. `list_records`
6. `get_record`
7. `create_record`
8. `update_record`
9. `delete_record`

PostgreSQL 与 REST API 是 V1 要预留和验证的插件形态。主仓不要求官方维护所有 adapter，但契约必须能承载这两类。

## 19. 审计与可观测性

必须审计：

1. 数据源创建、更新、验证、禁用。
2. 数据模型创建、字段新增、字段删除、发布、禁用。
3. workspace 授权变化。
4. API Key 创建、禁用、过期。
5. runtime CRUD 写动作。
6. 外部数据源连接失败、schema 校验失败、插件执行失败。

读操作是否全量审计可配置，但外部 API Key 访问至少需要记录调用指标和失败原因。

## 20. OpenAPI 与开发者体验

每个已发布数据模型需要展示：

1. CRUD endpoint。
2. 字段 schema。
3. filter/sort/expand 示例。
4. API Key 使用方式。
5. 错误码。

OpenAPI 可以先保留通用 runtime schema，不为每个数据模型生成静态 OpenAPI 文件。后续可增加按数据模型导出的动态 OpenAPI 文档。

## 21. 分期

### V1.1 main_source 数据模型闭环

1. system 创建数据模型。
2. 动态建表。
3. 字段新增和删除。
4. 草稿发布。
5. runtime CRUD。
6. 数据模型级权限。
7. Settings 数据源与数据模型基础 UI。

### V1.2 API Key 与外部 API

1. API Key 管理。
2. runtime route 支持 API Key actor。
3. 数据模型 API 文档入口。
4. 调用审计和失败指标。

### V1.3 外部数据源直连

1. PostgreSQL 数据源插件能力验证。
2. REST API 数据源插件能力验证。
3. 外部资源映射为 Data Model。
4. 外部数据源发布校验。
5. 外部数据源 runtime CRUD 分发。

### V1.4 编排节点

1. 通用数据模型节点。
2. list/get/create/update/delete 动作。
3. 动态 schema 加载。
4. workflow actor 权限校验。
5. 执行日志与错误回传。

## 22. 验收标准

V1 完成时必须满足：

1. `main_source` 可在 system 创建数据模型，并发布后通过 runtime CRUD 操作记录。
2. 同一个 data source 内不能创建重复 `data_model.code`。
3. 所有持久化对象 ID 全局唯一，不允许复用。
4. 未发布数据模型不能被 runtime CRUD 调用。
5. workspace 只能使用 system 授权的数据模型，不能改字段结构。
6. 权限范围能区分 system own/all 和 workspace own/all。
7. API Key 能调用被授权的数据模型 CRUD，不能越权访问。
8. 外部数据源发布必须通过连接测试和 schema 校验。
9. 外部数据源 CRUD 通过插件执行，但权限和审计仍由平台控制。
10. 编排节点通过 runtime CRUD contract 执行，不直接调用插件或 SQL。
11. 删除字段和删除记录都写入审计；删除记录 V1 为物理删除。
12. 前端 Settings 中能从数据源进入数据模型列表和详情。

## 23. 风险与约束

### 23.1 外部数据源权限一致性

外部数据源可能不支持 owner/scope 字段。V1 必须让插件显式声明 scope 能力，不能默认认为外部系统可被平台完整隔离。

### 23.2 REST API CRUD 映射复杂度

REST API 的 list/get/create/update/delete 不一定天然一致。V1 的 REST API 插件应要求用户配置动作映射和响应映射，不把任意 REST API 自动推断成完整 CRUD。

### 23.3 关系字段跨源问题

V1 不应支持跨 data source 强关系约束。跨源关系可以在产品层展示为弱引用或后续能力，不进入 V1 强一致性范围。

### 23.4 物理删除风险

记录删除采用物理删除，必须在 UI 和 API 文档中明确不可恢复，并保留审计事件。

### 23.5 system 建模集中化

system 统一建模降低冲突，但会增加 system 管理员配置压力。后续可通过 workspace 申请、模板和 fork 能力缓解，不在 V1 实现。

## 24. 后续计划入口

用户确认本 spec 后，下一步生成实施计划。计划应按以下顺序拆分：

1. 数据模型元数据与命名空间调整。
2. `main_source` 发布与 runtime CRUD 闭环。
3. workspace grant 与权限范围。
4. API Key 认证。
5. 外部数据源插件 CRUD contract。
6. 前端 Settings 数据源与数据模型页面。
7. 编排通用数据模型节点。
8. QA 验收与回归。
