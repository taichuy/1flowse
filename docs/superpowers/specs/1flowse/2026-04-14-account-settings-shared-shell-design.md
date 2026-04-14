# 1Flowse 账户域与设置域共享二级壳层设计稿

日期：2026-04-14
状态：已完成设计确认，待用户审阅
关联输入：
- [DESIGN.md](../../../../DESIGN.md)
- [web/AGENTS.md](../../../../web/AGENTS.md)
- [.agents/skills/frontend-development/SKILL.md](../../../../.agents/skills/frontend-development/SKILL.md)
- [.agents/skills/frontend-logic-design/SKILL.md](../../../../.agents/skills/frontend-logic-design/SKILL.md)
- [web/app/src/features/me/pages/MePage.tsx](../../../../web/app/src/features/me/pages/MePage.tsx)
- [web/app/src/features/me/components/ProfileForm.tsx](../../../../web/app/src/features/me/components/ProfileForm.tsx)
- [web/app/src/features/me/components/ChangePasswordForm.tsx](../../../../web/app/src/features/me/components/ChangePasswordForm.tsx)
- [web/app/src/features/settings/pages/SettingsPage.tsx](../../../../web/app/src/features/settings/pages/SettingsPage.tsx)
- [web/app/src/features/settings/components/SettingsSidebar.tsx](../../../../web/app/src/features/settings/components/SettingsSidebar.tsx)
- [web/app/src/routes/route-config.ts](../../../../web/app/src/routes/route-config.ts)
- [web/app/src/app/router.tsx](../../../../web/app/src/app/router.tsx)
- [web/app/src/app-shell/app-shell.css](../../../../web/app/src/app-shell/app-shell.css)
- [uploads/image_aionui_1776142647213.png](../../../../uploads/image_aionui_1776142647213.png)

## 1. 文档目标

本文档用于冻结 `/me` 与 `/settings` 的共享二级壳层方案，统一左侧导航、内容宽度、响应式和权限驱动的 section 子路由规则，同时保留“个人动作域”和“管理域”的信息架构分离。

本轮设计聚焦：

- 共享“左栏 + 内容区”二级页面模板
- `/me` 与 `/settings` 从页内 `useState` 切换到子路由
- section 可见性、默认落点和无权限跳转规则
- `/me` 相关 inline style 收口为模板 class 与 token，视觉效果保持现状
- 实现完成后必须打开浏览器，以截图基线完成 `/me` 视觉回归

本轮设计不覆盖：

- 后端权限模型或数据权限规则改造
- 真正运行时裁剪路由树
- `权限管理` 页面内部“角色列表 + 权限编辑器”的内容重构
- 把 `/me` 合并进 `/settings` 导航树

## 2. 当前现状

### 2.1 `/me` 和 `/settings` 长得像，但边界不统一

已验证现状：

- `/me` 在页面内部自建 `Layout + Sider + Content`，并写死 `position: fixed`、内容偏移和整页负 margin，[MePage.tsx](../../../../web/app/src/features/me/pages/MePage.tsx)
- `设置` 使用另一套 `Flex + Menu` 分栏，[SettingsPage.tsx](../../../../web/app/src/features/settings/pages/SettingsPage.tsx)
- 两者都处在同一个控制台壳层下，却没有复用同一个二级页面骨架

结果：

- 桌面端间距和宽度规则不一致
- 移动端没有统一退化行为
- 选中态样式和侧栏语义会继续漂移

### 2.2 当前 section 状态不能深链

已验证现状：

- `/me` 用本地 `selectedKey` 在同一路径内切换“个人信息 / 修改密码”
- `设置` 用本地 `activeSectionKey` 在同一路径内切换“API 文档 / 用户管理 / 权限管理”

结果：

- 刷新后不能稳定回到具体 section
- 无法直接分享某个 section 链接
- 权限变化后只能在页面内部做补救，路由语义不完整

### 2.3 当前导航与动作在 `/me` 内混放

`/me` sidebar 当前同时承载：

- section 导航
- `退出登录` 这种 destructive action

这会把“去哪里看/改什么”和“立刻执行一个动作”混在同一层级，属于信息架构上的深度不一致。

## 3. 信息架构结论

### 3.1 共享模板，不共享导航树

本轮采用的结论是：

- `/me` 仍是个人动作域入口
- `/settings` 仍是管理域入口
- 两者只共享二级壳层模板，不合并为同一棵 section 导航树

原因：

- `/me` 由右上角账户菜单进入，属于“我自己的资料与安全设置”
- `/settings` 由顶部“设置”进入，属于“系统管理”
- 共用模板不会改变它们的入口语义

### 3.2 section 改为 L2 子路由，不再停留在页面内部状态

冻结后的子路由：

- `/me/profile`
- `/me/security`
- `/settings/docs`
- `/settings/members`
- `/settings/roles`

父路径规则：

- 访问 `/me` 时直接 `replace` 到首个可见子路由
- 访问 `/settings` 时直接 `replace` 到首个可见子路由
- 父路径不保留空壳内容页

### 3.3 路由权限策略采用“静态注册 + 运行时可见性控制”

冻结后的策略：

- 所有 section 子路由都静态注册在路由树中
- 后端继续负责真实权限与数据权限
- 前端只做：
  - section 可见性控制
  - 无权限子路由自动跳转
  - 空可见集合时的正式空态

不采用运行时裁剪路由树的原因：

- 当前 TanStack Router 的真值层已经是静态配置
- 静态注册更利于类型稳定、测试稳定和深链稳定
- 运行时修改路由树会显著放大复杂度，但不增加真正的权限安全性

## 4. 一致性矩阵

### 4.1 当前状态

| 页面 | 二级导航容器 | section 状态来源 | 动作混放 | 响应式规则 |
| --- | --- | --- | --- | --- |
| `/me` | 固定 `Sider` | 页内 `useState` | 是 | 无统一方案 |
| `/settings` | 普通 `Menu` | 页内 `useState` | 否 | 无统一方案 |

### 4.2 修正后

| 页面 | 二级导航容器 | section 状态来源 | 动作混放 | 响应式规则 |
| --- | --- | --- | --- | --- |
| `/me/*` | 共享 Section Shell | 子路由 | 否 | 桌面左栏 / 移动 Tabs 或 Drawer |
| `/settings/*` | 共享 Section Shell | 子路由 | 否 | 桌面左栏 / 移动 Tabs 或 Drawer |

## 5. 共享组件设计

### 5.1 目录落点

共享组件固定落在：

- `web/app/src/shared/ui/section-page-layout/`

feature 自己的 section 配置固定留在：

- `web/app/src/features/me/lib/`
- `web/app/src/features/settings/lib/`

这样可以保证：

- `shared/ui` 只放纯布局与导航骨架
- 权限判断、文案、图标和 section 集合仍由各 feature 自己拥有

### 5.2 最小 API

共享模板只冻结最小 API，不做业务耦合。

#### `SectionNavItem`

```ts
export interface SectionNavItem {
  key: string;
  label: string;
  to: string;
  icon?: React.ReactNode;
  group?: string;
  visible?: boolean;
}
```

说明：

- `visible` 允许调用方在传入前后都能做过滤
- `group` 用于轻量分组，第一版只支持文案分组，不做复杂视觉嵌套

#### `SectionPageLayout`

```ts
export interface SectionPageLayoutProps {
  pageTitle?: React.ReactNode;
  pageDescription?: React.ReactNode;
  navItems: SectionNavItem[];
  activeKey: string;
  children: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  emptyState?: React.ReactNode;
}
```

职责只包括：

- 页级标题与说明
- 左侧导航骨架
- 内容区宽度与对齐
- section 分组展示
- 空态承载
- 响应式导航切换
- `navItems` 与 `sidebarFooter` 的结构分离

职责明确不包括：

- 请求
- 权限判断细节
- 子路由注册
- 表单和管理面板渲染

### 5.3 导航与动作分离

模板层直接区分：

- `navItems`
- `sidebarFooter`

目的：

- 避免导航项和 destructive action 混放
- 从组件边界上阻止 `/me` 当前的混合结构继续扩散

本轮落地时：

- `退出登录` 从 `/me` 的 sidebar 中移除
- 继续保留在右上角账户菜单
- 共享模板的 `sidebarFooter` 先不强制使用，但必须预留

## 6. section 定义与路由策略

### 6.1 `/me` section 定义

冻结后的 `/me` section：

- `profile`
  - 路径：`/me/profile`
  - 标题：`个人信息`
  - 默认对所有已登录用户可见
- `security`
  - 路径：`/me/security`
  - 标题：`安全设置`
  - 默认对所有已登录用户可见

`/me` 不再在 sidebar 内显示：

- `退出登录`

### 6.2 `/settings` section 定义

冻结后的 `/settings` section：

- `docs`
  - 路径：`/settings/docs`
  - 标题：`API 文档`
  - 所有已登录用户可见
- `members`
  - 路径：`/settings/members`
  - 标题：`用户管理`
  - `root` 或具备 `user.view.all` 时可见
- `roles`
  - 路径：`/settings/roles`
  - 标题：`权限管理`
  - `root` 或具备 `role_permission.view.all` 时可见

管理能力和可见性继续分离：

- 看得见不等于可编辑
- `canManageMembers`、`canManageRoles` 仍由对应 panel 内部控制写操作按钮

### 6.3 父路由跳转规则

冻结后的父路由行为：

- `/me` 进入后计算当前用户可见 section
- 若存在可见 section，立即 `replace` 到第一个可见子路由
- 若不存在可见 section，显示正式空态

`/settings` 同理。

### 6.4 无权限子路由规则

冻结后的子路由守卫行为：

- 当前 URL 指向不可见 section 时，不显示当前内容
- 如果当前 feature 仍有其他可见 section，自动跳到第一个可见 section
- 如果当前 feature 没有任何可见 section，显示正式空态

这样做的结果是：

- URL 总是指向一个真实 section
- 权限变化后不会停留在“看不见但还能打开”的灰态页面

## 7. 页面结构与视觉规则

### 7.1 桌面端结构

桌面端统一结构为：

- 左侧固定宽度 section rail
- 右侧内容区
- 整体宽度继续服从 `app-shell-content` 的内容宽度约束

模板必须复用壳层既有内容宽度逻辑，不再让 feature 自己计算：

- 内容总宽度沿用 `min(1200px, calc(100% - 48px))`
- 不再在 feature 页面中手写负 margin 和 `marginLeft` 计算

### 7.2 移动端结构

冻结后的移动端规则：

- `visible sections <= 4` 时，使用顶部 `Tabs/Segmented`
- `visible sections > 4` 时，使用按钮触发 `Drawer` 导航

原因：

- `/me`、`/settings` 当前 section 数量少，顶部切换更直接
- 当 section 数量增长时，顶部横向导航会压缩信息密度，届时退化为 `Drawer`

### 7.3 标题层级

模板支持两层标题：

- 页级标题
- section 级标题

但不能同时做得很重。

本轮建议：

- 页级标题维持轻量，承担“这是什么域”
- 右侧 section 标题承担“当前在看哪一块”

示例：

- `/me/profile`
  - 页级标题：`个人资料`
  - section 标题：`个人信息`
- `/settings/members`
  - 页级标题：`设置`
  - section 标题：`用户管理`

### 7.4 `/me` 视觉收口规则

本轮需要把 `/me` 中与二级壳层直接相关的大量 inline style 收口到：

- 共享模板 class
- 最近 owner 的样式文件
- 主题 token

要求：

- 视觉效果与当前 `/me` 保持一致
- 不通过无边界 `.ant-*` 后代选择器递归覆盖
- 被本轮触达的 `/me` 卡片、标题、侧栏间距、选中态样式统一收口

本轮视觉基线固定参考：

- `uploads/image_aionui_1776142647213.png`

抽象重构后，至少要保持以下可见结果不变：

- 顶部壳层高度、留白和导航密度
- 左侧 `/me` 二级导航区宽度、位置和浅绿色选中态
- 页面整体浅色背景氛围
- 主卡片的宽度、居中位置、圆角、阴影和顶部操作按钮位置
- 头像、主标题、状态标签、字段栅格和段落留白

如果实现中发现共享模板会改变以上任一视觉结果，不能自行接受“接近即可”，必须继续调整到与基线一致，或先征得用户确认。

## 8. 文件级改造边界

### 8.1 新增

- `web/app/src/shared/ui/section-page-layout/SectionPageLayout.tsx`
- `web/app/src/shared/ui/section-page-layout/SectionSidebarNav.tsx`
- `web/app/src/shared/ui/section-page-layout/section-page-layout.css`
- `web/app/src/features/me/lib/me-sections.tsx`
- `web/app/src/features/settings/lib/settings-sections.tsx`

### 8.2 调整

- `web/app/src/features/me/pages/MePage.tsx`
- `web/app/src/features/settings/pages/SettingsPage.tsx`
- `web/app/src/features/settings/components/SettingsSidebar.tsx`
- `web/app/src/app/router.tsx`
- `web/app/src/routes/route-config.ts`
- `web/app/src/style-boundary/scenario-manifest.json`
- `web/app/src/features/me/_tests/me-page.test.tsx`
- `web/app/src/features/settings/_tests/settings-page.test.tsx`

### 8.3 删除或被替代

`SettingsSidebar.tsx` 若最终只剩对共享导航的薄包装且没有独立语义，应直接删除，由共享组件替代。

## 9. 错误处理与空态

### 9.1 空可见 section

当当前用户在某 feature 下没有任何可见 section 时：

- 不显示空白页面
- 不显示损坏导航
- 显示正式 `Result` 空态

空态文案要求：

- 明确说明“当前账号暂无可访问内容”
- 不暴露调试信息

### 9.2 无权限直达子路由

当用户直接访问不可见 section 时：

- 优先跳转到第一个可见 section
- 无可跳转目标时显示正式空态

### 9.3 数据请求错误

共享模板本身不处理业务请求错误。

错误边界继续留在各自 panel：

- `/me` 的 profile/password 错误留在 feature 内
- `members`、`roles` 面板各自处理请求错误与 loading 状态

## 10. 测试与验证

### 10.1 单元与交互测试

至少补齐以下测试：

- `/me` 访问父路由时自动落到 `/me/profile`
- `/settings` 访问父路由时自动落到首个可见 section
- 无权限访问 `/settings/members` 时自动跳到下一个可见 section
- 所有 section 不可见时显示正式空态
- `/me` sidebar 不再出现 `退出登录`
- 移动端导航退化逻辑至少覆盖一种分支判断

### 10.2 样式边界回归

本轮涉及：

- 共享二级页面模板
- 导航选中态
- 页面内容宽度
- `/me` 样式收口

因此必须同步维护：

- `style-boundary` 场景 manifest
- 相关场景断言与影响文件映射

### 10.3 最低验证命令

实现后至少执行：

- `pnpm --dir web lint`
- `pnpm --dir web test`
- `pnpm --dir web/app build`
- `node scripts/node/check-style-boundary.js file web/app/src/features/me/pages/MePage.tsx`
- `node scripts/node/check-style-boundary.js file web/app/src/features/settings/pages/SettingsPage.tsx`

若共享模板被多个场景复用，还应额外对共享组件文件执行一次 `file` 模式校验。

### 10.4 浏览器视觉回归

实现完成后，除命令验证外，还必须进行浏览器视觉回归：

- 打开真实 `/me` 页面进行浏览器检查
- 以 `uploads/image_aionui_1776142647213.png` 作为基线截图做对比
- 重新截取一张实现后的 `/me` 页面截图，保存到 `uploads/`
- 对比基线图与新图，确认抽象重构没有改变 `/me` 的视觉效果

该回归是硬门禁，不允许只根据代码审查或 DOM 结构判断“应该没变”。

## 11. 实施顺序建议

推荐顺序：

1. 先新增共享 section 模板与导航组件
2. 冻结 `/me`、`/settings` section 定义文件
3. 改路由为父路由重定向 + 静态子路由
4. 迁移 `SettingsPage`
5. 迁移 `MePage`
6. 收口 `/me` inline style
7. 更新测试与 `style-boundary`

原因：

- 先立共享壳层边界，再迁 feature，返工最少
- 先迁 `settings` 再迁 `/me`，更利于验证模板是否足够通用

## 12. 最终结论

本轮冻结结论如下：

- `/me` 与 `/settings` 共用二级壳层模板，但继续分属不同信息架构域
- section 一律改为静态注册的子路由
- 权限只影响前端可见性、跳转与空态，不影响后端真实授权
- 导航项与 destructive action 在模板层分离
- 模板放 `shared/ui`，section 配置留在各自 feature
- `/me` 本轮顺手完成 layout 相关 inline style 收口，且视觉效果不退化
