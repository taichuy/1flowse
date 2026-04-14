---
memory_type: tool
topic: style-boundary 页面场景改版后若 manifest 仍指向旧选择器会直接超时
summary: 当前端页面重构把关键容器类名换掉后，`node scripts/node/check-style-boundary.js page ...` 仍可能继续等待旧 `boundaryNodes.selector`，最终报 locator 超时；已验证应同步更新 `scenario-manifest.json` 中对应场景的边界节点选择器和断言属性。
keywords:
  - style-boundary
  - scenario-manifest
  - selector
  - timeout
  - page.settings
match_when:
  - `check-style-boundary.js page ...` 在页面已能打开时仍超时
  - 日志显示等待的 selector 来自旧 DOM 结构
  - 刚做过页面布局重构或类名更名
created_at: 2026-04-14 23
updated_at: 2026-04-14 23
last_verified_at: 2026-04-14 23
decision_policy: reference_on_failure
scope:
  - style-boundary
  - web/app/src/style-boundary/scenario-manifest.json
  - web/app/src/features/settings/components/api-docs-panel.css
---

# style-boundary 页面场景改版后若 manifest 仍指向旧选择器会直接超时

## 时间

`2026-04-14 23`

## 为什么做这个操作

在设置区 API 文档页面把“左侧分类列”改成“头部分类下拉”后，需要重新跑 `page.settings` 的 `style-boundary` 回归确认页面边界仍然成立。

## 失败现象

执行：

```bash
node scripts/node/check-style-boundary.js page page.settings
```

输出：

```text
locator.waitFor: Timeout 30000ms exceeded.
- waiting for locator('.api-docs-panel__categories').first() to be visible
```

## 根因

页面结构已经不再存在 `.api-docs-panel__categories`，但 `web/app/src/style-boundary/scenario-manifest.json` 里的 `page.settings.boundaryNodes` 还在等待旧选择器。

## 已验证解法

同步更新 `scenario-manifest.json`，把旧选择器替换成当前真实稳定节点，例如：

- `.api-docs-panel__header-controls`

并把断言属性改成当前布局真正应成立的样式，例如：

- `display: flex`
- `border-radius: 16px`

更新后重新执行 `check-style-boundary.js`，验证恢复为 `PASS`。

## 后续避免建议

- 页面改布局或改类名时，不要只改组件和测试；同步检查 `scenario-manifest.json` 是否还引用旧 DOM 边界。
- 看到 `locator.waitFor` 长时间卡在不存在的类名时，优先排查 manifest，而不是先怀疑浏览器或 dev server。
