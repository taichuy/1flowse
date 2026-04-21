---
memory_type: feedback
feedback_category: repository
topic: 设置页主从布局优先使用 Ant Layout 且遮挡问题必须验证真实路由
summary: 遇到设置页这类“左主内容 + 右辅助面板”的主从布局时，优先使用 `Ant Design` 的 `Layout/Content/Sider`，不要先用手写 `grid` 或普通 `Row/Col` 顶页面骨架；同时这类遮挡、越界和覆盖问题不能只看 `style-boundary` 场景，必须补真实业务路由的浏览器运行态验证。
keywords:
  - frontend
  - settings
  - layout
  - ant-design
  - sider
  - table
  - overflow
  - real-route
  - verification
match_when:
  - 需要实现或调整设置页、控制台页的主从布局
  - 页面存在左侧表格或内容区，右侧存在固定宽度辅助面板
  - 出现表格越界、操作列被遮挡、右栏覆盖左栏等布局问题
  - 需要决定用 `Layout`、`Row/Col` 还是手写 grid 搭页面骨架
  - 需要为这类页面补 UI 验收和运行态验证链路
created_at: 2026-04-22 00
updated_at: 2026-04-22 00
last_verified_at: 2026-04-22 00
decision_policy: direct_reference
scope:
  - web/app/src/features/settings
  - web/app/src/features/settings/pages/SettingsPage.tsx
  - web/app/src/features/settings/components/model-providers
  - web/app/src/style-boundary
  - .agents/skills/frontend-development
  - .agents/skills/qa-evaluation
---

# 设置页主从布局优先使用 Ant Layout 且遮挡问题必须验证真实路由

## 时间

`2026-04-22 00`

## 规则

- 对设置页、控制台页这类“左主内容 + 右辅助面板”的页面级主从布局，优先使用 `Ant Design` 的 `Layout + Content + Sider`。
- 不要优先用手写 `grid`，也不要把普通 `Row/Col` 当成页面级主从骨架的默认方案；这些更适合普通分栏，不适合带固定宽度侧栏和 sticky 面板的主从结构。
- 左侧主内容区如果承载 `Table`、长说明或横向滚动内容，必须显式设置 `min-width: 0`、裁剪边界和内部滚动容器，避免内容越界渲染到右侧面板下方。
- 这类遮挡、越界、覆盖问题不能只看 `style-boundary` 场景截图，必须补真实业务路由的浏览器运行态截图或页面检查。

## 原因

这次 `/settings/model-providers` 的问题并不是单纯样式值错误，而是页面骨架选型和容器边界都不够硬：

- 手写 `grid` 时，右侧 sticky 面板容易侵占左侧表格的可视区域；
- 改成普通 `Row/Col` 后，页面栅格虽然更稳，但主从关系仍不够明确，固定宽度侧栏和左侧滚动表格的边界没有被彻底钉死；
- 即便切到 `Layout`，如果左侧 `Content` 不裁剪边界，`Ant Table` 的横向内容仍可能视觉上“钻到”右栏下面。

另外，这次 `style-boundary` 场景没有第一时间暴露问题，是因为它使用的是受控的 mock 场景和固定数据，和用户正在看的真实业务路由在内容宽度、文案长度、容器宽度占用上仍可能存在差异。

## 适用场景

- 设置页、详情页、控制台页、安装页等带右侧辅助面板的页面
- 左侧主区包含 `Table`、`Descriptions`、长文案、横向标签或链接操作列
- 使用 `sticky`、固定宽度侧栏、吸顶工具区时
- 设计页面布局规范和前端 QA 运行态验证链路时
