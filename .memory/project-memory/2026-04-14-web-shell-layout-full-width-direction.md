---
memory_type: project
topic: Web 壳层与 SectionPageLayout 默认全开
summary: 用户确认 `AppShell` 与 `SectionPageLayout` 作为页面骨架默认不再替业务页面限宽；模板只提供结构和响应式，具体页面布局由页面自身控制。
keywords:
  - web
  - app-shell
  - section-page-layout
  - full-width
  - settings
match_when:
  - 需要调整 `AppShell` 内容容器宽度策略
  - 需要修改 `SectionPageLayout` 的 rail/content 布局
  - 需要决定 settings 或 me 页面是否应由壳层替子组件限宽
created_at: 2026-04-14 21
updated_at: 2026-04-14 21
last_verified_at: 2026-04-14 21
decision_policy: verify_before_decision
scope:
  - web/app/src/app-shell
  - web/app/src/shared/ui/section-page-layout
  - web/app/src/features/settings
  - web/app/src/features/me
---

# Web 壳层与 SectionPageLayout 默认全开

## 时间

`2026-04-14 21`

## 谁在做什么

- 用户在排查 `/settings/roles` 右侧留白来源，并明确要求统一页面骨架不要替子组件限宽。
- AI 已核对壳层与模板样式来源，并按用户确认的方向完成实现与验证。

## 为什么这样做

- 之前留白不是单页组件自身造成，而是两层骨架共同收紧：
  - `AppShell` 使用 `min(1200px, 100% - 48px)` 的居中内容容器。
  - `SectionPageLayout` 桌面端使用 fixed rail 和依赖壳层宽度的 `margin-left: calc(...)` 补偿公式。
- 这种模式会让模板层暗中决定业务页宽度，导致页面组件无法真正按自身需求铺满。

## 为什么要做

- 用户明确要求：`SectionPageLayout` 只是模板，`AppShell` 也是上层骨架，它们都应默认“全开”，把具体布局密度和内容宽度交给页面自己控制。
- 这样可以避免设置页、账户页和后续新页面继续继承“壳层代替页面做宽度决策”的旧模式。

## 截止日期

- 无

## 决策背后动机

- 用户否定了“仅对某些 route 开 full-bleed”的局部方案，确认采用全局方向：
  - `AppShell` 内容容器默认全宽，只保留必要内边距，不再居中限宽。
  - `SectionPageLayout` 默认不替子内容设置额外最大宽度，也不再依赖旧壳层宽度补偿。
  - 具体页面若需要更窄的阅读宽度、卡片栅格或局部留白，应由页面自身组件决定，而不是由共享模板强加。
- 当前实现同步把 `SectionPageLayout` 的桌面端 rail 布局从 `fixed + calc margin` 改成 in-flow 的 `sticky + gap`，降低和上层壳层的耦合。

## 关联文档

- `web/app/src/app-shell/app-shell.css`
- `web/app/src/shared/ui/section-page-layout/section-page-layout.css`
- `web/app/src/app/_tests/app-shell.test.tsx`
- `web/app/src/shared/ui/section-page-layout/_tests/section-page-layout.test.tsx`
