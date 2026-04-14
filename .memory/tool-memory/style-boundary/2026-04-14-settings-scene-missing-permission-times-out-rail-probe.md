---
memory_type: tool
topic: style-boundary 检查 settings 场景时会因权限种子过旧超时等待 rail
summary: 运行 `check-style-boundary` 命中 `page.settings` 时，如果 `registry.tsx` 里的 `seedStyleBoundaryAuth` 没包含当前 settings 可见分区所需权限，场景会渲染成“当前账号暂无可访问内容”，随后对 `.section-page-layout__rail` 的探针等待超时；应先同步更新种子权限，再跑 settings 场景回归。
keywords:
  - style-boundary
  - settings
  - rail
  - timeout
  - permission
match_when:
  - 运行 `node scripts/node/check-style-boundary.js file web/app/src/shared/ui/section-page-layout/SectionPageLayout.tsx`
  - 运行 `node scripts/node/check-style-boundary.js page page.settings`
  - 输出 `waiting for locator('.section-page-layout__rail').first() to be visible`
created_at: 2026-04-14 18
updated_at: 2026-04-14 18
last_verified_at: 2026-04-14 18
decision_policy: reference_on_failure
scope:
  - style-boundary
  - scripts/node/check-style-boundary.js
  - web/app/src/style-boundary/registry.tsx
  - web/app/src/features/settings/lib/settings-sections.tsx
---

# style-boundary 检查 settings 场景时会因权限种子过旧超时等待 rail

## 时间

`2026-04-14 18`

## 失败现象

执行 `check-style-boundary` 命中 `page.settings` 时，输出：

`locator.waitFor: Timeout 30000ms exceeded`

并提示等待：

`locator('.section-page-layout__rail').first()`

## 触发条件

- `settings` 页面分区可见性规则已经收紧，例如 `API 文档` 需要额外权限。
- `web/app/src/style-boundary/registry.tsx` 中的 `seedStyleBoundaryAuth` 仍使用旧权限集合。

## 根因

style-boundary 场景并没有真正渲染出 settings 左侧导航，而是因为权限不足进入了空状态页，所以 rail 探针永远等不到。

## 已验证解法

1. 先打开 `http://127.0.0.1:3100/style-boundary.html?scene=page.settings` 或对应测试快照，确认页面是否落到了“当前账号暂无可访问内容”。
2. 同步更新 `seedStyleBoundaryAuth`，补齐当前 settings 默认场景需要的权限。
3. 再重跑 `node scripts/node/check-style-boundary.js page page.settings` 或对应 `file` 模式。

## 后续避免建议

每次调整 `settings` 可见分区权限后，除了改业务测试，还要同步检查 `style-boundary/registry.tsx` 的场景种子权限是否仍能渲染出目标页面，而不是只看组件测试通过。
