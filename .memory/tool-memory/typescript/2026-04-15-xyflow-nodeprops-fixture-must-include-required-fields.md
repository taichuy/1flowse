---
memory_type: tool
topic: 手写 xyflow 的 NodeProps 测试夹具缺少必填字段会在 build 阶段被 TypeScript 卡住
summary: 在 `web/app` 里给 `@xyflow/react` 的节点组件写单测时，如果直接手写 `NodeProps<T>` 夹具但漏掉 `draggable` 等必填字段，Vitest 运行可能仍通过，但 `pnpm --dir web/app build` 会在 `tsc` 阶段报 `TS2352`；已验证应补齐必填字段，并在测试里通过 `unknown` 中转做窄化。
keywords:
  - typescript
  - xyflow
  - react-flow
  - NodeProps
  - vitest
  - build
match_when:
  - 给 `@xyflow/react` 的 `NodeProps<T>` 写测试夹具
  - `pnpm --dir web/app build` 在测试文件报 `TS2352`
  - 提示缺少 `draggable`、`selectable`、`deletable` 等必填字段
created_at: 2026-04-15 21
updated_at: 2026-04-15 21
last_verified_at: 2026-04-15 21
decision_policy: reference_on_failure
scope:
  - typescript
  - vitest
  - @xyflow/react
  - web/app/src/features/agent-flow/_tests
---

# 手写 xyflow 的 NodeProps 测试夹具缺少必填字段会在 build 阶段被 TypeScript 卡住

## 时间

`2026-04-15 21`

## 为什么做这个操作

给 `AgentFlowNodeCard` 补单测，验证 `Start` 节点不渲染左侧 target handle，并且新增节点按钮确实在 source handle 内部。

## 失败现象

执行：

```bash
pnpm --dir web/app build
```

报错：

```text
TS2352: Conversion of type '{ ... }' to type 'NodeProps<AgentFlowCanvasNode>' may be a mistake ...
Property 'draggable' is missing ...
```

## 原因

Vitest 单测本身能跑过，但测试里手写的 `NodeProps<AgentFlowCanvasNode>` 夹具没有补齐 `draggable` 等必填字段；`tsc` 在 `build` 阶段会按完整类型检查，把这个隐患拦下来。

## 已验证解法

1. 给测试夹具补齐 `draggable` 等 `NodeProps` 必填字段。
2. 在测试里把对象先收窄为 `unknown`，再断言为 `Parameters<typeof Component>[0]`，避免直接硬转导致 `TS2352`。

## 后续避免建议

以后给 `@xyflow/react` 组件写节点单测时，不要只抄运行时用到的字段；先按完整 `NodeProps` 形状补齐基础属性，再做类型断言。
