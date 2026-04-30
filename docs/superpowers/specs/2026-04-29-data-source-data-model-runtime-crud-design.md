# 数据源、数据模型与运行时 CRUD 设计

日期：2026-04-29
状态：待用户审阅

关联文档：
- [主存储与外部数据源平台设计](./2026-04-23-storage-durable-and-external-data-source-platform-design.md)
- [插件分层与 HostExtension 收敛设计](./2026-04-29-plugin-layering-and-host-extension-realignment-design.md)

## 1. 目标

本文收口数据源管理、动态建表、数据模型自动生成 CRUD、外部数据源直连、权限分级、API Key、编排节点和管理台安全门禁。

最终方向：

1. 内置主数据源叫 `main_source`，不在产品层暴露 PostgreSQL 实现细节。
2. 中文产品名叫“数据模型”，英文产品名叫 `Data Model`；技术内部继续使用 `model_definition / model_field / runtime_model`。
3. 数据模型只能由 `system` 创建和修改结构，再通过通用 `scope grant` 授权使用。
4. 单机开源版不暴露 workspace，但核心保留 `scope_id`，默认使用 `DEFAULT_SCOPE_ID`。
5. 未来 workspace 多租户由 HostExtension 作为 `scope provider` 扩展，不改写动态表结构和 runtime CRUD 查询规则。
6. 外部数据源通过 RuntimeExtension 插件接入，但必须统一进入平台数据模型、权限、审计和 API 暴露门禁。
7. 自动 CRUD 使用当前 runtime 风格，不生成每张表的 Rust handler。

## 2. 参考与取舍

### 2.1 NocoBase

借鉴点：

1. `collection` 元数据驱动表结构。
2. `collection` 自动成为可操作 resource。
3. 字段、关系、权限共同决定 CRUD 行为。

不照搬：

1. 不照搬 NocoBase 的 route/action 形态。
2. 不把插件体系完整搬入当前 V1。
3. 不让页面 schema 和数据模型边界混在一起。

### 2.2 Supabase

借鉴点：

1. 数据结构变化后自动生成 API。
2. 管理台明确展示 API 暴露状态。
3. API grant 与行级权限分层。
4. 外部数据源可查询不等于可公开暴露。
5. system/internal/extension-owned 资源需要保护。
6. secret 只以引用方式进入运行时。
7. 管理台需要 Advisor 提醒危险配置。
8. API 文档应随 schema 自动更新。

不照搬：

1. 不走“直接暴露 Postgres schema”的路线。
2. 不依赖数据库 RLS 作为唯一权限真相。
3. 不把外部数据源都强行 SQL/FDW 化。
4. 不提前把 workspace 做成 V1 核心产品对象。

## 3. 核心术语

### 3.1 Data Source / 数据源

数据源是平台可操作数据的来源。

V1 类型：

1. `main_source`：系统内置主数据源，平台拥有物理 schema。
2. external source：外部数据源，通过 RuntimeExtension 插件接入，例如 PostgreSQL 或 REST API。

### 3.2 Data Model / 数据模型

数据模型是平台对一类业务数据的统一定义。

技术内部对应：

1. `model_definition`
2. `model_field`
3. `runtime_model`

### 3.3 Scope / 权限范围

`scope` 是权限层级和数据隔离边界，不等于 workspace 产品对象。

V1 权限范围：

1. `owner`：只能访问自己创建或归属自己的记录。
2. `scope_all`：只能访问当前 scope 内全部记录。
3. `system_all`：能访问所有 scope 的完整数据。

单机开源版：

1. 固定 `actor.current_scope_id = DEFAULT_SCOPE_ID`。
2. 不展示 workspace UI。
3. 动态表仍保留 `scope_id`。

未来 workspace HostExtension：

```text
HostExtension: workspace-scope
  -> 提供 scope 列表
  -> 提供 current_scope resolver
  -> 提供 scope membership / role
  -> 提供 scope grant UI
  -> 扩展 actor context
```

核心只识别 `actor.current_scope_id / actor.scope_permissions / record.scope_id / scope grant`。

## 4. 范围

### 4.1 V1 目标

1. `main_source` 支持创建数据模型、动态建表、字段新增、字段删除和自动 CRUD。
2. 外部数据源支持 PostgreSQL 与 REST API 插件形态的契约预留和验证。
3. 外部数据源不导入、不同步，直接通过插件对外部源 CRUD。
4. 外部数据源必须进入平台数据模型、权限层、审计层和 runtime API。
5. 数据模型支持 `draft / published / disabled / broken` 状态，新建默认状态从数据源设置继承，默认 `published`。
6. 支持 API Key 认证。
7. 编排中提供一个通用“数据模型”节点，动作可选 list/get/create/update/delete。
8. Settings 中提供数据源、数据模型、API、权限、记录预览和 Advisor 入口。

### 4.2 V1 不做

1. 外部数据源导入本地表。
2. 外部数据源与 `main_source` 之间的数据同步。
3. 跨数据源事务。
4. 修改已创建物理字段的字段类型或物理列名。
5. 非 system scope 自建物理表。
6. 非 system scope fork 数据模型后独立改字段。
7. NocoBase 风格 `/api/resources/{model_code}:list` route alias。
8. OAuth、App token 或复杂第三方授权。
9. 字段级、记录条件级 ACL 的完整实现。
10. `tree`、`sequence`、`rich_text`、`markdown` 等增强字段。
11. workspace 多租户 UI、成员关系和工作空间切换产品形态。

## 5. 关键决策

### 5.1 命名与唯一性

1. 内置主数据源固定命名为 `main_source`。
2. 所有持久化对象 ID 必须全局唯一，默认 UUID v7。
3. `data_model.code` 在同一个 data source 内唯一。
4. 同一个 data source 内不允许两个已发布数据模型使用相同 `code`。
5. `main_source` 中的数据模型 code 由 system 统一治理，避免多个 scope 创建同名物理表。

### 5.2 system 建模，scope 使用

数据模型只能在 system 创建和修改结构。

scope 获得使用权：

1. 非 system scope 不能新增、删除或修改字段结构。
2. 非 system scope 不能改变物理表名、物理字段名或外部资源映射。
3. scope 可以配置自己范围内的权限策略和 API Key 访问。
4. scope 可以查看被授权的数据模型、记录列表和 API 信息。

### 5.3 外部数据源不裸暴露

外部数据源 V1 不导入、不同步、不镜像成本地表。

平台本地保存：

1. 数据源实例配置和 secret reference。
2. 外部资源 catalog cache。
3. 数据模型元数据。
4. 字段映射。
5. 权限策略。
6. 审计事件。

真实数据仍留在外部数据源中。CRUD 执行时由 runtime engine 分发给对应数据源插件。

### 5.4 发布与 API 暴露分离

发布状态不等于 API 安全可用状态。

数据模型状态：

1. `draft`
2. `published`
3. `disabled`
4. `broken`

新建数据模型的默认状态由数据源设置决定。内置 `main_source` 默认 `published`，外部数据源实例默认也建议 `published`，但可在数据源设置中调整。

创建或编辑数据模型时，用户可以通过下拉选择数据模型状态：

1. `draft`：结构仍在准备中，不允许 runtime CRUD。
2. `published`：结构可被 runtime CRUD 调用，但不代表外部 API 已安全开放。
3. `disabled`：管理员主动停用，runtime CRUD 和外部 API 都不可调用。
4. `broken`：系统检测到结构、物理表、外部资源或插件能力异常，runtime CRUD 和外部 API 都不可调用。

API 暴露状态：

1. `draft`：未发布，runtime CRUD 不可调用。
2. `published_not_exposed`：已发布，但未授予 API Key 或外部访问。
3. `api_exposed_no_permission`：已开放 API 入口，但没有可用动作权限或 scope grant。
4. `api_exposed_ready`：API、权限、scope filter 和审计配置完整。
5. `unsafe_external_source`：外部数据源缺少 owner/scope 能力，或插件声明无法保证安全过滤。

API 暴露状态默认也由数据源设置决定。默认规则：

1. 当默认数据模型状态为 `published` 时，默认 API 暴露状态为 `published_not_exposed`。
2. 当默认数据模型状态为 `draft` 时，默认 API 暴露状态只能为 `draft`。
3. 当数据模型状态为 `disabled` 或 `broken` 时，runtime 先按数据模型状态阻断调用；API 暴露状态可以保留上一次配置，但 effective API 状态不可用。
4. `api_exposed_ready` 不能只靠下拉选择产生，必须同时满足 API Key、动作权限、scope grant、scope filter 和审计配置。
5. `unsafe_external_source` 由外部数据源插件 capability 和平台校验派生，不能由用户手动选择为安全状态。

发布时必须校验：

1. 数据模型结构。
2. 权限与 scope grant。
3. `main_source` 物理表或外部资源可用性。
4. 外部数据源连接和 schema。
5. 外部数据源 owner/scope capability。

## 6. 领域模型

### 6.1 DataSourceInstance

现有 `data_source_instances` 继续作为数据源实例表，但目标语义应从 `workspace_id` 收敛到 `scope_kind / scope_id`。

字段语义：

1. `id`
2. `source_code`
3. `display_name`
4. `status`
5. `default_data_model_status`
6. `default_api_exposure_status`
7. `config_json`
8. `secret_ref / secret_version`
9. `scope_kind / scope_id`
10. `created_by / created_at / updated_at`

`main_source` 是系统内置数据源，不需要用户创建实例，但仍有系统级数据源设置。`main_source.default_data_model_status` 默认为 `published`，`main_source.default_api_exposure_status` 默认为 `published_not_exposed`。

### 6.2 DataModel

建议目标字段：

1. `id`
2. `data_source_instance_id`
3. `source_kind`
4. `code`
5. `title`
6. `description`
7. `physical_table_name`
8. `external_resource_key`
9. `scope_kind / scope_id`
10. `status`
11. `api_exposure_status`
12. `published_version`
13. `acl_namespace`
14. `audit_namespace`
15. `availability_status`
16. `owner_kind`：`core / host_extension / runtime_extension`
17. `owner_id`
18. `is_protected`

`status` 创建时从数据源默认配置继承，用户可在数据模型详情中下拉调整。`api_exposure_status` 创建时也从数据源默认配置继承，但保存前必须经过状态兼容校验。

### 6.3 DataModelField

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

### 6.4 ScopeDataModelGrant

表达“system 数据模型授权给某个 scope”的关系。

字段：

1. `id`
2. `scope_kind`
3. `scope_id`
4. `data_model_id`
5. `enabled`
6. `permission_profile`
7. `created_by / created_at / updated_at`

它不是复制数据模型，也不是 fork。

## 7. 权限、API 与查询

### 7.1 Runtime CRUD API

标准路径：

```text
GET    /api/runtime/models/{model_code}/records
POST   /api/runtime/models/{model_code}/records
GET    /api/runtime/models/{model_code}/records/{record_id}
PATCH  /api/runtime/models/{model_code}/records/{record_id}
DELETE /api/runtime/models/{model_code}/records/{record_id}
```

支持 pagination、filter、sort、expand relations、scope 和 permission scope。

V1 删除记录采用物理删除。

### 7.2 API Key

API Key 需要绑定：

1. 创建者
2. `scope_kind / scope_id`
3. 可访问数据模型集合
4. 动作权限：list/get/create/update/delete
5. 权限范围：`owner / scope_all / system_all`
6. 过期时间
7. 启用状态

API Key 不绕过权限层，只是认证方式，最终转换为 actor context 和 runtime ACL input。

### 7.3 Scope filter

```text
owner:
  where scope_id = actor.current_scope_id
    and created_by = actor.user_id

scope_all:
  where scope_id = actor.current_scope_id

system_all:
  no scope_id restriction
```

`main_source` 动态表固定字段：

1. `id`
2. `created_at`
3. `updated_at`
4. `created_by`
5. `updated_by`
6. `scope_id`

必须建立索引：

1. `(scope_id, created_at)`
2. `(scope_id, created_by)`

## 8. 字段与关系

V1 常用字段集：

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

`main_source` 关系规则：

1. `many_to_one` 使用 FK 字段和约束。
2. `one_to_many` 作为反向元数据，不创建物理列。
3. `many_to_many` 使用平台管理 join table。

外部数据源关系规则：

1. 插件 catalog 必须声明关系能力。
2. 插件不支持关系写入时，平台只开放可实现的动作。
3. 发布时必须校验关系目标存在。
4. V1 不支持跨 data source 强关系约束。

## 9. 外部数据源插件契约

插件只负责协议翻译，不拥有权限、审计、API Key、scope provider 和平台元数据。

插件至少声明：

1. `source_code`
2. `display_name`
3. `contract_version`
4. `config_schema`
5. `secret_schema`
6. `resource_kinds`
7. `crud_capabilities`
8. `scope_capabilities`
9. `relation_capabilities`
10. `error_mapping`

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

`scope_capabilities`：

1. `none`
2. `mapped_field`
3. `native_tenant`

不支持 owner/scope 过滤的外部数据源，不允许授予 `owner` 或 `scope_all`；除非管理员显式用 `system_all` 风险授权，否则不得发布为可写运行时数据模型。

## 10. Secret Reference

借鉴 Supabase Vault 思路，平台不把 secret 明文塞进数据模型或插件配置。

规则：

1. UI 不回显 secret。
2. 数据模型只保存 `secret_ref` 和 `secret_version`。
3. 插件 runtime 只拿本次调用需要的临时解密值。
4. audit 只记录 secret version、动作和 actor，不记录明文。
5. REST API connector 的 token、header secret、OAuth client secret 都必须走 secret reference。
6. secret 轮换不修改数据模型结构，只更新 secret version。

## 11. 受保护模型

借鉴 Supabase protected schema / internal schema 思路，核心需要受保护数据模型概念。

受保护模型包括：

1. Core 内建模型。
2. system 管理模型。
3. HostExtension 拥有的 extension-owned 模型。
4. 插件运行时、审计、secret、文件、权限等系统模型。

受保护模型可以展示和引用，但默认禁止普通管理员：

1. 删除数据模型。
2. 删除字段。
3. 修改物理字段。
4. 直接开放外部 API。
5. 绕过 owner/scope 能力发布。

HostExtension 可以声明自己拥有的模型，但必须通过 manifest、Resource Action Kernel 和受控 migration 暴露，不能直接改写 Core 真值表。

## 12. Data Model Advisor

借鉴 Supabase Security Advisor / Performance Advisor，V1 需要 Data Model Advisor。

至少检查：

1. 已发布但未开放 API。
2. API 已开放但没有有效 API Key 权限。
3. API Key 可访问但没有 scope 限制。
4. 外部源不支持 owner/scope 却授予 `owner` 或 `scope_all`。
5. 外部源被标记 `unsafe_external_source`。
6. 高频 filter/sort 字段缺少索引。
7. REST API connector 没有错误映射。
8. 删除字段会破坏编排节点或 API 文档示例。
9. 受保护模型被尝试开放 API 或删除字段。
10. secret version 已过期或即将过期。

Advisor 输出级别：

1. `blocking`
2. `high`
3. `medium`
4. `low`

`blocking / high` 默认阻止发布或要求显式确认。

## 13. 前端信息架构

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

单机开源版不展示 workspace 切换，也不展示多 scope 管理入口。未来 workspace HostExtension 可以贡献 scope 切换、成员关系和 scope grant UI。

数据源详情：

1. 基础信息
2. 连接状态
3. 默认数据模型状态
4. 默认 API 暴露状态
5. 数据模型列表
6. secret reference 状态
7. 审计记录入口

数据模型详情：

1. 字段
2. 关系
3. 权限
4. API
5. 记录预览
6. 数据模型状态下拉
7. API 暴露状态
8. Advisor

管理台页面优先使用表格、表单、Descriptions、Tabs 和抽屉，不做卡片墙。

## 14. OpenAPI 与开发者体验

每个已发布数据模型需要展示：

1. CRUD endpoint。
2. 字段 schema。
3. filter/sort/expand 示例。
4. API Key 使用方式。
5. scope 权限说明。
6. 错误码。
7. API 暴露状态。
8. 外部数据源安全限制。

OpenAPI 可以先保留通用 runtime schema，不为每个数据模型生成静态 OpenAPI 文件。后续可增加按数据模型导出的动态 OpenAPI 文档。

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

## 16. 后端边界

### 16.1 domain

放稳定领域对象：

1. `DataSourceInstanceRecord`
2. `DataModelRecord`
3. `DataModelFieldRecord`
4. `ScopeDataModelGrantRecord`
5. `ApiExposureStatus`
6. `DataModelAdvisorFinding`
7. scope 与权限枚举

### 16.2 control-plane

放业务写入口：

1. `DataSourceService`
2. `DataModelService`
3. `DataModelPublishService`
4. `RuntimeDataModelGrantService`
5. `ApiKeyService`
6. `ScopeProviderRegistry`
7. `DataModelAdvisorService`
8. `SecretReferenceService`

关键写动作必须从 service command 或 Resource Action Kernel 进入。

### 16.3 runtime-core

放运行时 CRUD：

1. model registry
2. runtime ACL
3. query/filter/sort parser
4. runtime engine dispatch
5. main_source executor
6. external data source executor port
7. scope filter injection
8. API exposure gate

### 16.4 storage-durable/postgres

放 PostgreSQL 实现：

1. 元数据 migration
2. repository impl
3. 动态表 DDL
4. runtime record query
5. API Key 持久化
6. scope grant 持久化
7. advisor finding 持久化或查询投影
8. secret reference 持久化

### 16.5 plugin-framework

放数据源插件契约、CRUD capability、scope capability、relation capability、错误映射和 secret schema。

## 17. 审计与可观测性

必须审计：

1. 数据源创建、更新、验证、禁用。
2. 数据模型创建、字段新增、字段删除、发布、禁用。
3. scope 授权变化。
4. API Key 创建、禁用、过期。
5. API 暴露状态变化。
6. runtime CRUD 写动作。
7. 外部数据源连接失败、schema 校验失败、插件执行失败。
8. secret reference 创建、轮换、使用失败。
9. Advisor blocking/high finding 的确认或绕过。

读操作是否全量审计可配置，但外部 API Key 访问至少需要记录调用指标和失败原因。

## 18. 分期

### V1.1 main_source 数据模型闭环

1. system 创建数据模型。
2. 动态建表。
3. 字段新增和删除。
4. 数据源默认数据模型状态与默认 API 暴露状态。
5. 数据模型状态下拉调整。
6. runtime CRUD。
7. `DEFAULT_SCOPE_ID` 和 scope 过滤闭环。
8. 基础 API 暴露状态。

### V1.2 API Key 与开发者 API

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
6. secret reference 接入。

### V1.4 Advisor 与受保护模型

1. `ApiExposureStatus`。
2. `Protected Data Model`。
3. `Data Model Advisor`。
4. 发布前 blocking/high finding 门禁。

### V1.5 编排节点

1. 通用数据模型节点。
2. list/get/create/update/delete 动作。
3. 动态 schema 加载。
4. workflow actor 权限校验。
5. 执行日志与错误回传。

### V1.6 workspace HostExtension 预留验证

1. 定义 scope provider contract。
2. 验证核心 runtime 不依赖 workspace 产品对象。
3. 验证 HostExtension 可提供 current scope resolver 和 membership。
4. 验证单机开源版不展示 workspace UI。

## 19. 验收标准

V1 完成时必须满足：

1. `main_source` 可在 system 创建数据模型，并在 `published` 状态下通过 runtime CRUD 操作记录。
2. 新建数据模型默认 `published`，默认 API 暴露状态为 `published_not_exposed`，除非数据源设置覆盖。
3. 同一个 data source 内不能创建重复 `data_model.code`。
4. 所有持久化对象 ID 全局唯一，不允许复用。
5. `draft / disabled / broken` 数据模型不能被 runtime CRUD 调用。
6. 非 system scope 只能使用 system 授权的数据模型，不能改字段结构。
7. 权限范围能区分 `owner / scope_all / system_all`。
8. 单机开源版固定 `DEFAULT_SCOPE_ID`，不需要 workspace UI 也能完成 CRUD 查询。
9. API Key 能调用被授权的数据模型 CRUD，不能越权访问。
10. API 暴露状态能区分未发布、已发布未开放、开放但无权限、开放可用和外部源不安全。
11. 外部数据源发布必须通过连接测试、schema 校验和 scope capability 校验。
12. 外部数据源 CRUD 通过插件执行，但权限和审计仍由平台控制。
13. secret 不明文进入数据模型或审计日志。
14. 受保护模型不能被普通管理员删除字段、删除模型或直接开放 API。
15. Advisor 能发现 blocking/high 风险并阻止发布或要求显式确认。
16. 编排节点通过 runtime CRUD contract 执行，不直接调用插件或 SQL。
17. 删除字段和删除记录都写入审计；删除记录 V1 为物理删除。
18. 前端 Settings 中能从数据源进入数据模型列表和详情。
19. 未来 workspace HostExtension 能通过 scope provider 扩展多租户，不需要改写动态表结构。

## 20. 风险与约束

### 20.1 外部数据源权限一致性

外部数据源可能不支持 owner/scope 字段。V1 必须让插件显式声明 scope 能力，不能默认认为外部系统可被平台完整隔离。

### 20.2 REST API CRUD 映射复杂度

REST API 的 list/get/create/update/delete 不一定天然一致。V1 的 REST API 插件应要求用户配置动作映射、响应映射和错误映射。

### 20.3 关系字段跨源问题

V1 不支持跨 data source 强关系约束。跨源关系可以在产品层展示为弱引用或后续能力。

### 20.4 物理删除风险

记录删除采用物理删除，必须在 UI 和 API 文档中明确不可恢复，并保留审计事件。

### 20.5 system 建模集中化

system 统一建模降低冲突，但会增加 system 管理员配置压力。后续可通过 scope 申请、模板和 fork 能力缓解，不在 V1 实现。

### 20.6 scope 查询成本

`main_source` 动态表保留 `scope_id` 会让查询多一个过滤条件。V1 必须建立 `(scope_id, created_at)` 和 `(scope_id, created_by)` 索引。单机开源版固定 `DEFAULT_SCOPE_ID`，成本可控，且避免未来多租户插件反向改造所有动态表。

## 21. 后续计划入口

用户确认本 spec 后，下一步生成实施计划。计划按以下顺序拆分：

1. 数据模型元数据、命名空间与受保护模型。
2. `main_source` 发布与 runtime CRUD 闭环。
3. `DEFAULT_SCOPE_ID`、scope grant 与权限范围。
4. API Key 认证与 API 暴露状态。
5. secret reference。
6. 外部数据源插件 CRUD contract。
7. Data Model Advisor。
8. 前端 Settings 数据源与数据模型页面。
9. 编排通用数据模型节点。
10. workspace HostExtension scope provider 预留验证。
11. QA 验收与回归。
