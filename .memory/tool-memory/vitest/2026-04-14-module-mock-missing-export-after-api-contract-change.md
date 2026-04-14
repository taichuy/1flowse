---
memory_type: tool
topic: Vitest 模块 mock 在 API 契约切换后漏导出会让路由测试直接掉进错误边界
summary: 当前端真实模块新增导出后，旧 `vi.mock()` 夹具如果仍停留在旧接口形状，渲染到依赖新导出的页面时会报 `No "<export>" export is defined on the mock`，随后测试不会命中业务断言而是直接落入错误边界；已验证应先全局扫描旧 mock 引用，再把 query key 和 fetch mock 一并补齐。
keywords:
  - vitest
  - mock
  - export
  - api contract
  - settings docs
match_when:
  - 前端 API 模块从旧接口切到新接口后，关联测试突然报 mock 缺失导出
  - Vitest 输出 `No "<export>" export is defined on the mock`
  - 页面测试没有进入业务视图，而是先渲染错误边界
created_at: 2026-04-14 23
updated_at: 2026-04-14 23
last_verified_at: 2026-04-14 23
decision_policy: reference_on_failure
scope:
  - vitest
  - web/app/src/features/settings/_tests
  - web/app/src/routes/_tests
---

# Vitest 模块 mock 在 API 契约切换后漏导出会让路由测试直接掉进错误边界

## 时间

`2026-04-14 23`

## 为什么做这个操作

在设置页 API 文档从“分类整包 spec”切到“分类操作列表 + 单接口 spec”后，需要重跑 `settings-page` 和 `section-shell-routing` 相关回归，确认外围测试仍然成立。

## 失败现象

执行：

```bash
pnpm --dir web/app exec vitest run src/features/settings/_tests/settings-page.test.tsx
```

输出：

```text
[vitest] No "settingsApiDocsCategoryOperationsQueryKey" export is defined on the "../api/api-docs" mock.
```

随后页面直接渲染 `Something went wrong!` 错误边界，原本要验证的 `API 文档` 标题断言失败。

## 根因

`ApiDocsPanel` 已经依赖新的 `settingsApiDocsCategoryOperationsQueryKey` / `settingsApiDocsOperationSpecQueryKey` 和对应 fetch 方法，但外围测试里的 `vi.mock('../api/api-docs')` 仍只返回旧的 `settingsApiDocsCategorySpecQueryKey` / `fetchSettingsApiDocsCategorySpec`。

## 已验证解法

先扫描所有旧引用：

```bash
rg -n "settingsApiDocsCategorySpec|fetchSettingsApiDocsCategorySpec" web/app/src -g '*test.tsx'
```

然后把相关测试 mock 一次性补齐为新契约：

- `settingsApiDocsCategoryOperationsQueryKey`
- `settingsApiDocsOperationSpecQueryKey`
- `fetchSettingsApiDocsCategoryOperations`
- `fetchSettingsApiDocsOperationSpec`

最后重跑目标测试确认恢复为绿。

## 后续避免建议

- 前端 API 模块改导出时，不要只改实现和主测试；同步扫一遍路由层、页面层的 `vi.mock()` 夹具。
- 看到 `No "<export>" export is defined on the mock` 时，优先怀疑测试夹具接口过期，不要先去改业务组件。
