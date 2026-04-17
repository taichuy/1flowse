---
memory_type: tool
topic: web/app build 会同时检查 Vitest mock 透传和 schema adapter 的 unknown 桥接
summary: 运行 `pnpm --dir web/app build` 时，`tsc --noEmit` 会把 `_tests` 一起类型检查；Vitest 里对真实函数做 `vi.fn((...args) => actual(...args))` 这类透传很容易触发 TS2556。另一方面，`SchemaAdapter.getValue/getDerived` 的返回值是 `unknown`，schema field/card renderer 里如果直接取属性也会在 build 阶段失败。更稳的做法是测试里改成显式参数透传，运行时桥接里先窄化/断言具体类型再访问字段。
keywords:
  - typescript
  - build
  - web/app
  - vitest
  - schema-adapter
  - unknown
  - TS2556
match_when:
  - 运行 `pnpm --dir web/app build`
  - 报 `TS2556: A spread argument must either have a tuple type`
  - 报 `Property 'config' does not exist on type '{}'`
  - 报 `Type 'unknown' is not assignable`
created_at: 2026-04-17 23
updated_at: 2026-04-17 23
last_verified_at: 2026-04-17 23
decision_policy: reference_on_failure
scope:
  - typescript
  - pnpm
  - web/app
  - web/app/src/features/agent-flow/_tests
  - web/app/src/features/agent-flow/schema/agent-flow-field-renderers.tsx
  - web/app/src/shared/schema-ui/registry/create-renderer-registry.ts
---

# web/app build 会同时检查 Vitest mock 透传和 schema adapter 的 unknown 桥接

## 时间

`2026-04-17 23`

## 失败现象

执行：

```bash
pnpm --dir web/app build
```

会在正式 `vite build` 前先被 `tsc --noEmit` 拦住，典型报错包括：

```text
TS2556: A spread argument must either have a tuple type
Property 'config' does not exist on type '{}'
Type 'unknown' is not assignable ...
```

## 触发条件

- `_tests` 里用 `vi.fn((...args) => actualFn(...args))` 包真实函数并透传参数。
- schema 运行时桥接里直接把 `SchemaAdapter.getValue/getDerived` 的 `unknown` 结果当成对象、数组或字符串使用。

## 根因

- `web/app build` 的 `tsconfig` 会把测试文件一起纳入类型检查，Vitest 绿灯不等于 `tsc` 绿灯。
- `SchemaAdapter` 故意只暴露 `unknown`，如果 field/card renderer 不做窄化，构建阶段会严格报错。

## 解法

1. 测试 mock 透传时优先写显式参数：
   - `vi.fn((nodeType) => actual.resolveAgentFlowNodeSchema(nodeType))`
   - `vi.fn((input) => actual.createAgentFlowNodeSchemaAdapter(input))`
2. 对 `SchemaAdapter.getValue/getDerived` 的读取先落成具体类型：
   - `as FlowNodeDocument | null`
   - `as FlowSelectorOption[] | undefined`
   - 或先做 `typeof/Array.isArray/'kind' in value` 窄化
3. header/input 这类 value prop 不要直接重复调用 `adapter.getValue(...)`，先存局部变量再做类型收口。

## 验证方式

- `2026-04-17 23` 已验证：修正测试透传写法与 schema unknown 窄化后，`pnpm --dir web/app build` 通过。

## 复现记录

- `2026-04-17 23`：schema card/overlay 迁移完成后，Vitest 已绿，但 `web/app build` 被测试透传签名和 schema adapter 的 unknown 类型桥接拦住；改为显式参数与本地窄化后恢复通过。
