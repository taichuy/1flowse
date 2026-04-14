# 1Flowse 角色自动接收新增权限设计稿

日期：2026-04-14
状态：已完成设计确认，待用户审阅
关联输入：
- [api/AGENTS.md](../../../../api/AGENTS.md)
- [web/AGENTS.md](../../../../web/AGENTS.md)
- [.agents/skills/backend-development/SKILL.md](../../../../.agents/skills/backend-development/SKILL.md)
- [.agents/skills/frontend-development/SKILL.md](../../../../.agents/skills/frontend-development/SKILL.md)
- [api/crates/access-control/src/catalog.rs](../../../../api/crates/access-control/src/catalog.rs)
- [api/crates/control-plane/src/bootstrap.rs](../../../../api/crates/control-plane/src/bootstrap.rs)
- [api/crates/storage-pg/src/auth_repository.rs](../../../../api/crates/storage-pg/src/auth_repository.rs)
- [api/crates/storage-pg/src/role_repository.rs](../../../../api/crates/storage-pg/src/role_repository.rs)
- [api/apps/api-server/src/routes/roles.rs](../../../../api/apps/api-server/src/routes/roles.rs)
- [api/apps/api-server/src/routes/permissions.rs](../../../../api/apps/api-server/src/routes/permissions.rs)
- [web/app/src/features/settings/components/RolePermissionPanel.tsx](../../../../web/app/src/features/settings/components/RolePermissionPanel.tsx)

## 1. 文档目标

本文档用于冻结“角色自动接收后续新增权限”的实现边界。

本轮目标：

- 让所有角色都可以配置“自动接收后续新增权限”
- 新权限进入权限目录后，自动补绑到开启该开关的角色
- 内建角色默认值固定为：
  - `admin = true`
  - `manager = false`
- 设置页角色管理中提供可视化勾选并保存

本轮不做：

- 不回填历史权限
- 不做权限级“默认角色”配置
- 不新增独立的“同步历史权限”按钮
- 不改变 `root` 作为特殊角色的现有权限语义

## 2. 当前现状

### 2.1 权限目录是静态定义，启动时落库

当前权限目录由 [api/crates/access-control/src/catalog.rs](../../../../api/crates/access-control/src/catalog.rs) 的 `permission_catalog()` 统一生成。

应用启动时，[api/crates/control-plane/src/bootstrap.rs](../../../../api/crates/control-plane/src/bootstrap.rs) 调用 `upsert_permission_catalog()`，由存储层把权限写入 `permission_definitions`。

### 2.2 角色只支持显式绑定权限

当前角色与权限之间只有 `role_permissions` 这张显式绑定表。

现有系统没有“角色策略位”，也没有“新权限出现时自动授予某些角色”的机制。因此：

- 新增权限写入目录后，会进入 `permission_definitions`
- 但不会自动出现在已有角色上
- 内建角色也不会因为权限目录新增而自动补齐

### 2.3 当前设置页只能手工编辑角色权限

前端设置页的 [RolePermissionPanel](../../../../web/app/src/features/settings/components/RolePermissionPanel.tsx) 当前只支持：

- 查看角色列表
- 新建角色
- 编辑角色基础信息
- 手工勾选角色已有权限

当前没有角色级“自动接收未来新增权限”的展示或保存入口。

## 3. 设计结论

### 3.1 策略位归属到角色，不归属到权限

本轮新增角色字段：

- `auto_grant_new_permissions: boolean`

选择把该字段放在角色上，而不是放在权限上，原因是：

- 用户已明确要求“不仅是内置角色，是所有角色都支持”
- 如果把默认逻辑挂在权限定义上，模型天然会偏向固定角色集合
- “是否自动接收未来新增权限”本质是角色策略，不是单条权限属性

### 3.2 行为语义固定为“仅影响未来新增权限”

用户已明确选择：

- 开启自动接收后，只影响未来新增的权限
- 不回填当前系统里已经存在的历史权限

因此本字段的语义是：

- “当系统以后新增权限定义时，这个角色是否自动获得这些新权限”

而不是：

- “这个角色现在是否应该拥有所有权限”

### 3.3 手工权限编辑继续保留

本轮不是用自动策略替代手工绑定，而是增加一层默认同步机制。

两者关系固定为：

- `role_permissions` 仍然是真实权限绑定结果
- `auto_grant_new_permissions` 只决定未来新权限进入时是否自动补绑
- 关闭该开关不会删除已存在的权限绑定
- 已存在权限仍可继续手工勾选或取消

## 4. 数据模型设计

### 4.1 数据库字段

在 `roles` 表新增字段：

- `auto_grant_new_permissions boolean not null default false`

该字段适用于：

- 工作空间角色
- 系统角色

### 4.2 内建角色默认值

内建角色初始化时固定为：

- `root = false`
- `admin = true`
- `manager = false`

说明：

- `root` 继续走特殊角色语义，不依赖自动绑定机制
- `admin` 应自动接收未来新增权限，符合其管理角色定位
- `manager` 默认不自动接收，避免权限面静默扩张

### 4.3 新建角色默认值

非内建角色新建时：

- 默认 `false`
- 可由前端创建表单显式勾选为 `true`

## 5. 后端行为设计

### 5.1 权限落库时识别“本次新增权限”

现有 `upsert_permission_catalog()` 只有 upsert 语义，没有区分“已存在权限”和“新插入权限”。

本轮调整为：

- 在写入权限目录时，识别哪些权限是本次第一次进入 `permission_definitions`
- 只对这些“本次新增权限”继续做自动角色绑定

### 5.2 自动绑定目标

当出现“本次新增权限”时，系统自动把这些权限补绑到：

- `auto_grant_new_permissions = true` 的角色

作用域规则：

- 系统角色只处理系统作用域角色
- 工作空间角色只处理对应工作空间内角色

若某角色和某权限已存在绑定，则保持幂等，不重复插入。

### 5.3 历史权限不回填

开启开关时，不执行以下行为：

- 不扫描历史 `permission_definitions`
- 不自动把现有全部权限补给该角色

这是本轮冻结语义，避免“勾一下就瞬间拿到所有历史权限”的高风险行为。

### 5.4 关闭开关不撤销已有权限

关闭 `auto_grant_new_permissions` 时：

- 只影响未来新增权限
- 不删除当前已经绑定到该角色的权限

这样可避免系统在“策略位变化”和“权限结果变化”之间产生难以追踪的隐式副作用。

## 6. 接口设计

### 6.1 角色读取接口

`GET /api/console/roles`

响应中的角色对象新增字段：

- `auto_grant_new_permissions`

用于设置页展示当前角色策略。

### 6.2 角色创建接口

`POST /api/console/roles`

请求体新增字段：

- `auto_grant_new_permissions?: boolean`

若前端未传，后端按默认值 `false` 处理。

### 6.3 角色更新接口

`PATCH /api/console/roles/:id`

请求体新增字段：

- `auto_grant_new_permissions?: boolean`

用于设置页编辑角色策略。

若请求体缺失该字段，则保持角色当前值不变。

### 6.4 不新增独立策略接口

本轮不新增独立的：

- `PATCH /roles/:id/auto-grant-policy`

原因是该字段属于角色元数据的一部分，继续并入角色创建/更新接口即可，避免 API 无谓膨胀。

## 7. 前端设计

### 7.1 展示位置

设置页只增加一个勾选，不新增独立页面或复杂交互。

放置位置：

- 角色创建弹窗
- 角色编辑弹窗
- 角色详情/编辑区域可展示当前状态

文案固定为：

- `自动接收后续新增权限`

必要辅助说明可简短补一句：

- `开启后，仅对未来新增的权限自动授予当前角色，不影响已有权限。`

### 7.2 保存方式

创建角色时：

- 勾选状态随创建接口一起提交

编辑角色时：

- 勾选状态随更新接口一起提交

不需要单独“保存策略”按钮。

### 7.3 权限树保持不变

右侧权限树仍然只表达“当前已绑定权限结果”。

不在每一条权限上显示“这是自动绑定还是手工绑定”，因为本轮需求只关心策略位和最终结果，不要求追踪绑定来源。

## 8. 实现边界与约束

### 8.1 幂等性

系统启动、重复 bootstrap 或重复权限目录同步时，必须满足：

- 已存在权限不会重复插入
- 已存在角色权限绑定不会重复插入
- 自动补绑逻辑可以重复执行而不产生脏数据

### 8.2 审计

角色策略变更属于角色管理动作的一部分，沿用角色更新审计入口即可。

本轮不单独新增新的审计资源类别。

### 8.3 向后兼容

未更新前端时，后端也应允许旧请求继续工作：

- 创建角色不传该字段时，默认 `false`
- 更新角色时若缺失该字段，保持原值不变

当前前后端仍应一次性同步升级该字段的展示与保存，但后端 contract 不应因为旧请求缺字段而报错。

## 9. 测试设计

### 9.1 存储层测试

至少覆盖：

- 新权限首次进入目录时，只给 `auto_grant_new_permissions = true` 的角色补绑
- `admin` 默认会自动接收新权限
- `manager` 默认不会自动接收新权限
- 重复执行同步时不重复插入绑定

### 9.2 服务与路由测试

至少覆盖：

- `GET /api/console/roles` 返回该字段
- 创建角色时可设置该字段
- 更新角色时可修改该字段
- 关闭开关不会删除现有权限

### 9.3 前端测试

至少覆盖：

- 角色创建表单显示该勾选项并正确提交
- 角色编辑表单显示当前值并能修改保存
- 页面文案能表达“只影响未来新增权限”

## 10. 非目标

以下内容明确不在本轮范围内：

- 按资源、动作、作用域配置复杂自动授权规则
- 为权限记录“自动绑定来源”
- 打开开关时补发历史权限
- 为不同角色批量应用策略模板
- 在权限目录页单独编辑“默认角色集”

## 11. 最终结论

本轮以最小可用方式补齐“角色自动接收未来新增权限”能力：

- 用 `roles.auto_grant_new_permissions` 承载角色策略
- 默认 `admin=true`、`manager=false`
- 新权限进入目录时自动授予开启该策略的角色
- 不回填历史权限
- 设置页只增加一个勾选并随角色创建/编辑一起保存

这能满足当前需求，同时保持后端权限目录、角色模型、设置页交互的边界清晰，不把问题扩成新的权限规则系统。
