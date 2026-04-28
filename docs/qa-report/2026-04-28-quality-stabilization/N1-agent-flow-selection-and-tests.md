# N1 Agent Flow 默认选中与测试显式化报告

## 范围

涉及区域：

- `web/app/src/features/agent-flow/store/editor/index.ts`
- `web/app/src/features/agent-flow/_tests/**`
- `web/app/src/style-boundary/**`

## 问题

Agent Flow 编辑器的真实初始态已经收敛为“无选中节点”，但多处测试仍隐式依赖“打开编辑器后默认选中某个节点”。

这会造成三个问题：

- 测试行为依赖 fixture 节点顺序或默认选中策略。
- 测试失败时容易误判为节点详情、模型选择器或 Debug Console 逻辑回归。
- 页面首屏状态与节点详情状态混在一起，影响 style-boundary 的边界判断。

## 修复

本轮修复将默认选中策略显式化：

- `getDefaultSelectedNodeId()` 保持返回 `null`。
- store 初始化时 `selectedNodeId = null`，`selectedNodeIds = []`。
- 需要节点详情或模型配置的测试显式写入选择状态。
- Debug Console trace linkage 用例新增显式选择 LLM / Answer 的测试按钮。
- style-boundary 中节点详情场景显式选择 `node-llm`。

## 关键收益

- 编辑器初始态保持干净，不自动打开节点详情。
- 节点详情测试不再依赖默认节点。
- 未来改默认文档、节点顺序或节点类型时，不会牵连无关测试。
- 页面级和组件级验收口径更清晰。

## 验证

已通过：

- `pnpm --dir web/app test ...`
  - `61` files passed
  - `230` tests passed
- `node scripts/node/test-contracts.js`
  - `27` tests passed
- `node scripts/node/check-style-boundary.js component component.agent-flow-node-detail`

## 残留风险

无 Blocking / High 风险。

Low：

- 多个测试文件各自定义 `SelectionSeed`，短期可接受；后续如继续扩展 Agent Flow 测试，可收敛为共享测试工具。

