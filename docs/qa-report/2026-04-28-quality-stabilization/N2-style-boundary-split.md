# N2 Style Boundary 拆分报告

## 范围

涉及区域：

- `web/app/src/style-boundary/scenario-manifest.json`
- `web/app/src/style-boundary/registry.tsx`
- `web/app/src/style-boundary/StyleBoundarySelectionSeed.tsx`

## 问题

原 `page.application-detail` style-boundary 同时承担了应用详情页面初始态与节点详情 dock 的断言。

这会导致页面级场景隐式依赖 Agent Flow 节点已选中，而真实首屏不应该默认打开节点详情。

## 修复

本轮将边界拆成两类：

- `page.application-detail`
  - 验证应用详情页和编辑器 shell 能正常进入。
  - 不再断言节点详情 dock。
- `component.agent-flow-node-detail`
  - 单独验证节点详情 dock、详情内容、模型字段等节点详情相关边界。
  - 通过 `StyleBoundarySelectionSeed` 显式选中 `node-llm`。

## 关键收益

- 页面初始态和节点详情态不再混用。
- style-boundary 更贴近真实交互路径。
- 后续改节点详情样式时可直接跑组件级边界，不必误伤页面级边界。

## 验证

已通过：

- `node scripts/node/check-style-boundary.js component component.agent-flow-node-detail`
- `node scripts/node/test-frontend.js full`
  - 页面级 style-boundary 全部 PASS
- `node scripts/node/test-contracts.js`
  - `27` tests passed

## 残留风险

Low：

- `component.agent-flow-node-detail` 依赖 mock document 和 mock provider options，后续模型供应商契约变化时需要同步维护。

