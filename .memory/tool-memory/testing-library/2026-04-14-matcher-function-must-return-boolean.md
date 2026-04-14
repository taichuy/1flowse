---
memory_type: tool
topic: Testing Library 的 matcher 回调必须稳定返回 boolean，否则 build 时会被 TypeScript 卡住
summary: 在 `findAllByText` / `queryAllByText` 这类 Testing Library 查询里，如果 matcher 回调因为可空链写法返回了 `boolean | undefined`，测试运行可能仍通过，但 `tsc` 会在 `build` 阶段报 `MatcherFunction` 类型不匹配；已验证应显式处理 `null` 元素并返回纯 `boolean`。
keywords:
  - testing-library
  - typescript
  - matcher
  - boolean
  - build
match_when:
  - `tsc` 或 `pnpm build` 报 `MatcherFunction` 类型不匹配
  - `findAllByText` 的 matcher 使用了 `element?.`
  - 测试能跑但构建阶段突然失败
created_at: 2026-04-14 23
updated_at: 2026-04-14 23
last_verified_at: 2026-04-14 23
decision_policy: reference_on_failure
scope:
  - testing-library
  - typescript
  - web/app/src/features/settings/_tests/api-docs-panel.test.tsx
---

# Testing Library 的 matcher 回调必须稳定返回 boolean，否则 build 时会被 TypeScript 卡住

## 时间

`2026-04-14 23`

## 为什么做这个操作

在设置区 API 文档测试里，为了点开 `Ant Design Select` 的可视选项，需要用 `findAllByText` 过滤 `.ant-select-item-option-content`。

## 失败现象

执行：

```bash
pnpm --dir web/app build
```

输出：

```text
No overload matches this call.
Type 'boolean | undefined' is not assignable to type 'boolean'.
```

## 根因

matcher 回调里直接写了：

```ts
element?.matches(...) && element.textContent?.includes(label)
```

这会让返回值变成 `boolean | undefined`，`vitest` 运行时不一定立刻报错，但 `tsc` 在构建阶段会按 `MatcherFunction` 要求拦截。

## 已验证解法

先显式兜底 `null`，再把结果收敛为纯布尔值：

```ts
if (!element) {
  return false;
}

return (
  element.matches('.ant-select-item-option-content') &&
  Boolean(element.textContent?.includes(label))
)
```

## 后续避免建议

- 给 Testing Library 的 matcher 写回调时，不要依赖可空链的隐式返回类型。
- 遇到“测试绿但 build 红”的查询逻辑，优先检查 matcher 是否返回了非纯布尔类型。
