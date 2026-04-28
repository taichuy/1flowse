# N5 前端 Lint Warning 清零报告

## 范围

涉及区域：

- `web/app/src/features/agent-flow/components/editor/AgentFlowCanvasFrame.tsx`
- `web/app/src/features/agent-flow/hooks/runtime/useAgentFlowDebugSession.ts`
- `web/app/src/features/agent-flow/schema/agent-flow-view-renderers.tsx`
- `web/app/src/features/agent-flow/components/nodes/LlmCardModelBadge.tsx`

## 问题

前端 lint 剩余两条 warning：

- `AgentFlowCanvasFrame.tsx`
  - `react-hooks/exhaustive-deps`
  - effect 使用 `debugSession.syncSelectedNode`，但依赖数组只包含 `selectedNodeId`。
- `agent-flow-view-renderers.tsx`
  - `react-refresh/only-export-components`
  - renderer registry 文件中混入使用 hook 的组件 `LlmCardModelBadge`。

## 修复

- `useAgentFlowDebugSession` 中将 `syncSelectedNode` 改为 `useCallback`。
- `AgentFlowCanvasFrame` 解构稳定的 `syncSelectedNode`，并加入 effect dependency。
- 新增 `components/nodes/LlmCardModelBadge.tsx`，把 hook 组件移出 renderer registry。
- `agent-flow-view-renderers.tsx` 只保留 renderer 映射和纯 renderer 函数。

## 关键收益

- `web/app` lint 可用 `--max-warnings=0` 通过。
- hook dependency 不再依赖 eslint 豁免或隐式稳定性假设。
- renderer registry 职责更纯，fast-refresh 边界更清晰。

## 验证

已通过：

- `pnpm --dir web/app exec eslint src --ext .ts,.tsx --max-warnings=0`
- `pnpm --dir web/app build`
- `node scripts/node/test-contracts.js`
  - `27` tests passed
- `pnpm --dir web/app test ...`
  - `61` files passed
  - `230` tests passed
- `node scripts/node/check-style-boundary.js component component.agent-flow-node-detail`

## 残留风险

无 Blocking / High / Medium 风险。

Low：

- 本轮只处理 lint warning，不处理 Vitest stderr 运行时噪声。

