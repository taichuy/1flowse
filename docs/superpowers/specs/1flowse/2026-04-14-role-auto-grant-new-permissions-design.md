# 1Flowse 角色权限策略与默认新用户角色设计稿

日期：2026-04-14
状态：已完成设计确认，待用户审阅
关联输入：
- [api/AGENTS.md](../../../../api/AGENTS.md)
- [web/AGENTS.md](../../../../web/AGENTS.md)
- [.agents/skills/backend-development/SKILL.md](../../../../.agents/skills/backend-development/SKILL.md)
- [.agents/skills/frontend-development/SKILL.md](../../../../.agents/skills/frontend-development/SKILL.md)
- [api/crates/access-control/src/catalog.rs](../../../../api/crates/access-control/src/catalog.rs)
- [api/crates/control-plane/src/bootstrap.rs](../../../../api/crates/control-plane/src/bootstrap.rs)
- [api/crates/control-plane/src/member.rs](../../../../api/crates/control-plane/src/member.rs)
- [api/crates/storage-pg/src/auth_repository.rs](../../../../api/crates/storage-pg/src/auth_repository.rs)
- [api/crates/storage-pg/src/member_repository.rs](../../../../api/crates/storage-pg/src/member_repository.rs)
- [api/crates/storage-pg/src/role_repository.rs](../../../../api/crates/storage-pg/src/role_repository.rs)
- [api/apps/api-server/src/routes/members.rs](../../../../api/apps/api-server/src/routes/members.rs)
- [api/apps/api-server/src/routes/roles.rs](../../../../api/apps/api-server/src/routes/roles.rs)
- [web/app/src/features/settings/components/RolePermissionPanel.tsx](../../../../web/app/src/features/settings/components/RolePermissionPanel.tsx)

## 1. 文档目标

本文档用于冻结两类角色策略：

- 角色是否自动接收后续新增权限
- 角色是否作为“新建用户默认角色”

本轮目标：

- 让所有角色都可以配置 `auto_grant_new_permissions`
- 让工作空间角色可以配置 `is_default_member_role`
- 新权限进入权限目录后，自动补绑到开启自动接收的角色
- 新建用户时，自动绑定当前工作空间唯一默认角色，而不是继续写死 `manager`
- 设置页角色管理中用简单勾选方式展示和保存这两个策略

本轮固定约束：

- `admin` 默认 `auto_grant_new_permissions = true`
- `manager` 默认 `auto_grant_new_permissions = false`
- `manager` 默认 `is_default_member_role = true`
- 默认角色切换后，只影响之后新建的用户，不回填已有用户

本轮不做：

- 不回填历史权限
- 不做权限级“默认角色”配置
- 不做“批量迁移已有用户到新默认角色”
- 不做“同步历史权限”按钮
- 不改变 `root` 的特殊角色语义

## 2. 当前现状

### 2.1 权限目录是静态定义，启动时落库

当前权限目录由 [api/crates/access-control/src/catalog.rs](../../../../api/crates/access-control/src/catalog.rs) 的 `permission_catalog()` 统一生成。

应用启动时，[api/crates/control-plane/src/bootstrap.rs](../../../../api/crates/control-plane/src/bootstrap.rs) 调用 `upsert_permission_catalog()`，由存储层把权限写入 `permission_definitions`。

### 2.2 角色只有显式权限绑定，没有策略位

当前角色和权限之间只有 `role_permissions` 显式绑定表。

现有系统没有：

- “角色自动接收未来新增权限”的策略位
- “哪个角色是新建用户默认角色”的策略位

因此：

- 新权限写入目录后，不会自动补齐到已有角色
- 角色也无法表达“以后我想自动拿到新增权限”

### 2.3 新建用户仍然写死默认绑 `manager`

[api/crates/storage-pg/src/member_repository.rs](../../../../api/crates/storage-pg/src/member_repository.rs) 当前在 `create_member_with_default_role()` 中直接：

- 查 workspace 下 code 为 `manager` 的角色
- 把用户 `default_display_role` 写成 `manager`
- 把该用户自动绑定到 `manager`

这意味着“默认新用户角色”现在不是配置，而是硬编码。

### 2.4 设置页只能改基础信息和权限树

当前设置页的 [RolePermissionPanel](../../../../web/app/src/features/settings/components/RolePermissionPanel.tsx) 只支持：

- 新建角色
- 编辑角色名称和说明
- 手工勾选已有权限

当前没有角色级策略配置入口。

## 3. 设计结论

### 3.1 两个策略位都归属到角色

本轮在角色上新增两个字段：

- `auto_grant_new_permissions: boolean`
- `is_default_member_role: boolean`

原因：

- 用户明确要求“不仅是内置角色，是所有角色都支持”
- “是否自动接收未来新增权限”和“是否作为新建用户默认角色”本质都是角色策略
- 把这两个语义挂在权限定义上会天然偏向固定角色集合，边界不干净

### 3.2 自动接收新增权限只影响未来新增权限

用户已明确选择：

- 开启自动接收后，只影响未来新增的权限
- 不回填当前系统里已经存在的历史权限

因此其语义固定为：

- “以后权限目录新增权限时，这个角色是否自动获得这些新权限”

而不是：

- “这个角色现在是否应该拥有所有权限”

### 3.3 默认新用户角色只影响未来新建用户

用户已明确选择：

- 切换默认角色时，只影响之后新建的用户
- 已有用户保持不变

因此其语义固定为：

- “此后通过成员创建接口新建的用户，应自动绑定哪个角色”

而不是：

- “把当前所有用户都迁到这个角色”

### 3.4 默认角色必须唯一

默认新用户角色只能有一个。

约束固定为：

- 每个 workspace 必须且只能存在一个 `is_default_member_role = true` 的 workspace 角色
- system 角色不参与默认新用户角色语义
- 如果某个角色被设置为默认角色，当前 workspace 其他角色必须自动清为 `false`

### 3.5 当前默认角色不能被直接清空

不允许把当前唯一默认角色直接取消成“没有默认角色”。

原因：

- 新建用户链路需要始终能解析到唯一默认角色
- “没有默认角色”会让成员创建语义重新退回模糊状态

因此允许的切换方式只有：

- 去另一个角色上勾选为默认角色，由后端自动完成唯一切换

## 4. 数据模型设计

### 4.1 数据库字段

在 `roles` 表新增两个字段：

- `auto_grant_new_permissions boolean not null default false`
- `is_default_member_role boolean not null default false`

### 4.2 作用域约束

`auto_grant_new_permissions`：

- system 角色可读写
- workspace 角色可读写

`is_default_member_role`：

- 只对 workspace 角色生效
- system 角色固定为 `false`

### 4.3 唯一性约束

数据库层至少保证：

- 同一个 `workspace_id` 下，最多只能有一个 `is_default_member_role = true` 的 workspace 角色

业务层再保证：

- 系统启动完成后，每个 workspace 至少有一个默认角色
- 角色更新时不能把默认角色清成“没有默认”

### 4.4 内建角色默认值

内建角色初始化时固定为：

- `root`
  - `auto_grant_new_permissions = false`
  - `is_default_member_role = false`
- `admin`
  - `auto_grant_new_permissions = true`
  - `is_default_member_role = false`
- `manager`
  - `auto_grant_new_permissions = false`
  - `is_default_member_role = true`

### 4.5 新建角色默认值

非内建角色新建时：

- `auto_grant_new_permissions` 默认 `false`
- `is_default_member_role` 默认 `false`

若创建时显式勾选 `is_default_member_role = true`，则该角色成为新默认角色，并清除同 workspace 其他角色的默认标记。

## 5. 后端行为设计

### 5.1 权限落库时识别“本次新增权限”

现有 `upsert_permission_catalog()` 只有 upsert 语义，没有区分“已存在权限”和“新插入权限”。

本轮调整为：

- 写入权限目录时，识别哪些权限是本次第一次进入 `permission_definitions`
- 只对这些“本次新增权限”继续做自动角色绑定

### 5.2 自动绑定目标

当出现“本次新增权限”时，系统自动把这些权限补绑到：

- `auto_grant_new_permissions = true` 的角色

规则：

- system 角色按 system 角色集合处理
- workspace 角色按各自 workspace 处理
- 已存在绑定保持幂等，不重复插入

### 5.3 新建用户默认角色解析

成员创建时，不再写死查 `manager`。

改为：

- 先解析当前 workspace 的唯一默认角色
- 把新用户的 `default_display_role` 写成该角色 code
- 自动创建该角色的 `user_role_bindings`

若当前 workspace 缺少默认角色，应明确报错，而不是偷偷回退到 `manager`。

### 5.4 默认角色切换

当角色创建或更新请求中带 `is_default_member_role = true` 时：

- 当前角色设置为默认角色
- 同 workspace 其他 workspace 角色自动清为 `false`

当更新当前默认角色并传 `is_default_member_role = false` 时：

- 直接拒绝
- 返回明确错误，要求先在其他角色上设置默认角色

### 5.5 历史用户不回填

角色切换为默认角色后，不执行以下行为：

- 不更新已有用户的 `default_display_role`
- 不替换已有用户的角色绑定
- 不触发已有成员批量迁移

这条规则固定为本轮设计边界。

## 6. 接口设计

### 6.1 角色读取接口

`GET /api/console/roles`

响应中的角色对象新增字段：

- `auto_grant_new_permissions`
- `is_default_member_role`

### 6.2 角色创建接口

`POST /api/console/roles`

请求体新增字段：

- `auto_grant_new_permissions?: boolean`
- `is_default_member_role?: boolean`

默认规则：

- 缺失 `auto_grant_new_permissions` 时按 `false`
- 缺失 `is_default_member_role` 时按 `false`

### 6.3 角色更新接口

`PATCH /api/console/roles/:id`

请求体新增字段：

- `auto_grant_new_permissions?: boolean`
- `is_default_member_role?: boolean`

规则：

- 缺失字段时保持原值
- 若 `is_default_member_role = true`，则切换当前 workspace 唯一默认角色
- 若对当前默认角色传 `false` 且没有新的默认角色接替，则拒绝

### 6.4 成员创建接口不增加新参数

`POST /api/console/members`

本轮不新增“创建用户时显式指定默认角色”参数。

成员创建仍然只走：

- 当前 workspace 的默认角色策略

避免在“策略默认分配”和“显式指定角色”之间混入两套入口。

## 7. 前端设计

### 7.1 展示位置

设置页角色管理中继续使用简单勾选，不新增独立页面。

在以下位置增加两个勾选项：

- 角色创建弹窗
- 角色编辑弹窗

字段文案：

- `自动接收后续新增权限`
- `默认新用户角色`

### 7.2 交互语义

`自动接收后续新增权限`：

- 普通布尔开关
- 可独立勾选或取消

`默认新用户角色`：

- UI 形态仍然是单个勾选框
- 但语义是“把当前角色设为唯一默认角色”
- 在当前默认角色上不允许直接取消成 `false`
- 要切换默认角色时，应到目标角色上勾选 `true`

### 7.3 辅助文案

建议补充短说明：

- `自动接收后续新增权限`
  - `开启后，仅对未来新增的权限自动授予当前角色。`
- `默认新用户角色`
  - `开启后，新建用户会自动绑定该角色；同一工作空间只能有一个默认角色。`

### 7.4 权限树保持不变

右侧权限树仍然只表达当前已绑定权限结果。

本轮不在每条权限上标识“自动绑定来源”或“默认角色来源”。

## 8. 实现约束

### 8.1 幂等性

必须保证：

- 重复 bootstrap 不会重复插入权限或绑定
- 重复设置同一角色为默认角色不会产生多条默认记录
- 重复执行角色更新不会破坏唯一默认角色约束

### 8.2 审计

角色策略变更继续沿用角色创建/更新审计入口。

本轮不单独新增新的审计资源类别。

### 8.3 向后兼容

旧前端请求若不传新字段：

- 创建角色仍能成功
- 更新角色仍保持原值

但新前端和新后端仍应在同一轮同步收口，避免 UI 不展示真实策略。

## 9. 测试设计

### 9.1 存储层测试

至少覆盖：

- 新权限首次进入目录时，只给 `auto_grant_new_permissions = true` 的角色补绑
- `admin` 默认自动接收新增权限
- `manager` 默认不自动接收新增权限
- `manager` 默认是默认新用户角色
- 新建用户时使用当前默认角色，而不是写死 `manager`

### 9.2 服务与路由测试

至少覆盖：

- `GET /api/console/roles` 返回两个新字段
- 创建角色时可设置两个字段
- 更新角色时可修改自动接收策略
- 设置某角色为默认角色时，会清除同 workspace 其他角色默认位
- 对当前默认角色直接取消默认位会被拒绝
- 新建成员时返回的 `default_display_role` 和绑定角色来自当前默认角色

### 9.3 前端测试

至少覆盖：

- 角色创建弹窗显示两个勾选并正确提交
- 角色编辑弹窗显示当前值并能修改自动接收策略
- 把某角色设为默认角色的请求能正确提交
- 当前默认角色的“默认新用户角色”勾选不会被误用成可直接清空系统默认角色

## 10. 非目标

以下内容明确不在本轮范围内：

- 权限级自动授权规则系统
- 用户级批量迁移到新默认角色
- 记录权限绑定来源
- 创建成员时手工覆盖默认角色
- 多默认角色、多级默认角色、按组织单元默认角色

## 11. 最终结论

本轮以角色策略最小扩展方式收口权限与成员默认分配：

- 用 `roles.auto_grant_new_permissions` 处理未来新增权限自动补绑
- 用 `roles.is_default_member_role` 处理新建用户默认角色
- `admin` 默认自动接收新增权限
- `manager` 默认作为默认新用户角色
- 默认角色切换只影响未来新建用户，不影响已有用户
- 设置页继续只加简单勾选，不把问题扩成新的规则系统

这样可以同时解决“新权限补齐”和“新用户默认角色不应写死 manager”两个问题，并保持后端边界、前端交互和数据语义一致。
