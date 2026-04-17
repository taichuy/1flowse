---
memory_type: tool
topic: agent-flow schema detail/runtime migration 中的 shared import 路径与重复 DOM 冲突
summary: 在 `web/app` 跑 agent-flow detail/inspector 的 Vitest 时，`components/inspector` 与 `components/detail/tabs` 下的 shared schema import 需要比同级 detail 文件多一层 `../`；同时把 schema view renderer 和旧 inspector 片段混用会重复渲染 `output_contract` / relations，导致按钮与文案断言失败，已验证用法是修正 import 路径，并在 config tab 里过滤 `config.output_contract`、relations 交给 `NodeRelationsCard`。
keywords:
  - vitest
  - testing-library
  - agent-flow
  - schema-runtime
  - import-path
  - duplicate-dom
match_when:
  - 跑 `web/app/src/features/agent-flow/_tests/node-detail-panel.test.tsx` 或 `node-inspector.test.tsx` 时
  - 看到 `Failed to resolve import "../../../shared/schema-ui/runtime/SchemaRenderer"` 一类报错
  - 看到 `新增输出变量` 或 `下一步` 等文案重复/缺失，且 config tab 同时用了 schema view renderer 和旧 card 片段
created_at: 2026-04-17 22
updated_at: 2026-04-17 22
last_verified_at: 2026-04-17 22
decision_policy: reference_on_failure
scope:
  - vitest
  - testing-library
  - web/app/src/features/agent-flow/components/inspector
  - web/app/src/features/agent-flow/components/detail/tabs
---

# agent-flow schema detail/runtime migration 中的 shared import 路径与重复 DOM 冲突

## 时间

`2026-04-17 22`

## 失败现象

1. `NodeInspector` / `NodeDetailHeader` / `NodeConfigTab` / `NodeLastRunTab` 里直接引用 `shared/schema-ui` 时，若相对路径少算一层 `../`，Vitest 会在 import analysis 阶段直接报模块无法解析。
2. config tab 里如果同时渲染 schema view renderer 和旧 inspector/card 片段，`output_contract` 和 relations 会重复出现，Testing Library 会因为同名按钮或标题出现多次而失败。

## 根因

- `components/inspector` 和 `components/detail/tabs` 位于更深一层目录，shared 路径不能沿用同级 detail 组件的相对层级。
- schema registry 已经把 `output_contract` / `relations` 编成 view blocks，旧卡片片段再渲染一次就会打破 DOM 计数和文案断言。

## 已验证解法

- 对 `components/inspector` 和 `components/detail/tabs` 使用正确的 shared 相对路径。
- `NodeConfigTab` 里过滤掉 `relations` view，并把关系区交给 `NodeRelationsCard`。
- `config.output_contract` 只保留一条可见路径，避免和 schema view renderer 重复。

## 验证方式

- `cd web/app && pnpm exec vitest run src/features/agent-flow/_tests/node-detail-panel.test.tsx src/features/agent-flow/_tests/node-inspector.test.tsx`
- `cd web/app && pnpm exec vitest run src/features/agent-flow/_tests/node-last-run-tab.test.tsx`

## 复现记录

- `2026-04-17 22`：先把 shared schema import 写成较浅层级，Vitest 直接报 import 解析失败；修正后又因为 output/relations 重复渲染导致 Testing Library 断言失败，最终通过路径修正和 DOM 去重恢复绿色。
