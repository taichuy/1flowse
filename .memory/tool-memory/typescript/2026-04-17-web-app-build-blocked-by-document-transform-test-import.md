---
memory_type: tool
topic: web/app build 可能被测试文件引用不存在导出拦住
summary: 执行 `pnpm --dir web/app build` 时，`tsc --noEmit` 会一并检查测试文件；若 `src/features/agent-flow/_tests/document-transforms.test.ts` 仍引用不存在的 `removeNodeSubgraph` 导出，构建会在正式产物前失败。
keywords:
  - typescript
  - build
  - web/app
  - removeNodeSubgraph
  - document-transforms
match_when:
  - 运行 `pnpm --dir web/app build`
  - 报 `Module '../lib/document/transforms/node' has no exported member 'removeNodeSubgraph'`
created_at: 2026-04-17 14
updated_at: 2026-04-17 14
last_verified_at: 2026-04-17 14
decision_policy: reference_on_failure
scope:
  - typescript
  - pnpm
  - web/app
  - web/app/src/features/agent-flow/_tests/document-transforms.test.ts
  - web/app/src/features/agent-flow/lib/document/transforms/node
---

# web/app build 可能被测试文件引用不存在导出拦住

## 时间

`2026-04-17 14`

## 失败现象

执行：

```bash
pnpm --dir web/app build
```

报错：

```text
src/features/agent-flow/_tests/document-transforms.test.ts(17,3): error TS2305: Module '"../lib/document/transforms/node"' has no exported member 'removeNodeSubgraph'.
```

## 触发条件

- `web/app` 的 `build` 先执行 `tsc -p tsconfig.json --noEmit`
- `tsconfig` 会把测试文件也纳入类型检查
- `document-transforms.test.ts` 仍引用已移除或未导出的 `removeNodeSubgraph`

## 根因

构建失败点在测试代码和导出面之间的历史不一致，不是当前业务实现文件本身的编译错误。

## 解法

1. 先确认失败文件是否在 `_tests/`。
2. 若是 `removeNodeSubgraph` 缺失，优先对齐：
   - 测试引用名
   - `../lib/document/transforms/node` 的真实导出
3. 不要在当前任务无关时误把 `build` 失败归因到刚改的页面或样式文件。

## 验证方式

`2026-04-17 14` 已验证：执行上述命令稳定在 `document-transforms.test.ts` 处报 TS2305。

## 复现记录

- `2026-04-17 14`：在验证 agent-flow 节点详情布局改动时，`web/app build` 被 `document-transforms.test.ts` 的历史导出引用错误拦住。
